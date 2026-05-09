<?php

namespace App\Http\Controllers;

use App\Models\ClassSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use \App\Traits\LogsActivity;

class SessionController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $query = ClassSession::where('gym_id', $gymId)
            ->with([
                'classModel:id,name,class_type,color,instructor,image_url,description,location',
                'studio:id,name',
                'branch:id,name',
            ]);

        if ($date = $request->query('date')) {
            $query->where('session_date', $date);
        }

        if ($classId = $request->query('class_id')) {
            $query->where('class_id', $classId);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        // Clamp per_page so a misbehaving client can't request the full
        // history in one shot. Admin SSR currently passes 999 which is the
        // upper bound here.
        $perPage = min(max((int) $request->query('per_page', 50), 1), 1000);

        $sessions = $query->orderBy('session_date')
            ->orderBy('start_time')
            ->paginate($perPage);

        return response()->json($sessions);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'class_id' => 'required|uuid',
            'session_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'capacity' => 'nullable|integer|min:1',
            'instructor' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'session_type' => 'nullable|string|in:popup,recurring',
            'branch_id' => 'nullable|uuid',
            'studio_id' => 'required|uuid',
            'walk_in_allowed' => 'nullable|boolean',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;

        $session = ClassSession::create($validated);

        return response()->json(['data' => $session], 201);
    }

    public function createRecurring(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'class_id' => 'required|uuid',
            'start_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'capacity' => 'nullable|integer|min:1',
            'instructor' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'studio_id' => 'required|uuid',
            'branch_id' => 'nullable|uuid',
        ]);

        $gymId = $request->user()->gym_id;

        $result = DB::select('SELECT create_recurring_session(?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS id', [
            $gymId,
            $validated['class_id'],
            $validated['start_date'],
            $validated['start_time'],
            $validated['end_time'],
            $validated['capacity'] ?? null,
            $validated['instructor'] ?? null,
            $validated['location'] ?? null,
            $validated['studio_id'],
            $validated['branch_id'] ?? null,
        ]);

        return response()->json(['data' => ['id' => $result[0]->id]], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $session = ClassSession::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'session_date' => 'sometimes|date',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'capacity' => 'nullable|integer|min:1',
            'instructor' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'session_type' => 'nullable|string|in:popup,recurring',
            'is_published' => 'sometimes|boolean',
            'walk_in_allowed' => 'sometimes|boolean',
            'branch_id' => 'nullable|uuid',
            'studio_id' => 'nullable|uuid',
            'apply_to_series' => 'sometimes|boolean',
        ]);

        $applyToSeries = (bool) ($validated['apply_to_series'] ?? false);
        unset($validated['apply_to_series']);

        // Capture pre-update date so we can shift siblings by the same delta
        // (a Sunday → Monday move shifts the whole weekly series by one day).
        $originalDate = \Carbon\Carbon::parse($session->session_date);

        // Atomic so a partial failure during sibling propagation rolls back
        // the head update too. Without this, the edited row could end up out
        // of sync with the rest of its series.
        return DB::transaction(function () use ($session, $validated, $applyToSeries, $originalDate, $gymId) {
            $session->update($validated);

            $updatedSiblings = 0;
            if ($applyToSeries && $session->recurring_template_id) {
                // is_published / session_type / cancel state stay per-row;
                // everything else propagates.
                $propagatable = array_intersect_key($validated, array_flip([
                    'start_time', 'end_time', 'capacity', 'instructor',
                    'location', 'branch_id', 'studio_id', 'walk_in_allowed',
                ]));

                // diffInDays returns float in Carbon 3; round to defend against
                // any sub-day drift (DST, fractional precision) before truncating.
                $newDate = \Carbon\Carbon::parse($session->session_date);
                $deltaDays = (int) round(
                    $originalDate->copy()->startOfDay()
                        ->diffInDays($newDate->copy()->startOfDay(), false)
                );

                $futureSiblings = ClassSession::where('gym_id', $gymId)
                    ->where('recurring_template_id', $session->recurring_template_id)
                    ->where('id', '!=', $session->id)
                    ->where('status', 'scheduled')
                    ->where('session_date', '>=', $originalDate->toDateString())
                    ->lockForUpdate()
                    ->get();

                foreach ($futureSiblings as $sibling) {
                    $update = $propagatable;
                    if ($deltaDays !== 0) {
                        $update['session_date'] = \Carbon\Carbon::parse($sibling->session_date)
                            ->addDays($deltaDays)
                            ->toDateString();
                    }
                    $sibling->update($update);
                    $updatedSiblings++;
                }
            }

            return response()->json([
                'data' => $session,
                'updated_siblings' => $updatedSiblings,
            ]);
        });
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $gymId = $request->user()->gym_id;

        DB::select('SELECT cancel_session(?, ?, ?)', [
            $id,
            $gymId,
            $validated['reason'] ?? null,
        ]);

        return response()->json(['message' => 'Session cancelled successfully']);
    }

    /**
     * Check in a member to a specific session (by session ID in URL).
     */
    public function checkin(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'required|uuid',
        ]);

        $result = DB::select('SELECT checkin_member(?, ?) AS id', [
            $id,
            $validated['gym_member_id'],
        ]);

        return response()->json(['data' => ['id' => $result[0]->id]]);
    }

    /**
     * Generic check-in without session ID in URL — looks up the session by class_id.
     * Used by Flutter's markClassAttended().
     */
    public function checkinGeneric(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'class_id' => 'required|uuid',
            'gym_member_id' => 'required|uuid',
        ]);

        // Verify the gym_member belongs to the authenticated user (member)
        // OR exists in the caller's gym (admin/staff/super_admin). The
        // previous check let any admin from gym A act on a member of gym B.
        $user = $request->user();
        $gymMember = DB::table('gym_members')->where('id', $validated['gym_member_id'])->first();
        $isAdmin = in_array($user->role, ['gym_admin', 'super_admin', 'staff'], true);
        if (! $gymMember) {
            return response()->json(['error' => 'Member not found'], 404);
        }
        if (! $isAdmin && $gymMember->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        if ($isAdmin && $gymMember->gym_id !== $user->gym_id) {
            return response()->json(['error' => 'Member not in this gym'], 403);
        }

        // Class must also be in the caller's gym.
        $classInGym = DB::table('classes')
            ->where('id', $validated['class_id'])
            ->where('gym_id', $user->gym_id)
            ->exists();
        if (! $classInGym) {
            return response()->json(['error' => 'Class not found'], 404);
        }

        // Find the current/next session for this class
        $session = ClassSession::where('class_id', $validated['class_id'])
            ->where('session_date', '>=', now()->subDay()->toDateString())
            ->where('status', 'scheduled')
            ->orderBy('session_date')
            ->orderBy('start_time')
            ->first();

        if (! $session) {
            return response()->json(['error' => 'No upcoming session found for this class'], 404);
        }

        $result = DB::select('SELECT checkin_member(?, ?) AS id', [
            $session->id,
            $validated['gym_member_id'],
        ]);

        return response()->json(['data' => ['id' => $result[0]->id]]);
    }

    public function stopRecurring(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Cancel all future scheduled sessions with this recurring_template_id
        $today = now()->toDateString();

        DB::table('class_sessions')
            ->where('recurring_template_id', $id)
            ->where('gym_id', $gymId)
            ->where('status', 'scheduled')
            ->where('session_date', '>=', $today)
            ->update([
                'status' => 'cancelled',
                'cancel_reason' => 'Recurring series stopped',
                'cancelled_at' => now(),
                'updated_at' => now(),
            ]);

        return response()->json(['message' => 'Recurring series stopped']);
    }

    public function consume(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'required|uuid',
        ]);

        // Same scoping as checkinGeneric: members can only consume their
        // own sessions; admins can consume on behalf of any member but
        // must be in the same gym as the target.
        $user = $request->user();
        $gymMember = DB::table('gym_members')->where('id', $validated['gym_member_id'])->first();
        $isAdmin = in_array($user->role, ['gym_admin', 'super_admin', 'staff'], true);
        if (! $gymMember) {
            return response()->json(['error' => 'Member not found'], 404);
        }
        if (! $isAdmin && $gymMember->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        if ($isAdmin && $gymMember->gym_id !== $user->gym_id) {
            return response()->json(['error' => 'Member not in this gym'], 403);
        }

        $result = DB::select('SELECT consume_class_session(?) AS data', [
            $validated['gym_member_id'],
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    public function sessionLogs(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $logs = DB::table('attendance_logs as a')
            ->join('gym_members as gm', 'gm.id', '=', 'a.gym_member_id')
            ->join('profiles as u', 'u.id', '=', 'gm.user_id')
            ->leftJoin('member_memberships as mm', function ($join) {
                $join->on('mm.gym_member_id', '=', 'gm.id')
                     ->where('mm.status', 'active');
            })
            ->leftJoin('membership_plans as mp', 'mp.id', '=', 'mm.plan_id')
            ->leftJoin('class_sessions as cs', 'cs.id', '=', 'a.class_session_id')
            ->leftJoin('classes as c', 'c.id', '=', 'cs.class_id')
            ->where('a.gym_id', $gymId)
            ->select([
                'a.id',
                'a.check_in_at as consumed_at',
                'a.method as source',
                'gm.id as member_id',
                'gm.member_number',
                'u.full_name',
                'u.email',
                'mm.id as membership_id',
                'mp.name as plan_name',
                'mp.plan_type',
                'mm.status as membership_status',
                'mm.sessions_used',
                'mm.sessions_total',
                'c.name as class_name',
                'c.class_type',
                'c.color as class_color',
                'cs.session_date',
                'cs.start_time as session_time',
            ])
            ->orderByDesc('a.check_in_at')
            ->limit((int) $request->query('limit', 200))
            ->get();

        return response()->json(['data' => $logs]);
    }
}
