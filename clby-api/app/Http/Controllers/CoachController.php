<?php

namespace App\Http\Controllers;

use App\Services\ServiceSessionService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Coach mobile app endpoints. All routes are gated by the
 * `RequireCoachRole` middleware which (a) requires role='trainer',
 * (b) resolves the caller's `trainer_profiles` row, and (c) stashes
 * it at `$request->get('coach')`.
 *
 * Concepts (terms used both here and in the Flutter app):
 *  - assignment = `member_service_assignments` row — a member's
 *    purchased session pack, attached to this coach via `trainer_id`.
 *  - delivered session = `service_session_logs` row — one row per
 *    confirmed scan / manual log; what the QR home creates.
 *  - 30-min guard = a delivered session for the same assignment in the
 *    last 30 minutes blocks a second decrement; matches the prototype.
 */
class CoachController extends Controller
{
    /**
     * Resolve the caller's trainer_profile_id from the middleware stash.
     */
    private function coachId(Request $request): string
    {
        $coach = $request->get('coach');
        // RequireCoachRole guarantees this is set; the cast is just for
        // static analysis.
        return $coach->id;
    }

    /**
     * Caller's coach card (name + type + gym name) — used by the QR home
     * to show "YOUR CODE" + the coach name, and "Coach {name} · {gym}"
     * on the member-side preview.
     */
    public function me(Request $request): JsonResponse
    {
        $coach = $request->get('coach');
        $user  = $request->user();
        $gym = DB::table('gyms')->where('id', $coach->gym_id)->first(['name']);

        return response()->json([
            'data' => [
                'trainer_profile_id' => $coach->id,
                'name'               => $coach->name,
                'trainer_type'       => $coach->trainer_type,
                'gym_id'             => $coach->gym_id,
                'gym_name'           => $gym->name ?? null,
                'email'              => $user->email,
                // Stable seed for the QR pattern so the same coach always
                // renders the same code (matches the prototype's
                // `clby-${handle}` seed).
                'qr_seed'            => 'clby-coach-'.$coach->id,
            ],
        ]);
    }

    /**
     * Roster — every member service assignment owned by this coach.
     * Returns active and inactive separately so the UI can section them
     * (the design renders Active sorted low-balance-first, Inactive
     * collapsed by default).
     */
    public function roster(Request $request): JsonResponse
    {
        $coachId = $this->coachId($request);
        $gymId   = $request->user()->gym_id;

        // last_session subquery — most recent delivery per assignment.
        $lastSessionSub = DB::table('service_session_logs')
            ->select('assignment_id', DB::raw('MAX(delivered_at) AS last_at'))
            ->groupBy('assignment_id');

        $rows = DB::table('member_service_assignments AS a')
            ->where('a.gym_id', $gymId)
            ->where('a.trainer_id', $coachId)
            ->leftJoin('gym_members AS gm', 'gm.id', '=', 'a.gym_member_id')
            ->leftJoin('profiles AS p', 'p.id', '=', 'gm.user_id')
            ->leftJoinSub($lastSessionSub, 'ls', 'ls.assignment_id', '=', 'a.id')
            ->leftJoin('service_session_packages AS pkg', 'pkg.id', '=', 'a.service_package_id')
            ->orderBy('a.assigned_at', 'desc')
            ->get([
                'a.id AS assignment_id',
                'a.status',
                'a.sessions_total',
                'a.sessions_used',
                'a.service_type',
                'a.package_name',
                'a.assigned_at',
                'a.expires_at',
                'gm.id AS member_id',
                'gm.member_number',
                'gm.joined_at',
                'p.full_name AS member_name',
                'p.photo_url AS member_photo_url',
                'pkg.id AS package_id',
                'pkg.session_count AS package_session_count',
                'pkg.price AS package_price',
                'pkg.currency AS package_currency',
                'ls.last_at AS last_session_at',
            ]);

        $today = Carbon::now();

        $data = $rows->map(function ($r) use ($today) {
            $remaining = max(0, (int) $r->sessions_total - (int) $r->sessions_used);
            $expired   = $r->expires_at && Carbon::parse($r->expires_at)->lt($today);
            $state     = 'active';
            $reason    = null;
            if ($remaining <= 0 || $expired || $r->status !== 'active') {
                $state  = 'inactive';
                $reason = ($expired && $remaining > 0) ? 'expired' : 'completed';
            } elseif ($remaining < 3) {
                $state = 'low';
            }
            return [
                'assignment_id'   => $r->assignment_id,
                'status'          => $r->status,
                'state'           => $state, // active | low | inactive (mirrors the prototype)
                'reason'          => $reason, // 'expired' | 'completed' | null
                'sessions_total'  => (int) $r->sessions_total,
                'sessions_used'   => (int) $r->sessions_used,
                'sessions_remaining' => $remaining,
                'service_type'    => $r->service_type,
                'package_name'    => $r->package_name,
                'assigned_at'     => $r->assigned_at,
                'expires_at'      => $r->expires_at,
                'last_session_at' => $r->last_session_at,
                'member' => [
                    'id'            => $r->member_id,
                    'name'          => $r->member_name,
                    'photo_url'     => $r->member_photo_url,
                    'joined_at'     => $r->joined_at,
                    'member_number' => $r->member_number,
                ],
            ];
        })->values();

        return response()->json(['data' => $data]);
    }

    /**
     * Confirm a session — atomic 30-min-guarded decrement + log insert.
     * The transaction lives in ServiceSessionService (shared with the
     * offline sync); responses here are unchanged.
     */
    public function decrement(Request $request, ServiceSessionService $sessions): JsonResponse
    {
        $coachId = $this->coachId($request);
        $gymId   = $request->user()->gym_id;

        $validated = $request->validate([
            'assignment_id' => 'required|uuid',
            'note'          => 'nullable|string|max:2000',
        ]);

        try {
            $result = $sessions->deliver($coachId, $gymId, $validated['assignment_id'], $validated['note'] ?? null);
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['error' => 'Could not log the session. Try again.'], 500);
        }

        if (isset($result['error'])) {
            $err = $result['error'];
            $payload = ['error' => $err['message'], 'code' => $err['code']];
            if (! empty($err['extra'])) {
                $payload = array_merge($payload, $err['extra']);
            }
            return response()->json($payload, $err['status']);
        }
        return response()->json(['data' => $result['data']], 201);
    }

    /**
     * Today's logged sessions for this coach (gym-local date,
     * approximated as server timezone). Joined to the member and the
     * underlying assignment so the UI doesn't need a second round-trip.
     */
    public function today(Request $request): JsonResponse
    {
        $coachId = $this->coachId($request);
        $gymId   = $request->user()->gym_id;

        $start = Carbon::today();
        $end   = Carbon::tomorrow();

        $rows = DB::table('service_session_logs AS l')
            ->where('l.trainer_id', $coachId)
            ->where('l.gym_id', $gymId)
            ->whereBetween('l.delivered_at', [$start, $end])
            ->leftJoin('member_service_assignments AS a', 'a.id', '=', 'l.assignment_id')
            ->leftJoin('gym_members AS gm', 'gm.id', '=', 'l.gym_member_id')
            ->leftJoin('profiles AS p', 'p.id', '=', 'gm.user_id')
            ->orderBy('l.delivered_at', 'asc')
            ->get([
                'l.id AS log_id',
                'l.delivered_at',
                'l.note',
                'l.gym_member_id',
                'l.assignment_id',
                'a.sessions_total',
                'a.sessions_used',
                'a.package_name',
                'a.service_type',
                'p.full_name AS member_name',
                'p.photo_url AS member_photo_url',
            ]);

        $data = $rows->map(function ($r) {
            $remaining = max(0, (int) $r->sessions_total - (int) $r->sessions_used);
            return [
                'log_id'        => $r->log_id,
                'delivered_at'  => $r->delivered_at,
                'note'          => $r->note,
                'assignment_id' => $r->assignment_id,
                'package_name'  => $r->package_name,
                'service_type'  => $r->service_type,
                'sessions_total' => (int) $r->sessions_total,
                'sessions_remaining' => $remaining,
                'member' => [
                    'id'        => $r->gym_member_id,
                    'name'      => $r->member_name,
                    'photo_url' => $r->member_photo_url,
                ],
            ];
        })->values();

        return response()->json(['data' => $data]);
    }

    /**
     * Per-assignment session history (recent first, capped at 50).
     */
    public function assignmentHistory(Request $request, string $assignmentId): JsonResponse
    {
        $coachId = $this->coachId($request);
        $gymId   = $request->user()->gym_id;

        // Confirm the assignment belongs to this coach before exposing
        // its log rows.
        $owns = DB::table('member_service_assignments')
            ->where('id', $assignmentId)
            ->where('gym_id', $gymId)
            ->where('trainer_id', $coachId)
            ->exists();
        if (! $owns) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $rows = DB::table('service_session_logs')
            ->where('assignment_id', $assignmentId)
            ->orderByDesc('delivered_at')
            ->limit(50)
            ->get(['id', 'delivered_at', 'note']);

        return response()->json(['data' => $rows]);
    }

    /**
     * Update a session log's note. The coach can only edit notes on
     * sessions they delivered.
     */
    public function updateNote(Request $request, string $logId): JsonResponse
    {
        $coachId = $this->coachId($request);
        $gymId   = $request->user()->gym_id;

        $validated = $request->validate([
            'note' => 'nullable|string|max:2000',
        ]);

        $log = DB::table('service_session_logs')
            ->where('id', $logId)
            ->where('gym_id', $gymId)
            ->first();
        if (! $log) {
            return response()->json(['error' => 'Not found'], 404);
        }
        if ($log->trainer_id !== $coachId) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        DB::table('service_session_logs')->where('id', $logId)->update([
            'note'       => $validated['note'] ?? null,
            'updated_at' => Carbon::now(),
        ]);

        return response()->json([
            'data' => ['id' => $logId, 'note' => $validated['note'] ?? null],
        ]);
    }
}
