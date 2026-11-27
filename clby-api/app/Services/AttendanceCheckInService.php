<?php

namespace App\Services;

use App\Models\User;
use App\Traits\LogsActivity;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The attendance_logs write rules, shared by the online endpoints and the
 * offline sync (POST /api/attendance/sync).
 *
 *  - checkIn(): extracted verbatim from AttendanceController::store (which
 *    is now a thin wrapper — its HTTP responses are unchanged, see
 *    AttendanceStoreRegressionTest). Sync calls it with `as_of` (the
 *    device_recorded_at) so validity is judged on the visit's date in the
 *    gym's timezone (D2), and with `allow_exhausted` so a class bucket that
 *    ran out before the sync is accepted + flagged instead of rejected.
 *  - gymEntryDenial*(): extracted from AttendanceController::logByQr, shared
 *    with the sync's member_qr path.
 *  - recordGymEntry(): PHP equivalent of the insert done by the Postgres
 *    function log_gym_attendance_by_token, used by the sync's member_qr
 *    path (which validates gym + membership first, unlike that function).
 *
 * Callers own the surrounding transaction / locking; checkIn() opens its
 * own (nested → savepoint) transaction for the writes exactly as store()
 * did.
 */
class AttendanceCheckInService
{
    use LogsActivity;

    /** Result codes (sync contract) ↔ messages + HTTP status used by store(). */
    public const ERRORS = [
        'member_not_found' => ['Member not found', 404],
        'no_active_subscription' => ['Member does not have an active subscription', 422],
        'class_access_not_included' => ['This plan does not allow class access. Duration plans are gym-only.', 422],
        'membership_frozen' => ['Membership is frozen', 422],
        'no_remaining_sessions' => ['No remaining sessions', 422],
        'already_checked_in' => ['Already checked in for this session', 422],
        'gym_access_not_included' => ['This plan does not allow gym access. Session plans are class-only.', 422],
    ];

    /**
     * Manual / staff check-in with full validation:
     * 1. Verify member exists in the gym
     * 2. Load active, in-window membership buckets
     * 3. Pick the bucket that authorizes this entry type (gym vs class)
     * 4. Prevent duplicate check-ins for the same class session
     * 5. Insert the attendance row (+ decrement for class entries) and log activity
     *
     * @param array{
     *   class_session_id?: ?string, branch_id?: ?string, studio_id?: ?string,
     *   specialist_name?: ?string, access_point?: ?string, method?: ?string,
     *   check_in_at?: mixed,
     *   as_of?: ?CarbonInterface, gym_timezone?: ?string, allow_exhausted?: bool,
     *   source_event_id?: ?string, recorded_by?: ?string,
     *   activity_suffix?: string, activity_details?: ?array
     * } $opts
     * @return array{ok: bool, code: string, message: ?string, status: int,
     *               attendance_id: ?string, existing_attendance_id: ?string, flags: list<string>}
     */
    public function checkIn(User $actor, string $gymId, string $memberId, array $opts = []): array
    {
        $classSessionId = $opts['class_session_id'] ?? null;
        $isClassEntry = $classSessionId !== null;
        $allowExhausted = (bool) ($opts['allow_exhausted'] ?? false);
        $flags = [];

        // ── Step 1: Verify member exists ────────────────────────────────────
        $member = DB::table('gym_members')
            ->where('id', $memberId)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        if (! $member) {
            return $this->fail('member_not_found');
        }

        // ── Step 2: Load active, in-window membership buckets ───────────────
        //
        // A member can hold several buckets at once — e.g. a `duration`
        // subscription PLUS transferred `sessions`. We must pick by plan
        // CAPABILITY, not just the most-recent row, otherwise gifted sessions
        // never let a duration member into a class. Ordered to mirror
        // validate_studio_access: own subscription before transferred credits,
        // earliest-expiring first.
        //
        // Online: the window is checked against today (UTC, as before).
        // Sync: against the visit's date in the gym's timezone (D2).
        $windowDate = isset($opts['as_of'])
            ? $opts['as_of']->copy()->setTimezone($this->safeTz($opts['gym_timezone'] ?? null))->toDateString()
            : now()->toDateString();

        $memberships = DB::table('member_memberships')
            ->join('membership_plans', 'membership_plans.id', '=', 'member_memberships.plan_id')
            ->where('member_memberships.gym_member_id', $memberId)
            ->where('member_memberships.status', 'active')
            ->where(function ($q) use ($windowDate) {
                $q->whereNull('member_memberships.end_date')
                  ->orWhere('member_memberships.end_date', '>=', $windowDate);
            })
            ->select(
                'member_memberships.id as membership_id',
                'member_memberships.sessions_used',
                'member_memberships.sessions_remaining',
                'member_memberships.sessions_total',
                'member_memberships.freeze_status',
                'member_memberships.source_type',
                'membership_plans.plan_type',
                'membership_plans.session_count',
                'membership_plans.name as plan_name',
            )
            ->orderByRaw("CASE member_memberships.source_type WHEN 'subscription' THEN 0 ELSE 1 END")
            ->orderByRaw('member_memberships.end_date ASC NULLS LAST')
            ->orderBy('member_memberships.created_at', 'asc')
            ->get();

        if ($memberships->isEmpty()) {
            return $this->fail('no_active_subscription');
        }

        // ── Step 3: Pick the bucket that authorizes THIS entry type ─────────
        //
        // Plan capability:
        //   sessions         → classes ONLY (no gym access)
        //   duration         → gym ONLY (no class access)
        //   duration_session → BOTH gym and classes
        //
        $shouldDecrementSession = false;

        if ($isClassEntry) {
            $classCapable = $memberships->whereIn('plan_type', ['sessions', 'duration_session']);
            if ($classCapable->isEmpty()) {
                return $this->fail('class_access_not_included');
            }

            // Usable = not frozen and has remaining (unbounded sessions_total
            // NULL counts as usable for its time window).
            $membership = $classCapable->first(function ($m) {
                if (($m->freeze_status ?? '') === 'frozen') return false;
                return $m->sessions_total === null || (int) ($m->sessions_remaining ?? 0) > 0;
            });

            if ($membership) {
                $shouldDecrementSession = true;
            } else {
                // No usable class bucket — distinguish frozen-only from spent.
                if ($classCapable->every(fn ($m) => ($m->freeze_status ?? '') === 'frozen')) {
                    return $this->fail('membership_frozen');
                }
                if (! $allowExhausted) {
                    return $this->fail('no_remaining_sessions');
                }
                // D2 (sync only): the visit happened offline while the
                // device believed sessions remained; they ran out before the
                // sync. Accept, flag for staff review, never decrement past 0.
                $membership = $classCapable->first(fn ($m) => ($m->freeze_status ?? '') !== 'frozen');
                $flags[] = 'sessions_exhausted';
            }

            // Prevent duplicate check-in for the same class session
            $existingId = DB::table('attendance_logs')
                ->where('gym_member_id', $memberId)
                ->where('class_session_id', $classSessionId)
                ->value('id');

            if ($existingId) {
                return array_merge($this->fail('already_checked_in'), ['existing_attendance_id' => $existingId]);
            }
        } else {
            // Gym entry: any non-'sessions' plan grants gym access.
            $gymCapable = $memberships->where('plan_type', '<>', 'sessions');
            if ($gymCapable->isEmpty()) {
                return $this->fail('gym_access_not_included');
            }

            $membership = $gymCapable->first(fn ($m) => ($m->freeze_status ?? '') !== 'frozen');
            if (! $membership) {
                return $this->fail('membership_frozen');
            }
        }

        // ── Step 4: Execute check-in in transaction ─────────────────────────
        $id = Str::uuid()->toString();

        DB::transaction(function () use (
            $id, $actor, $gymId, $memberId, $opts, $classSessionId,
            $isClassEntry, $shouldDecrementSession, $membership, $member, $flags
        ) {
            $row = [
                'id' => $id,
                'gym_id' => $gymId,
                'gym_member_id' => $memberId,
                'check_in_at' => $opts['check_in_at'] ?? now(),
                'access_point' => $opts['access_point'] ?? null,
                'method' => $opts['method'] ?? 'manual',
                'branch_id' => $opts['branch_id'] ?? null,
                'studio_id' => $opts['studio_id'] ?? null,
                'specialist_name' => $opts['specialist_name'] ?? null,
                'class_session_id' => $classSessionId,
                'created_at' => now(),
                'updated_at' => now(),
            ];
            // Offline-sync provenance. Online paths never set these columns.
            if (! empty($opts['source_event_id'])) {
                $row['source_event_id'] = $opts['source_event_id'];
                $row['recorded_by'] = $opts['recorded_by'] ?? $actor->id;
                $row['review_flag'] = $flags[0] ?? null;
            }
            DB::table('attendance_logs')->insert($row);

            // Decrement session count for class entries on session-based plans.
            // CASE instead of GREATEST so the same SQL runs on sqlite (tests);
            // identical result for integers: max(0, remaining - 1).
            if ($shouldDecrementSession) {
                DB::table('member_memberships')
                    ->where('id', $membership->membership_id)
                    ->update([
                        'sessions_used' => DB::raw('sessions_used + 1'),
                        'sessions_remaining' => DB::raw('CASE WHEN COALESCE(sessions_remaining, 0) > 0 THEN COALESCE(sessions_remaining, 0) - 1 ELSE 0 END'),
                        'updated_at' => now(),
                    ]);
            }

            // Log activity
            $memberName = DB::table('profiles')->where('id', $member->user_id)->value('full_name') ?? 'Unknown';
            $entryType = $isClassEntry
                ? ($opts['access_point'] ?? 'Class')
                : 'Gym Access';

            $description = $shouldDecrementSession
                ? "{$actor->full_name} checked in {$memberName} for {$entryType} (session decremented)"
                : "{$actor->full_name} checked in {$memberName} ({$entryType})";

            $this->logActivity(
                $gymId,
                $actor->id,
                'checkin',
                'attendance',
                $description . ($opts['activity_suffix'] ?? ''),
                'attendance_logs',
                $id,
                $opts['activity_details'] ?? null,
            );
        });

        return [
            'ok' => true, 'code' => 'created', 'message' => null, 'status' => 201,
            'attendance_id' => $id, 'existing_attendance_id' => null, 'flags' => $flags,
        ];
    }

    /**
     * Why a member may not enter via a branch QR token, or null when allowed.
     * Unknown / inactive tokens are left to the caller (logByQr hands them to
     * log_gym_attendance_by_token so its existing responses are unchanged).
     */
    public function gymEntryDenial(string $gymMemberId, string $token): ?string
    {
        $branch = DB::table('branches')->where('qr_token', $token)->first(['id', 'gym_id']);
        if (! $branch) {
            return null;
        }

        return $this->gymEntryDenialForBranch($gymMemberId, $branch);
    }

    /**
     * Gym-entry rules for a resolved branch (object with id + gym_id).
     * Mirrors the member app's existing rules (qr_scanner_screen.dart) and
     * reason codes. The rules carry no date checks, so evaluating them "as
     * of" an offline visit (D2) uses the same rows.
     */
    public function gymEntryDenialForBranch(string $gymMemberId, object $branch): ?string
    {
        $member = DB::table('gym_members')
            ->where('id', $gymMemberId)->whereNull('deleted_at')->first(['gym_id']);
        // A member can only check in at their own gym's branches.
        if (! $member || $member->gym_id !== $branch->gym_id) {
            return 'not_a_member';
        }

        // The single active paid subscription (enforced by
        // idx_one_active_subscription_per_member) — same row the app uses.
        $current = DB::table('member_memberships as mm')
            ->leftJoin('membership_plans as mp', 'mp.id', '=', 'mm.plan_id')
            ->where('mm.gym_member_id', $gymMemberId)
            ->where('mm.gym_id', $member->gym_id)
            ->where('mm.source_type', 'subscription')
            ->where('mm.status', 'active')
            ->where('mm.payment_status', 'paid')
            ->first(['mm.freeze_status', 'mm.allowed_branch_ids', 'mp.plan_type']);

        if ($current) {
            if ($current->freeze_status === 'frozen') {
                return 'membership_frozen';
            }
            if (! in_array($current->plan_type, ['monthly', 'annual', 'duration', 'duration_session'], true)) {
                return 'gym_access_not_included';
            }
            $allowed = self::pgArray($current->allowed_branch_ids);
            if (! empty($allowed) && ! in_array($branch->id, $allowed, true)) {
                return 'branch_not_included';
            }
            return null;
        }

        // No subscription: transferred sessions are studio-only.
        $hasTransfer = DB::table('member_memberships')
            ->where('gym_member_id', $gymMemberId)
            ->where('gym_id', $member->gym_id)
            ->where('source_type', 'transfer')
            ->where('status', 'active')
            ->exists();

        return $hasTransfer ? 'gym_access_not_included' : null;
    }

    /**
     * Insert a gym-entrance row the way log_gym_attendance_by_token does
     * (method 'qr', access_point = branch name), for a member/branch the
     * caller has already validated. Sync-only, so provenance is recorded.
     */
    public function recordGymEntry(string $gymId, string $memberId, object $branch, string $checkInAt, string $sourceEventId, string $recordedBy): string
    {
        $id = Str::uuid()->toString();
        DB::table('attendance_logs')->insert([
            'id' => $id,
            'gym_id' => $gymId,
            'gym_member_id' => $memberId,
            'branch_id' => $branch->id,
            'check_in_at' => $checkInAt,
            'method' => 'qr',
            'access_point' => $branch->name ?? 'Gym Main Entrance',
            'source_event_id' => $sourceEventId,
            'recorded_by' => $recordedBy,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return $id;
    }

    /** Postgres text[] ("{a,b}") or array → list of strings. */
    public static function pgArray(mixed $value): array
    {
        if (is_array($value)) return array_values(array_map('strval', $value));
        if (! is_string($value) || $value === '' || $value === '{}') return [];
        return array_values(array_filter(array_map(
            fn ($v) => trim($v, '" '),
            explode(',', trim($value, '{}'))
        ), fn ($v) => $v !== ''));
    }

    private function fail(string $code): array
    {
        [$message, $status] = self::ERRORS[$code];
        return [
            'ok' => false, 'code' => $code, 'message' => $message, 'status' => $status,
            'attendance_id' => null, 'existing_attendance_id' => null, 'flags' => [],
        ];
    }

    private function safeTz(?string $tz): string
    {
        return $tz && in_array($tz, \DateTimeZone::listIdentifiers(), true) ? $tz : 'UTC';
    }
}
