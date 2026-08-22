<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

use \App\Traits\LogsActivity;

/**
 * Admin-recorded attendance for session-based services (PT, nutrition,
 * physio, and any future service configured as a session package).
 *
 * Powers Attendance → Services Attendance.
 *
 * Relationship to Services → Service Logs
 * ---------------------------------------
 * `service_attendance` is the source event. When (and only when) an
 * attendance is recorded as 'attended', this controller writes the
 * corresponding `service_session_logs` row using the SAME shape the coach
 * app writes (see CoachController::decrement) and stores its id on
 * `service_attendance.service_log_id`. One attendance action therefore
 * equals exactly one service log, and the existing Service Logs listing /
 * CSV export pick the row up with no changes to their format.
 *
 * absent / cancelled attendance never deducts and never writes a log —
 * which is why they live here rather than as a status on the log table.
 *
 * Service-agnostic: nothing in this controller names a service. The
 * service is whatever the linked assignment says it is, so a newly
 * configured session-based service works with no code change.
 */
class ServiceAttendanceController extends Controller
{
    use LogsActivity;

    /** Statuses that consume a session from the package. */
    private const DEDUCTING_STATUSES = ['attended'];

    /**
     * Paginated listing for the Services Attendance sub-tab.
     *
     * Filters: search (member name/email/number), gym_member_id,
     * service_type, assignment_id (package), trainer_id, status,
     * date_from / date_to.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search'        => 'nullable|string|max:128',
            'gym_member_id' => 'nullable|uuid',
            'assignment_id' => 'nullable|uuid',
            'trainer_id'    => 'nullable|uuid',
            'service_type'  => 'nullable|string|max:60',
            'status'        => 'nullable|string|in:all,attended,absent,cancelled',
            'date_from'     => 'nullable|date',
            'date_to'       => 'nullable|date',
            'limit'         => 'nullable|integer|min:1|max:200',
            'offset'        => 'nullable|integer|min:0',
        ]);

        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['data' => [], 'total' => 0, 'limit' => 0, 'offset' => 0, 'summary' => $this->emptySummary()]);
        }

        $limit  = (int) ($validated['limit']  ?? 25);
        $offset = (int) ($validated['offset'] ?? 0);

        $base = $this->buildQuery($gymId, $validated);
        $total = (clone $base)->count('sa.id');

        $rows = (clone $base)
            ->orderByDesc('sa.attended_at')
            // Stable secondary sort so pagination can't repeat or skip a
            // row when several share a timestamp.
            ->orderByDesc('sa.id')
            ->limit($limit)
            ->offset($offset)
            ->get([
                'sa.id',
                'sa.status',
                'sa.attended_at',
                'sa.note',
                'sa.service_log_id',
                'sa.reversed_at',
                'sa.created_at',
                'sa.sessions_remaining_after',
                'sa.sessions_total_at',
                'gm.id AS gym_member_id',
                'gm.member_number',
                'pr.full_name AS member_name',
                'pr.email AS member_email',
                'pr.photo_url AS member_photo_url',
                'a.id AS assignment_id',
                'a.package_name',
                'a.service_type',
                'a.sessions_total',
                'a.sessions_used',
                'a.status AS assignment_status',
                'tp.id AS trainer_id',
                'tp.name AS trainer_name',
                'tp.trainer_type',
                'rec.full_name AS recorded_by_name',
            ]);

        // Status tallies across the whole filtered set, ignoring the status
        // filter itself so the cards keep showing the full picture (same
        // convention as the Memberships tab).
        $summaryBase = $this->buildQuery($gymId, $validated, skipStatus: true);
        $summary = $summaryBase->select([
            DB::raw("COUNT(*) FILTER (WHERE sa.status = 'attended'  AND sa.reversed_at IS NULL) as attended"),
            DB::raw("COUNT(*) FILTER (WHERE sa.status = 'absent')    as absent"),
            DB::raw("COUNT(*) FILTER (WHERE sa.status = 'cancelled') as cancelled"),
            DB::raw("COUNT(*) FILTER (WHERE sa.reversed_at IS NOT NULL) as reversed"),
        ])->first();

        return response()->json([
            'data' => $rows->map(fn ($r) => $this->presentRow($r)),
            'total'  => $total,
            'limit'  => $limit,
            'offset' => $offset,
            'summary' => [
                'attended'  => (int) ($summary->attended  ?? 0),
                'absent'    => (int) ($summary->absent    ?? 0),
                'cancelled' => (int) ($summary->cancelled ?? 0),
                'reversed'  => (int) ($summary->reversed  ?? 0),
            ],
        ]);
    }

    /**
     * Record one service attendance.
     *
     * Transactional and idempotent:
     *  - the assignment row is lockForUpdate-held for the whole txn, so a
     *    concurrent request waits rather than double-deducting;
     *  - balance/expiry/status are re-checked inside the lock;
     *  - a partial unique index on (assignment_id, attended_at) for live
     *    attended rows is the last line of defence — a racing duplicate
     *    hits a constraint violation instead of deducting twice.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'assignment_id' => 'required|uuid',
            'status'        => 'required|string|in:attended,absent,cancelled',
            'trainer_id'    => 'nullable|uuid',
            'attended_at'   => 'nullable|date',
            'note'          => 'nullable|string|max:2000',
        ]);

        $gymId  = $request->user()->gym_id;
        $userId = $request->user()->id;
        if (! $gymId) {
            return response()->json(['error' => 'No gym association found.'], 403);
        }

        // Normalise to a whole second: `attended_at` participates in the
        // idempotency index, and the column is timestamp(0), so a value
        // carrying microseconds would round on write and could slip past
        // the duplicate check.
        $attendedAt = isset($validated['attended_at'])
            ? Carbon::parse($validated['attended_at'])->startOfSecond()
            : Carbon::now()->startOfSecond();

        try {
            $result = DB::transaction(function () use ($validated, $gymId, $userId, $attendedAt) {
                $assignment = DB::table('member_service_assignments')
                    ->where('id', $validated['assignment_id'])
                    ->where('gym_id', $gymId)
                    ->lockForUpdate()
                    ->first();

                if (! $assignment) {
                    return ['error' => ['message' => 'Service package assignment not found.', 'status' => 404]];
                }

                $deducts = in_array($validated['status'], self::DEDUCTING_STATUSES, true);

                // Idempotency: an identical live attended row means this is
                // a repeat submission. Return it unchanged instead of
                // deducting again.
                if ($deducts) {
                    $existing = DB::table('service_attendance')
                        ->where('assignment_id', $assignment->id)
                        ->where('status', 'attended')
                        ->whereNull('reversed_at')
                        ->where('attended_at', $attendedAt->toIso8601String())
                        ->first();
                    if ($existing) {
                        return [
                            'duplicate' => true,
                            'data' => [
                                'id'                 => $existing->id,
                                'assignment_id'      => $assignment->id,
                                'service_log_id'     => $existing->service_log_id,
                                'sessions_used'      => (int) $assignment->sessions_used,
                                'sessions_remaining' => max(0, (int) $assignment->sessions_total - (int) $assignment->sessions_used),
                            ],
                        ];
                    }
                }

                // Balance / lifecycle guards apply only to deducting
                // statuses — an admin must still be able to record that a
                // member was absent from an exhausted or expired package.
                if ($deducts) {
                    if ($assignment->status !== 'active') {
                        return ['error' => ['message' => 'This package is no longer active.', 'status' => 409]];
                    }
                    if ((int) $assignment->sessions_used >= (int) $assignment->sessions_total) {
                        return ['error' => ['message' => 'No sessions remaining on this package.', 'status' => 409]];
                    }
                    if ($assignment->expires_at && Carbon::parse($assignment->expires_at)->lt(Carbon::now())) {
                        return ['error' => ['message' => 'This package has expired.', 'status' => 409]];
                    }
                }

                // Specialist to credit. Admin-selected; falls back to the
                // assignment's own trainer. Required for a deducting row
                // because service_session_logs.trainer_id is NOT NULL.
                $trainerId = $validated['trainer_id'] ?? $assignment->trainer_id;
                if ($deducts && ! $trainerId) {
                    return ['error' => ['message' => 'Select a specialist for this session.', 'status' => 422]];
                }
                if ($trainerId) {
                    $trainerOk = DB::table('trainer_profiles')
                        ->where('id', $trainerId)->where('gym_id', $gymId)->exists();
                    if (! $trainerOk) {
                        return ['error' => ['message' => 'Specialist not found in this gym.', 'status' => 422]];
                    }
                }

                $nowIso     = Carbon::now()->toIso8601String();
                $attendedIso = $attendedAt->toIso8601String();
                $logId      = null;
                $newUsed    = (int) $assignment->sessions_used;

                if ($deducts) {
                    // Write the Service Logs row in exactly the shape the
                    // coach app writes, so the existing listing/export need
                    // no changes.
                    $logId = Str::uuid()->toString();
                    DB::table('service_session_logs')->insert([
                        'id'            => $logId,
                        'gym_id'        => $gymId,
                        'assignment_id' => $assignment->id,
                        'trainer_id'    => $trainerId,
                        'gym_member_id' => $assignment->gym_member_id,
                        'delivered_at'  => $attendedIso,
                        'note'          => $validated['note'] ?? null,
                        'created_at'    => $nowIso,
                        'updated_at'    => $nowIso,
                    ]);

                    $newUsed   = (int) $assignment->sessions_used + 1;
                    $exhausted = $newUsed >= (int) $assignment->sessions_total;
                    DB::table('member_service_assignments')
                        ->where('id', $assignment->id)
                        ->update([
                            'sessions_used' => $newUsed,
                            'status'        => $exhausted ? 'completed' : $assignment->status,
                        ]);
                }

                // Freeze the resulting balance onto the row. The listing reads
                // this instead of joining live to the assignment, so a later
                // deduction can't retroactively change this row's numbers.
                $totalAt        = (int) $assignment->sessions_total;
                $remainingAfter = max(0, $totalAt - $newUsed);

                $attendanceId = Str::uuid()->toString();
                DB::table('service_attendance')->insert([
                    'id'             => $attendanceId,
                    'gym_id'         => $gymId,
                    'gym_member_id'  => $assignment->gym_member_id,
                    'assignment_id'  => $assignment->id,
                    'trainer_id'     => $trainerId,
                    'status'         => $validated['status'],
                    'attended_at'    => $attendedIso,
                    'service_log_id' => $logId,
                    'recorded_by'    => $userId,
                    'note'           => $validated['note'] ?? null,
                    'sessions_remaining_after' => $remainingAfter,
                    'sessions_total_at'        => $totalAt,
                    'created_at'     => $nowIso,
                    'updated_at'     => $nowIso,
                ]);

                return [
                    'data' => [
                        'id'                 => $attendanceId,
                        'assignment_id'      => $assignment->id,
                        'gym_member_id'      => $assignment->gym_member_id,
                        'status'             => $validated['status'],
                        'service_log_id'     => $logId,
                        'sessions_used'      => $newUsed,
                        'sessions_remaining' => max(0, (int) $assignment->sessions_total - $newUsed),
                        'attended_at'        => $attendedIso,
                    ],
                ];
            });
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
            // The partial unique index caught a racing duplicate.
            return response()->json([
                'error' => 'This session was already recorded for that time.',
            ], 409);
        }

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']['message']], $result['error']['status']);
        }

        if (! empty($result['duplicate'])) {
            // Idempotent replay — report success with the original row so a
            // double-click in the UI is harmless.
            return response()->json(['data' => $result['data'], 'duplicate' => true], 200);
        }

        $this->logActivity(
            $gymId,
            $userId,
            'create',
            'attendance',
            "Recorded service attendance ({$result['data']['status']})",
            'service_attendance',
            $result['data']['id'],
            [
                'assignment_id'  => $result['data']['assignment_id'],
                'status'         => $result['data']['status'],
                'service_log_id' => $result['data']['service_log_id'],
            ],
        );

        return response()->json(['data' => $result['data']], 201);
    }

    /**
     * Reverse an attendance: restore the session and remove the paired
     * Service Logs row.
     *
     * The attendance row is kept for audit and flipped to 'cancelled' with
     * `reversed_at` stamped, which also releases the idempotency index so
     * the same slot can be recorded again.
     */
    public function reverse(Request $request, string $id): JsonResponse
    {
        $gymId  = $request->user()->gym_id;
        $userId = $request->user()->id;
        if (! $gymId) {
            return response()->json(['error' => 'No gym association found.'], 403);
        }

        $result = DB::transaction(function () use ($id, $gymId, $userId) {
            $attendance = DB::table('service_attendance')
                ->where('id', $id)
                ->where('gym_id', $gymId)
                ->lockForUpdate()
                ->first();

            if (! $attendance) {
                return ['error' => ['message' => 'Attendance record not found.', 'status' => 404]];
            }
            if ($attendance->reversed_at) {
                return ['error' => ['message' => 'This attendance was already reversed.', 'status' => 409]];
            }

            $restored = false;
            if ($attendance->status === 'attended') {
                // Lock the assignment before touching its counter.
                $assignment = DB::table('member_service_assignments')
                    ->where('id', $attendance->assignment_id)
                    ->lockForUpdate()
                    ->first();

                if ($assignment) {
                    // Guard against a negative counter even if the data
                    // drifted from an earlier manual correction.
                    $newUsed = max(0, (int) $assignment->sessions_used - 1);
                    DB::table('member_service_assignments')
                        ->where('id', $assignment->id)
                        ->update([
                            'sessions_used' => $newUsed,
                            // Reopen a package that completion had closed.
                            'status' => $assignment->status === 'completed' && $newUsed < (int) $assignment->sessions_total
                                ? 'active'
                                : $assignment->status,
                        ]);
                    $restored = true;
                }

                // Remove the paired Service Logs row so the log and the
                // deduction stay in agreement. The FK is ON DELETE SET NULL,
                // so we null the pointer explicitly below for clarity.
                if ($attendance->service_log_id) {
                    DB::table('service_session_logs')
                        ->where('id', $attendance->service_log_id)
                        ->where('gym_id', $gymId)
                        ->delete();
                }
            }

            $nowIso = Carbon::now()->toIso8601String();
            DB::table('service_attendance')->where('id', $id)->update([
                'status'         => 'cancelled',
                'service_log_id' => null,
                'reversed_at'    => $nowIso,
                'reversed_by'    => $userId,
                'updated_at'     => $nowIso,
            ]);

            // Giving a session back shifts the balance for every attendance
            // recorded after this one on the same package, so their frozen
            // snapshots have to be re-derived. Replays the package's history
            // in order and rewrites each row's remaining-after.
            $this->resnapshotAssignment($attendance->assignment_id);

            return ['data' => [
                'id'                => $id,
                'status'            => 'cancelled',
                'session_restored'  => $restored,
                'reversed_at'       => $nowIso,
            ]];
        });

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']['message']], $result['error']['status']);
        }

        $this->logActivity(
            $gymId,
            $userId,
            'update',
            'attendance',
            'Reversed service attendance',
            'service_attendance',
            $id,
            ['session_restored' => $result['data']['session_restored']],
        );

        return response()->json(['data' => $result['data']]);
    }

    /**
     * Assignments (packages) eligible for attendance, for the record modal.
     * Optionally narrowed to one member. Service-agnostic — every active
     * session package is listed whatever its service type.
     */
    public function assignments(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'nullable|uuid',
            'service_type'  => 'nullable|string|max:60',
            'search'        => 'nullable|string|max:128',
        ]);

        $gymId = $request->user()->gym_id;
        if (! $gymId) return response()->json(['data' => []]);

        $q = DB::table('member_service_assignments AS a')
            ->join('gym_members AS gm', 'gm.id', '=', 'a.gym_member_id')
            ->join('profiles AS pr', 'pr.id', '=', 'gm.user_id')
            ->leftJoin('trainer_profiles AS tp', 'tp.id', '=', 'a.trainer_id')
            ->where('a.gym_id', $gymId)
            ->whereNull('gm.deleted_at')
            // Only packages that can still take a session.
            ->where('a.status', 'active')
            ->whereRaw('a.sessions_used < a.sessions_total');

        if (! empty($validated['gym_member_id'])) {
            $q->where('a.gym_member_id', $validated['gym_member_id']);
        }
        if (! empty($validated['service_type'])) {
            $q->where('a.service_type', $validated['service_type']);
        }
        if ($s = trim($validated['search'] ?? '')) {
            $like = '%'.$s.'%';
            $q->where(function ($w) use ($like, $s) {
                $w->where('pr.full_name', 'ilike', $like)
                  ->orWhere('pr.email', 'ilike', $like)
                  ->orWhere('a.package_name', 'ilike', $like);
                if (ctype_digit($s)) {
                    $w->orWhere('gm.member_number', (int) $s);
                }
            });
        }

        $rows = $q->orderBy('pr.full_name')
            ->limit(200)
            ->get([
                'a.id AS assignment_id',
                'a.package_name',
                'a.service_type',
                'a.sessions_total',
                'a.sessions_used',
                'a.expires_at',
                'gm.id AS gym_member_id',
                'gm.member_number',
                'pr.full_name AS member_name',
                'tp.id AS trainer_id',
                'tp.name AS trainer_name',
                'tp.trainer_type',
            ]);

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'assignment_id'      => $r->assignment_id,
                'package_name'       => $r->package_name,
                'service_type'       => $r->service_type,
                'sessions_total'     => (int) $r->sessions_total,
                'sessions_used'      => (int) $r->sessions_used,
                'sessions_remaining' => max(0, (int) $r->sessions_total - (int) $r->sessions_used),
                'expires_at'         => $r->expires_at,
                'member' => [
                    'id'            => $r->gym_member_id,
                    'name'          => $r->member_name,
                    'member_number' => $r->member_number,
                ],
                'trainer' => $r->trainer_id ? [
                    'id'           => $r->trainer_id,
                    'name'         => $r->trainer_name,
                    'trainer_type' => $r->trainer_type,
                ] : null,
            ]),
        ]);
    }

    /**
     * Members who hold at least one package with sessions left — step 1 of
     * the record flow (search → member → package → specialist).
     */
    public function members(Request $request): JsonResponse
    {
        $validated = $request->validate(['search' => 'nullable|string|max:128']);

        $gymId = $request->user()->gym_id;
        if (! $gymId) return response()->json(['data' => []]);

        $q = DB::table('member_service_assignments AS a')
            ->join('gym_members AS gm', 'gm.id', '=', 'a.gym_member_id')
            ->join('profiles AS pr', 'pr.id', '=', 'gm.user_id')
            ->where('a.gym_id', $gymId)
            ->whereNull('gm.deleted_at')
            ->where('a.status', 'active')
            ->whereRaw('a.sessions_used < a.sessions_total');

        if ($s = trim($validated['search'] ?? '')) {
            $like = '%'.$s.'%';
            $q->where(function ($w) use ($like, $s) {
                $w->where('pr.full_name', 'ilike', $like)
                  ->orWhere('pr.email', 'ilike', $like);
                if (ctype_digit($s)) {
                    $w->orWhere('gm.member_number', (int) $s);
                }
            });
        }

        $rows = $q->groupBy('gm.id', 'gm.member_number', 'pr.full_name', 'pr.email', 'pr.photo_url')
            ->orderBy('pr.full_name')
            ->limit(50)
            ->get([
                'gm.id AS gym_member_id',
                'gm.member_number',
                'pr.full_name AS member_name',
                'pr.email AS member_email',
                'pr.photo_url AS member_photo_url',
                DB::raw('COUNT(a.id) AS package_count'),
            ]);

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'id'            => $r->gym_member_id,
                'name'          => $r->member_name,
                'email'         => $r->member_email,
                'member_number' => $r->member_number,
                'photo_url'     => $r->member_photo_url,
                'package_count' => (int) $r->package_count,
            ]),
        ]);
    }

    /**
     * Specialists eligible for a given package — step 3 of the record flow.
     *
     * Scoped to the package's own service type (a PT package offers PT
     * trainers, a physio package offers physiotherapists) so the admin
     * can't credit a session to the wrong kind of specialist. The
     * assignment's own trainer is flagged so the UI can preselect it.
     *
     * Service-agnostic: the type is read off the assignment, so a new
     * session-based service filters correctly with no code change.
     */
    public function specialists(Request $request): JsonResponse
    {
        $validated = $request->validate(['assignment_id' => 'required|uuid']);

        $gymId = $request->user()->gym_id;
        if (! $gymId) return response()->json(['data' => []]);

        $assignment = DB::table('member_service_assignments')
            ->where('id', $validated['assignment_id'])
            ->where('gym_id', $gymId)
            ->first();
        if (! $assignment) {
            return response()->json(['error' => 'Assignment not found.'], 404);
        }

        $q = DB::table('trainer_profiles')
            ->where('gym_id', $gymId)
            ->where('is_active', true);

        // Match the package's service type when we know it. Kept as a
        // filter rather than a hard requirement so a package whose type
        // has no matching specialist still lets the admin pick someone.
        if ($assignment->service_type) {
            $matching = (clone $q)->where('trainer_type', $assignment->service_type);
            if ($matching->exists()) {
                $q = $matching;
            }
        }

        $rows = $q->orderBy('name')->get(['id', 'name', 'trainer_type']);

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'id'           => $r->id,
                'name'         => $r->name,
                'trainer_type' => $r->trainer_type,
                // Preselect target for the modal.
                'is_package_trainer' => $r->id === $assignment->trainer_id,
            ]),
            'service_type' => $assignment->service_type,
        ]);
    }

    /**
     * Distinct service types configured in this gym — drives the Service
     * filter without hardcoding PT/nutrition/physio.
     */
    public function serviceTypes(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) return response()->json(['data' => []]);

        $types = DB::table('member_service_assignments')
            ->where('gym_id', $gymId)
            ->whereNotNull('service_type')
            ->distinct()
            ->orderBy('service_type')
            ->pluck('service_type');

        return response()->json(['data' => $types]);
    }

    // ── helpers ─────────────────────────────────────────────────────────

    /**
     * Recompute the frozen balance snapshots for one package.
     *
     * Called after a reversal, which hands a session back and therefore
     * changes what the balance was after every subsequent attendance.
     * Walks the package's attendance in chronological order, counting only
     * the live deducting rows, and rewrites each row's snapshot.
     */
    private function resnapshotAssignment(string $assignmentId): void
    {
        // The package's live `sessions_used` already reflects every surviving
        // deduction, so the pre-attendance baseline is
        //   used_before = live_used - (live attended rows we are replaying)
        // Anything consumed outside this table (coach-app logs, manual
        // grants) therefore stays accounted for instead of being erased.
        DB::statement(<<<'SQL'
            WITH totals AS (
                SELECT
                    a.id                AS assignment_id,
                    a.sessions_total,
                    GREATEST(0, a.sessions_used - COALESCE((
                        SELECT COUNT(*) FROM service_attendance x
                        WHERE x.assignment_id = a.id
                          AND x.status = 'attended'
                          AND x.reversed_at IS NULL
                    ), 0)) AS used_before
                FROM member_service_assignments a
                WHERE a.id = ?
            ),
            ordered AS (
                SELECT
                    sa.id,
                    t.sessions_total,
                    t.used_before,
                    SUM(
                        CASE WHEN sa.status = 'attended' AND sa.reversed_at IS NULL
                             THEN 1 ELSE 0 END
                    ) OVER (
                        PARTITION BY sa.assignment_id
                        ORDER BY sa.attended_at, sa.created_at, sa.id
                        ROWS UNBOUNDED PRECEDING
                    ) AS used_through_here
                FROM service_attendance sa
                JOIN totals t ON t.assignment_id = sa.assignment_id
            )
            UPDATE service_attendance sa
            SET sessions_remaining_after =
                    GREATEST(0, o.sessions_total - o.used_before - o.used_through_here),
                sessions_total_at = o.sessions_total
            FROM ordered o
            WHERE o.id = sa.id
        SQL, [$assignmentId]);
    }

    private function buildQuery(string $gymId, array $v, bool $skipStatus = false): \Illuminate\Database\Query\Builder
    {
        $q = DB::table('service_attendance AS sa')
            ->join('gym_members AS gm', 'gm.id', '=', 'sa.gym_member_id')
            ->join('profiles AS pr', 'pr.id', '=', 'gm.user_id')
            ->leftJoin('member_service_assignments AS a', 'a.id', '=', 'sa.assignment_id')
            ->leftJoin('trainer_profiles AS tp', 'tp.id', '=', 'sa.trainer_id')
            ->leftJoin('profiles AS rec', 'rec.id', '=', 'sa.recorded_by')
            ->where('sa.gym_id', $gymId)
            ->whereNull('gm.deleted_at');

        if ($s = trim($v['search'] ?? '')) {
            $like = '%'.$s.'%';
            $q->where(function ($w) use ($like, $s) {
                $w->where('pr.full_name', 'ilike', $like)
                  ->orWhere('pr.email', 'ilike', $like)
                  ->orWhere('a.package_name', 'ilike', $like);
                if (ctype_digit($s)) {
                    $w->orWhere('gm.member_number', (int) $s);
                }
            });
        }
        if (! empty($v['gym_member_id'])) $q->where('sa.gym_member_id', $v['gym_member_id']);
        if (! empty($v['assignment_id'])) $q->where('sa.assignment_id', $v['assignment_id']);
        if (! empty($v['trainer_id']))    $q->where('sa.trainer_id', $v['trainer_id']);
        if (! empty($v['service_type']))  $q->where('a.service_type', $v['service_type']);
        if (! $skipStatus && ($st = $v['status'] ?? null) && $st !== 'all') {
            $q->where('sa.status', $st);
        }
        // Parse rather than string-concatenate an end-of-day suffix: the
        // `date` rule also accepts a full ISO timestamp, and appending
        // " 23:59:59" to one builds an invalid literal that Postgres
        // rejects outright (500 instead of a filtered list).
        if (! empty($v['date_from'])) {
            $q->where('sa.attended_at', '>=', Carbon::parse($v['date_from'])->startOfDay());
        }
        if (! empty($v['date_to'])) {
            $q->where('sa.attended_at', '<=', Carbon::parse($v['date_to'])->endOfDay());
        }

        return $q;
    }

    private function presentRow(object $r): array
    {
        // Historical values: what the balance was when this attendance was
        // recorded. Falls back to the live assignment only when the snapshot
        // is absent (rows predating the snapshot columns).
        $total = (int) ($r->sessions_total_at ?? $r->sessions_total ?? 0);
        $remaining = $r->sessions_remaining_after !== null
            ? (int) $r->sessions_remaining_after
            : max(0, $total - (int) ($r->sessions_used ?? 0));

        return [
            'id'           => $r->id,
            'status'       => $r->status,
            'attended_at'  => $r->attended_at,
            'note'         => $r->note,
            // Present so the UI can link one row to its Service Logs entry
            // and show that they are the same action.
            'service_log_id' => $r->service_log_id,
            'reversed_at'  => $r->reversed_at,
            'member' => [
                'id'            => $r->gym_member_id,
                'name'          => $r->member_name,
                'email'         => $r->member_email,
                'member_number' => $r->member_number,
                'photo_url'     => $r->member_photo_url,
            ],
            'service' => [
                // The service identity comes from the assignment, never a
                // hardcoded list.
                'type' => $r->service_type,
            ],
            'package' => [
                'assignment_id'      => $r->assignment_id,
                'name'               => $r->package_name,
                'sessions_total'     => $total,
                'sessions_used'      => max(0, $total - $remaining),
                'sessions_remaining' => $remaining,
                'status'             => $r->assignment_status,
            ],
            'specialist' => $r->trainer_id ? [
                'id'           => $r->trainer_id,
                'name'         => $r->trainer_name,
                'trainer_type' => $r->trainer_type,
            ] : null,
            'recorded_by_name' => $r->recorded_by_name,
        ];
    }

    private function emptySummary(): array
    {
        return ['attended' => 0, 'absent' => 0, 'cancelled' => 0, 'reversed' => 0];
    }
}
