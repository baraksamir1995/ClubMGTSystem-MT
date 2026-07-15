<?php

namespace App\Http\Controllers;

use App\Jobs\SendGymAnnouncementPush;
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

        // Server-side date window. The mobile schedule only navigates
        // today..+29d, so it sends from/to instead of pulling the full
        // history — the returned volume is then bounded by the window
        // length, not by gym age. Only applied when present; the admin
        // SSR (date=/per_page=999) path is unaffected.
        if ($from = $request->query('from')) {
            $query->where('session_date', '>=', $from);
        }

        if ($to = $request->query('to')) {
            $query->where('session_date', '<=', $to);
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

        // Snapshot affected members + session metadata BEFORE the cancel,
        // so we know who to push (we cancel their bookings as part of the
        // same op; once that lands, joining bookings → members loses the
        // confirmed list).
        $session = DB::table('class_sessions')
            ->leftJoin('classes', 'class_sessions.class_id', '=', 'classes.id')
            ->where('class_sessions.id', $id)
            ->where('class_sessions.gym_id', $gymId)
            ->select(
                'class_sessions.id',
                'class_sessions.session_date',
                'class_sessions.start_time',
                'classes.name as class_name',
            )
            ->first();

        if (! $session) {
            return response()->json(['error' => 'Session not found'], 404);
        }

        $bookedUserIds = DB::table('session_bookings')
            ->join('gym_members', 'session_bookings.gym_member_id', '=', 'gym_members.id')
            ->where('session_bookings.session_id', $id)
            ->where('session_bookings.status', 'confirmed')
            ->pluck('gym_members.user_id')
            ->unique()
            ->values()
            ->all();

        DB::transaction(function () use ($id, $gymId, $validated) {
            DB::select('SELECT cancel_session(?, ?, ?)', [
                $id,
                $gymId,
                $validated['reason'] ?? null,
            ]);

            // Cascade to bookings so members don't keep a "confirmed"
            // booking pointing at a cancelled session in My Bookings.
            DB::table('session_bookings')
                ->where('session_id', $id)
                ->where('status', 'confirmed')
                ->update(['status' => 'cancelled', 'updated_at' => now()]);
        });

        // Best-effort FCM push to everyone whose booking just got cancelled.
        // Queued so the admin's HTTP request returns immediately; PushService
        // silently no-ops when Firebase isn't configured (e.g. local dev).
        if (! empty($bookedUserIds) && $session) {
            $when = trim(($session->session_date ?? '') . ' ' . substr((string) ($session->start_time ?? ''), 0, 5));
            $className = $session->class_name ?: 'Your class';
            $body = trim($when) !== ''
                ? "$className on $when has been cancelled."
                : "$className has been cancelled.";
            if (! empty($validated['reason'])) {
                $body .= ' Reason: ' . $validated['reason'];
            }

            SendGymAnnouncementPush::dispatch(
                $bookedUserIds,
                'Session cancelled',
                $body,
                ['type' => 'session_cancelled', 'session_id' => (string) $id],
            );
        }

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
        $today = now()->toDateString();

        // Future scheduled sessions for this template — these are the ones
        // we wipe. Past/already-cancelled rows stay so historical reports
        // and attendance records don't lose context.
        $sessionIds = DB::table('class_sessions')
            ->where('recurring_template_id', $id)
            ->where('gym_id', $gymId)
            ->where('status', 'scheduled')
            ->where('session_date', '>=', $today)
            ->pluck('id');

        if ($sessionIds->isEmpty()) {
            return response()->json(['message' => 'Recurring series stopped']);
        }

        DB::transaction(function () use ($sessionIds) {
            // Booking ids first — needed to clear session_ratings, which
            // FKs the booking, before we drop the bookings themselves.
            $bookingIds = DB::table('session_bookings')
                ->whereIn('session_id', $sessionIds)
                ->pluck('id');

            // FK order: ratings → attendance_logs → bookings → sessions.
            // attendance_logs / ratings shouldn't exist for future sessions,
            // but the deletes are no-ops then and let one cleanup path
            // serve any edge case (e.g. an admin stopped a series with a
            // session whose date is today and already had a check-in).
            if ($bookingIds->isNotEmpty()) {
                DB::table('session_ratings')->whereIn('booking_id', $bookingIds)->delete();
            }
            DB::table('session_ratings')->whereIn('session_id', $sessionIds)->delete();
            DB::table('attendance_logs')->whereIn('class_session_id', $sessionIds)->delete();
            DB::table('session_bookings')->whereIn('session_id', $sessionIds)->delete();
            DB::table('class_sessions')->whereIn('id', $sessionIds)->delete();
        });

        return response()->json(['message' => 'Recurring series stopped']);
    }

    /**
     * Copy the current calendar month's recurring sessions into the next
     * calendar month for one branch. Refuses (HTTP 422) if the target month
     * already contains any sessions for that gym+branch — admin must clear
     * them first.
     */
    public function copyToNextMonth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => 'nullable|uuid',
        ]);

        $gymId = $request->user()->gym_id;

        $result = DB::selectOne(
            'SELECT copy_recurring_sessions_to_month(?, ?, CURRENT_DATE) AS data',
            [$gymId, $validated['branch_id'] ?? null]
        );

        $payload = is_string($result?->data ?? null) ? json_decode($result->data, true) : null;
        if (! is_array($payload)) {
            return response()->json([
                'error' => 'Copy failed — no result returned from the database.',
            ], 500);
        }

        if (! ($payload['ok'] ?? false)) {
            $reason = $payload['reason'] ?? null;
            $message = $reason === 'busy'
                ? 'Another copy is already running for this branch — try again in a moment.'
                : 'Target month is not empty — clear it before copying.';
            return response()->json([
                'error' => $message,
                'reason' => $reason,
                'existing_count' => $payload['existing_count'] ?? null,
                'target_start' => $payload['target_start'] ?? null,
                'target_end' => $payload['target_end'] ?? null,
            ], $reason === 'busy' ? 409 : 422);
        }

        return response()->json($payload);
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
