<?php

namespace App\Services;

use App\Models\User;
use App\Traits\LogsActivity;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * POST /api/attendance/sync — per-event processing of offline-recorded
 * attendance (docs/offline-attendance/CONTRACT.md §1–2).
 *
 * Per event:
 *  1. Own DB transaction (a failing event never rolls back another).
 *  2. Postgres: pg_advisory_xact_lock on the event_id (serialises concurrent
 *     resends of the same event) and then on the member (serialises the
 *     class-duplicate check across devices). Transaction-scoped → safe with
 *     PgBouncer in transaction mode. No-ops on sqlite (tests).
 *  3. Idempotency against attendance_events (PK event_id, sha256
 *     payload_hash): same actor+gym+hash → stored result replayed (accepted
 *     → duplicate/event_replayed; rejected/duplicate → unchanged); other
 *     actor/gym → event_id_conflict; same actor, other hash →
 *     event_id_reused. A stored `error` is re-processed.
 *  4. Server-derived tenant + clock rules + offline gate (CONTRACT §6.2) +
 *     per-event permission matrix.
 *  5. Official write through AttendanceCheckInService / ServiceSessionService
 *     (the same rules as the online endpoints), stamped with
 *     source_event_id (UNIQUE) so one event can never yield two rows.
 *  6. Every processed event (accepted or rejected) is stored. An unexpected
 *     exception rolls back the event, is recorded as `error` in a separate
 *     small transaction and returned retryable.
 */
class AttendanceSyncService
{
    use LogsActivity;

    private const ADMIN_ROLES = ['gym_admin', 'staff', 'trainer', 'super_admin'];

    /** Human-readable messages for sync-only result codes. */
    private const MESSAGES = [
        'created' => 'Recorded.',
        'event_replayed' => 'This event was already processed.',
        'invalid_payload' => 'The event payload is invalid.',
        'tenant_mismatch' => 'The event belongs to a different gym than this account.',
        'member_not_found' => 'Member not found.',
        'branch_not_found' => 'Branch not found.',
        'class_session_not_found' => 'Class session not found.',
        'studio_not_found' => 'Studio not found.',
        'assignment_not_found' => 'Assignment not found.',
        'assignment_not_active' => 'Assignment is no longer active.',
        'permission_denied' => 'This account may not record this kind of attendance.',
        'not_self' => 'Members can only record their own attendance.',
        'qr_invalid' => 'The scanned QR code is not a valid gym QR code.',
        'qr_wrong_gym' => 'The scanned QR code belongs to another gym.',
        'qr_expired' => 'The gym QR code had expired when it was scanned.',
        'qr_replayed' => 'This rotating gym QR code was already used for a check-in.',
        'branch_inactive' => 'This branch is inactive.',
        'not_a_member' => 'Not a member of this gym.',
        'membership_frozen' => 'Membership is frozen.',
        'gym_access_not_included' => 'This plan does not include gym access.',
        'branch_not_included' => 'This plan does not include this branch.',
        'pack_expired' => 'Package expired.',
        'guard_window' => 'This member was already logged within 30 minutes of this session.',
        'clock_in_future' => 'The event time is in the future; check the device clock.',
        'event_too_old' => 'The event is too old to sync automatically; staff must record it manually.',
        'event_id_conflict' => 'This event id cannot be used.',
        'event_id_reused' => 'This event id was already used for a different event.',
        'offline_disabled' => 'Offline recording of this kind of attendance is disabled.',
        'server_error' => 'Temporary server error; the event will be retried.',
    ];

    /** ServiceSessionService error code → sync result code. */
    private const SERVICE_CODES = [
        'not_found' => 'assignment_not_found',
        // Another coach's assignment is reported exactly like a missing one so
        // the sync path is no existence oracle for assignment ids.
        'forbidden' => 'assignment_not_found',
        'not_active' => 'assignment_not_active',
        'exhausted' => 'assignment_not_active', // unreachable in sync mode (D2 accepts + flags)
        'expired' => 'pack_expired',
        'recently_logged' => 'guard_window',
    ];

    public function __construct(
        private AttendanceCheckInService $checkIns,
        private ServiceSessionService $sessions,
        private BranchQrService $branchQrs,
        private SpecialistQrService $specialistQrs,
        private SpecialistSessionService $specialistSessions,
    ) {}

    /**
     * @param array{device_id: string, app: string, app_version: ?string, events: list<array>} $envelope
     * @return list<array> one result per event, in request order
     */
    public function process(User $actor, array $envelope): array
    {
        $gym = DB::table('gyms')->where('id', $actor->gym_id)->first(['id', 'timezone']);
        $ctx = [
            'actor' => $actor,
            'gym_id' => (string) $actor->gym_id,
            'gym_tz' => $gym->timezone ?? 'UTC',
            'device_id' => strtolower($envelope['device_id']),
            'app' => $envelope['app'],
            'app_version' => $envelope['app_version'] ?? null,
            'received_at' => Carbon::now('UTC'),
        ];

        $results = [];
        foreach ($envelope['events'] as $event) {
            $results[] = $this->processEvent($ctx, $event);
        }
        return $results;
    }

    private function processEvent(array $ctx, array $event): array
    {
        $eventId = strtolower((string) $event['event_id']);
        $hash = hash('sha256', self::canonicalJson($event));

        try {
            return DB::transaction(fn () => $this->processInTransaction($ctx, $event, $eventId, $hash));
        } catch (UniqueConstraintViolationException $e) {
            // A concurrent resend of the same event committed first (only
            // reachable without the pg advisory lock) — replay its result.
            $existing = DB::table('attendance_events')->where('event_id', $eventId)->first();
            if ($existing && $existing->result !== 'error') {
                return $this->compareExisting($ctx, $existing, $hash, false)
                    ?? $this->recordError($ctx, $event, $eventId, $hash, $e);
            }
            report($e);
            return $this->recordError($ctx, $event, $eventId, $hash, $e);
        } catch (\Throwable $e) {
            report($e);
            return $this->recordError($ctx, $event, $eventId, $hash, $e);
        }
    }

    private function processInTransaction(array $ctx, array $event, string $eventId, string $hash): array
    {
        $this->advisoryLock('attendance-event:' . $eventId);

        $existing = DB::table('attendance_events')->where('event_id', $eventId)->lockForUpdate()->first();
        if ($existing) {
            $replay = $this->compareExisting($ctx, $existing, $hash, true);
            if ($replay !== null) {
                return $replay;
            }
            // Stored `error` → re-process below and overwrite the row.
        }

        $outcome = $this->evaluate($ctx, $event, $eventId);
        $processedAt = Carbon::now('UTC');
        $this->persist($ctx, $event, $eventId, $hash, $outcome, $processedAt, $existing);

        return $this->result(
            $eventId, $outcome['status'], $outcome['code'], $outcome['message'],
            $outcome['attendance_id'] ?? null, $outcome['service_log_id'] ?? null, $outcome['flags'] ?? [],
            $ctx['received_at'], $processedAt,
        );
    }

    /**
     * Idempotency decision for an already-stored event. Returns the result
     * to send back, or null when the stored row is an `error` that must be
     * re-processed.
     */
    private function compareExisting(array $ctx, object $existing, string $hash, bool $bumpAttempts): ?array
    {
        $flags = $this->decodeFlags($existing->flags);

        if (strtolower((string) $existing->actor_user_id) !== strtolower((string) $ctx['actor']->id)
            || strtolower((string) $existing->gym_id) !== strtolower($ctx['gym_id'])) {
            // No details: the id belongs to someone else (maybe another tenant).
            $this->recordConflict($ctx, (string) $existing->event_id, $hash, 'event_id_conflict');
            return $this->result($existing->event_id, 'rejected', 'event_id_conflict', self::MESSAGES['event_id_conflict'],
                null, null, [], $ctx['received_at'], Carbon::now('UTC'));
        }
        if (! hash_equals((string) $existing->payload_hash, $hash)) {
            $this->recordConflict($ctx, (string) $existing->event_id, $hash, 'event_id_reused');
            return $this->result($existing->event_id, 'rejected', 'event_id_reused', self::MESSAGES['event_id_reused'],
                null, null, [], $ctx['received_at'], Carbon::now('UTC'));
        }
        if ($existing->result === 'error') {
            return null;
        }

        if ($bumpAttempts) {
            DB::table('attendance_events')->where('event_id', $existing->event_id)->update([
                'attempts' => DB::raw('attempts + 1'),
                'updated_at' => Carbon::now('UTC')->toIso8601String(),
            ]);
        }

        [$status, $code, $message] = $existing->result === 'accepted'
            ? ['duplicate', 'event_replayed', self::MESSAGES['event_replayed']]
            : [$existing->result, $existing->reason_code, $existing->reason_message];

        return $this->result($existing->event_id, $status, $code, $message,
            $existing->attendance_log_id, $existing->service_log_id, $flags,
            Carbon::parse($existing->server_received_at), $existing->processed_at ? Carbon::parse($existing->processed_at) : null);
    }

    /**
     * CONTRACT §6.3: audit an attempt that reuses an existing event_id. The
     * original attendance_events row is never touched. Best effort: a failed
     * audit insert (own savepoint) never fails the sync.
     */
    private function recordConflict(array $ctx, string $eventId, string $hash, string $code): void
    {
        try {
            DB::transaction(fn () => DB::table('attendance_event_conflicts')->insert([
                'id' => (string) Str::uuid(),
                'event_id' => $eventId,
                'reason_code' => $code,
                'gym_id' => $ctx['gym_id'],
                'actor_user_id' => $ctx['actor']->id,
                'actor_type' => Str::limit((string) $ctx['actor']->role, 16, ''),
                'device_id' => $ctx['device_id'],
                'app' => $ctx['app'],
                'app_version' => $ctx['app_version'] !== null ? Str::limit((string) $ctx['app_version'], 32, '') : null,
                'payload_hash' => $hash,
                'server_received_at' => self::isoWithOffset($ctx['received_at']),
                'ip_address' => request()?->ip(),
                'created_at' => Carbon::now('UTC')->toIso8601String(),
            ]));
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /* ── evaluation ─────────────────────────────────────────────── */

    /**
     * Validate + authorize + write the official row. Returns
     * ['status','code','message','attendance_id','service_log_id','flags','derived'=>[...]].
     */
    private function evaluate(array $ctx, array $event, string $eventId): array
    {
        $actor = $ctx['actor'];
        $gymId = $ctx['gym_id'];
        $derived = [
            'kind' => in_array($event['kind'] ?? null, ['attendance', 'service_session'], true) ? $event['kind'] : 'invalid',
            'method' => match (true) {
                ($event['kind'] ?? null) === 'attendance' && in_array($event['attendance_method'] ?? null, ['staff_qr', 'member_qr', 'manual'], true)
                    => $event['attendance_method'],
                // PHASE3 Amendment 2 §C: member scanned the coach QR.
                ($event['kind'] ?? null) === 'service_session' && ($event['attendance_method'] ?? null) === 'member_qr' => 'member_qr',
                default => null,
            },
        ];
        $coachQrScan = $derived['kind'] === 'service_session' && $derived['method'] === 'member_qr';

        $v = Validator::make($event, [
            'kind' => 'required|in:attendance,service_session',
            'attendance_method' => 'required_if:kind,attendance|nullable|in:staff_qr,member_qr,manual',
            'gym_id' => 'required|uuid',
            'branch_id' => 'nullable|uuid',
            'member_id' => 'nullable|uuid|required_if:attendance_method,manual,staff_qr',
            'class_session_id' => 'nullable|uuid',
            'studio_id' => 'nullable|uuid',
            // Coach sessions name the assignment; a member's coach-QR scan
            // (service_session + member_qr) names the trainer, never the pack.
            'service_assignment_id' => $coachQrScan ? 'prohibited' : 'nullable|uuid|required_if:kind,service_session',
            'trainer_id' => $coachQrScan ? 'required|uuid' : 'nullable|uuid',
            'device_recorded_at' => ['required', 'string', 'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|z|[+-]\d{2}:\d{2})$/'],
            'device_timezone' => 'nullable|string|max:64',
            'qr' => 'nullable|array',
            'qr.raw' => ($coachQrScan ? 'required' : 'nullable') . '|string|max:4096',
            'note' => 'nullable|string|max:500',
            'metadata' => 'nullable|array',
        ]);
        if ($v->fails()) {
            return $this->reject('invalid_payload', $derived, $v->errors()->first());
        }
        if (isset($event['metadata']) && strlen((string) json_encode($event['metadata'])) > 4096) {
            return $this->reject('invalid_payload', $derived, 'metadata exceeds 4 KB.');
        }

        try {
            if (! self::isRealTimestamp($event['device_recorded_at'])) {
                throw new \InvalidArgumentException('impossible date');
            }
            $recordedAt = Carbon::parse($event['device_recorded_at'])->utc();
        } catch (\Throwable) {
            return $this->reject('invalid_payload', $derived, 'device_recorded_at is not a valid timestamp.');
        }
        $derived['device_recorded_at'] = $recordedAt;
        $derived['device_timezone'] = $event['device_timezone'] ?? null;

        if (strtolower($event['gym_id']) !== strtolower($gymId)) {
            return $this->reject('tenant_mismatch', $derived);
        }

        $received = $ctx['received_at'];
        if ($recordedAt->gt($received->copy()->addSeconds((int) config('attendance_offline.future_skew_seconds', 300)))) {
            return $this->reject('clock_in_future', $derived);
        }
        if ($recordedAt->lt($received->copy()->subDays((int) config('attendance_offline.max_event_age_days', 7)))) {
            return $this->reject('event_too_old', $derived);
        }

        // CONTRACT §6.2 offline gate. Near-real-time events (within the
        // grace) are online-equivalent and always processed.
        $isOffline = $recordedAt->lt($received->copy()->subSeconds((int) config('attendance_offline.online_grace_seconds', 120)));
        if ($isOffline && ! $this->offlineAllowed($derived)) {
            return $this->reject('offline_disabled', $derived);
        }

        // PHASE3 Amendment 2 §A: the member pass is gone; no client sends staff_qr.
        if ($derived['method'] === 'staff_qr') {
            return $this->reject('qr_invalid', $derived, 'method not supported');
        }
        if ($coachQrScan) {
            return $this->evaluateCoachQrScan($ctx, $event, $eventId, $derived, $recordedAt);
        }
        if ($derived['kind'] === 'service_session') {
            return $this->evaluateServiceSession($ctx, $event, $eventId, $derived, $recordedAt);
        }
        if ($derived['method'] === 'member_qr') {
            return $this->evaluateMemberQr($ctx, $event, $eventId, $derived, $recordedAt);
        }
        return $this->evaluateStaffCheckIn($ctx, $event, $eventId, $derived, $recordedAt);
    }

    private function offlineAllowed(array $derived): bool
    {
        if (! config('attendance_offline.enabled')) {
            return false;
        }
        // A member's coach-QR scan is both a service session and a member QR
        // scan: both flags must allow it (the client package gates the same way).
        if ($derived['kind'] === 'service_session' && $derived['method'] === 'member_qr') {
            return (bool) config('attendance_offline.allow_service_session_offline')
                && (bool) config('attendance_offline.allow_member_qr_offline');
        }
        $flag = match (true) {
            $derived['kind'] === 'service_session' => 'allow_service_session_offline',
            $derived['method'] === 'member_qr' => 'allow_member_qr_offline',
            $derived['method'] === 'staff_qr' => 'allow_staff_qr_offline',
            default => 'allow_manual_offline',
        };
        return (bool) config('attendance_offline.' . $flag);
    }

    /** kind=attendance, method manual | staff_qr (staff / admin / trainer with the attendance module). */
    private function evaluateStaffCheckIn(array $ctx, array $event, string $eventId, array $derived, Carbon $recordedAt): array
    {
        $actor = $ctx['actor'];
        $gymId = $ctx['gym_id'];

        if (! in_array($actor->role, self::ADMIN_ROLES, true) || ! StaffPermission::has($actor, 'attendance')) {
            return $this->reject('permission_denied', $derived);
        }

        $memberId = strtolower($event['member_id']);
        $exists = DB::table('gym_members')->where('id', $memberId)->where('gym_id', $gymId)->whereNull('deleted_at')->exists();
        if (! $exists) {
            return $this->reject('member_not_found', $derived);
        }
        $derived['gym_member_id'] = $memberId;

        $branch = null;
        if (! empty($event['branch_id'])) {
            $branch = DB::table('branches')->where('id', strtolower($event['branch_id']))->where('gym_id', $gymId)->first(['id', 'name']);
            if (! $branch) {
                return $this->reject('branch_not_found', $derived);
            }
            $derived['branch_id'] = $branch->id;
        }
        $className = null;
        if (! empty($event['class_session_id'])) {
            $session = DB::table('class_sessions as cs')
                ->leftJoin('classes as c', 'c.id', '=', 'cs.class_id')
                ->where('cs.id', strtolower($event['class_session_id']))->where('cs.gym_id', $gymId)
                ->first(['cs.id', 'c.name']);
            if (! $session) {
                return $this->reject('class_session_not_found', $derived);
            }
            $derived['class_session_id'] = $session->id;
            $className = $session->name;
        }
        if (! empty($event['studio_id'])) {
            $studio = DB::table('studios')->where('id', strtolower($event['studio_id']))->where('gym_id', $gymId)->value('id');
            if (! $studio) {
                return $this->reject('studio_not_found', $derived);
            }
            $derived['studio_id'] = $studio;
        }

        $this->advisoryLock('attendance-member:' . $memberId);

        $accessPoint = isset($derived['class_session_id'])
            ? ($className ?? 'Class')
            : ($branch->name ?? 'Gym Access');

        $r = $this->checkIns->checkIn($actor, $gymId, $memberId, [
            'class_session_id' => $derived['class_session_id'] ?? null,
            'branch_id' => $derived['branch_id'] ?? null,
            'studio_id' => $derived['studio_id'] ?? null,
            // D6: official method keeps the existing vocabulary.
            'method' => $derived['method'] === 'staff_qr' ? 'qr' : 'manual',
            'access_point' => $accessPoint,
            'check_in_at' => self::isoWithOffset($recordedAt),
            'as_of' => $recordedAt,
            'gym_timezone' => $ctx['gym_tz'],
            'allow_exhausted' => true,
            'source_event_id' => $eventId,
            'recorded_by' => $actor->id,
            'activity_suffix' => ' (offline)',
            'activity_details' => [
                'source' => 'offline_sync', 'event_id' => $eventId, 'method' => $derived['method'],
                'device_id' => $ctx['device_id'], 'device_recorded_at' => self::iso($recordedAt),
            ],
        ]);

        if ($r['ok']) {
            return $this->accept($derived, attendanceId: $r['attendance_id'], flags: $r['flags']);
        }
        if ($r['code'] === 'already_checked_in') {
            return ['status' => 'duplicate', 'code' => 'already_checked_in', 'message' => $r['message'] . '.',
                'attendance_id' => $r['existing_attendance_id'], 'service_log_id' => null, 'flags' => [], 'derived' => $derived];
        }
        return $this->reject($r['code'], $derived, $r['message'] . '.');
    }

    /** kind=attendance, method member_qr (member scans the branch QR; v1 token in Phase 1). */
    private function evaluateMemberQr(array $ctx, array $event, string $eventId, array $derived, Carbon $recordedAt): array
    {
        $actor = $ctx['actor'];
        $gymId = $ctx['gym_id'];

        if (in_array($actor->role, self::ADMIN_ROLES, true)) {
            return $this->reject('permission_denied', $derived);
        }

        // Forced to self: whatever member_id the client sent is ignored.
        $memberId = DB::table('gym_members')
            ->where('user_id', $actor->id)->where('gym_id', $gymId)->whereNull('deleted_at')
            ->value('id');
        if (! $memberId) {
            return $this->reject('member_not_found', $derived);
        }
        $derived['gym_member_id'] = $memberId;

        $raw = is_string($event['qr']['raw'] ?? null) ? $event['qr']['raw'] : null;
        if (BranchQrService::isV2($raw)) {
            return $this->evaluateMemberQrV2($ctx, $raw, $eventId, $derived, $recordedAt, $memberId);
        }

        // PHASE3-CONTRACT D3: unsigned v1 QRs stay online-only. An offline
        // v1 event (older than online_grace_seconds) is refused even when
        // allow_member_qr_offline is on; near-real-time v1 events behave as
        // in Phase 1 (= the online /attendance/qr rules).
        if ($this->isOffline($ctx, $recordedAt)) {
            $derived['qr_meta'] = ['verified' => false, 'reason' => 'offline_disabled', 'v' => 1];
            return $this->reject('offline_disabled', $derived, 'Offline check-in needs a signed (v2) gym QR code.');
        }

        [$token, $format] = self::parseBranchQr($raw);
        if (! $token) {
            $derived['qr_meta'] = ['format' => $format];
            return $this->reject('qr_invalid', $derived);
        }
        $branch = DB::table('branches')->where('qr_token', $token)->first(['id', 'gym_id', 'name', 'is_active']);
        $derived['qr_meta'] = ['format' => $format, 'v' => 1];
        if (! $branch) {
            return $this->reject('qr_invalid', $derived);
        }
        if (strtolower((string) $branch->gym_id) !== strtolower($gymId)) {
            return $this->reject('qr_wrong_gym', $derived);
        }
        $derived['branch_id'] = $branch->id;
        $derived['qr_meta']['branch_id'] = $branch->id;
        if (! $branch->is_active) {
            return $this->reject('branch_inactive', $derived);
        }

        $this->advisoryLock('attendance-member:' . $memberId);

        if ($denied = $this->checkIns->gymEntryDenialForBranch($memberId, $branch)) {
            return $this->reject($denied, $derived);
        }

        $id = $this->checkIns->recordGymEntry($gymId, $memberId, $branch, self::isoWithOffset($recordedAt), $eventId, $actor->id);
        return $this->accept($derived, attendanceId: $id);
    }

    /**
     * member_qr with a signed branch QR v2 (PHASE3-CONTRACT §2): server
     * verification at device_recorded_at, gym-entry rules, and rotating
     * replay protection per (jti, member).
     */
    private function evaluateMemberQrV2(array $ctx, string $raw, string $eventId, array $derived, Carbon $recordedAt, string $memberId): array
    {
        $gymId = $ctx['gym_id'];
        $r = $this->branchQrs->verify($raw, $gymId, $recordedAt);
        if (! $r['ok']) {
            $derived['qr_meta'] = ['verified' => false, 'reason' => $r['code'], 'v' => 2];
            return $this->reject($r['code'], $derived);
        }
        $q = $r['qr'];
        $branch = $r['branch'];
        $derived['branch_id'] = $branch->id;
        $derived['qr_meta'] = ['verified' => true, 'v' => 2, 'mode' => $q['mode'], 'kid' => $q['kid'], 'jti' => $q['jti'],
            'iat' => $q['iat'], 'exp' => $q['exp'], 'branch_id' => $branch->id];

        $this->advisoryLock('attendance-member:' . $memberId);

        if ($q['mode'] === 'rotating') {
            $prior = DB::table('attendance_qr_redemptions')
                ->where('jti', $q['jti'])->where('gym_member_id', $memberId)
                ->first(['attendance_log_id']);
            if ($prior) {
                return ['status' => 'duplicate', 'code' => 'qr_replayed', 'message' => self::MESSAGES['qr_replayed'],
                    'attendance_id' => $prior->attendance_log_id, 'service_log_id' => null, 'flags' => [], 'derived' => $derived];
            }
        }

        if ($denied = $this->checkIns->gymEntryDenialForBranch($memberId, $branch)) {
            return $this->reject($denied, $derived);
        }

        $id = $this->checkIns->recordGymEntry($gymId, $memberId, $branch, self::isoWithOffset($recordedAt), $eventId, $ctx['actor']->id);

        if ($q['mode'] === 'rotating') {
            // UNIQUE (jti, gym_member_id) backstops the locked check above.
            DB::table('attendance_qr_redemptions')->insert([
                'id' => (string) Str::uuid(),
                'gym_id' => $gymId,
                'jti' => $q['jti'],
                'gym_member_id' => $memberId,
                'event_id' => $eventId,
                'attendance_log_id' => $id,
                'branch_id' => $branch->id,
                'qr_exp' => self::isoWithOffset(Carbon::createFromTimestampUTC($q['exp'])),
                'created_at' => Carbon::now('UTC')->toIso8601String(),
            ]);
        }

        return $this->accept($derived, attendanceId: $id);
    }

    /**
     * kind=service_session + method=member_qr (PHASE3 Amendment 2 §C): the
     * MEMBER scanned the coach's QR. Actor forced to self; the QR is verified
     * as of device_recorded_at, then the online SpecialistScanController rules
     * run through SpecialistSessionService (shared code) as of device time.
     */
    private function evaluateCoachQrScan(array $ctx, array $event, string $eventId, array $derived, Carbon $recordedAt): array
    {
        $actor = $ctx['actor'];
        $gymId = $ctx['gym_id'];

        if (in_array($actor->role, self::ADMIN_ROLES, true)) {
            return $this->reject('permission_denied', $derived);
        }
        // Self only: the client's member_id is ignored.
        $memberId = DB::table('gym_members')
            ->where('user_id', $actor->id)->where('gym_id', $gymId)->whereNull('deleted_at')
            ->value('id');
        if (! $memberId) {
            return $this->reject('member_not_found', $derived);
        }
        $derived['gym_member_id'] = $memberId;
        $trainerId = strtolower($event['trainer_id']);
        $raw = $event['qr']['raw'];

        if (SpecialistQrService::isV2($raw)) {
            $r = $this->specialistQrs->verify($raw, $gymId, $recordedAt);
            if (! $r['ok']) {
                $derived['qr_meta'] = ['verified' => false, 'reason' => $r['code'], 'v' => 2];
                return $this->reject($r['code'], $derived);
            }
            if ($r['qr']['trainer_id'] !== $trainerId) {
                $derived['qr_meta'] = ['verified' => false, 'reason' => 'qr_invalid', 'v' => 2];
                return $this->reject('qr_invalid', $derived, 'trainer_id does not match the scanned QR.');
            }
            $q = $r['qr'];
            $derived['qr_meta'] = ['verified' => true, 'v' => 2, 'kid' => $q['kid'], 'jti' => $q['jti'],
                'iat' => $q['iat'], 'exp' => $q['exp'], 'trainer_id' => $q['trainer_id']];
        } else {
            // Unsigned v1 coach QR: online-only, like the v1 gym QR (D3).
            if ($this->isOffline($ctx, $recordedAt)) {
                $derived['qr_meta'] = ['verified' => false, 'reason' => 'offline_disabled', 'v' => 1];
                return $this->reject('offline_disabled', $derived, 'Offline coach sessions need a signed (v2) coach QR code.');
            }
            $v1 = json_decode($raw, true);
            if (! is_array($v1) || ($v1['type'] ?? null) !== 'specialist_session'
                || ! is_string($v1['trainer_id'] ?? null) || strtolower($v1['trainer_id']) !== $trainerId
                || ! is_string($v1['gym_id'] ?? null) || strtolower($v1['gym_id']) !== strtolower($gymId)) {
                $derived['qr_meta'] = ['verified' => false, 'reason' => 'qr_invalid', 'v' => 1];
                return $this->reject('qr_invalid', $derived);
            }
            $exists = DB::table('trainer_profiles')->where('id', $trainerId)->where('gym_id', $gymId)->exists();
            if (! $exists) {
                return $this->reject('qr_invalid', $derived);
            }
            $derived['qr_meta'] = ['verified' => false, 'reason' => 'unsigned_v1_online', 'v' => 1];
        }

        $this->advisoryLock('attendance-member:' . $memberId);

        $r = $this->specialistSessions->memberScan($gymId, $memberId, $trainerId, [], [
            'at' => $recordedAt,
            'source_event_id' => $eventId,
        ]);
        if (isset($r['error'])) {
            $e = $r['error'];
            if ($e['code'] === 'recently_logged') {
                // Inside the 30-min guard: the visit is already recorded.
                return ['status' => 'duplicate', 'code' => 'recently_logged', 'message' => $e['message'],
                    'attendance_id' => null, 'service_log_id' => $e['log_id'], 'flags' => [], 'derived' => $derived];
            }
            return $this->reject($e['code'], $derived, $e['message']);
        }
        $derived['service_assignment_id'] = $r['data']['assignment_id'];
        return $this->accept($derived, serviceLogId: $r['data']['log_id'], flags: $r['flags']);
    }

    private function isOffline(array $ctx, Carbon $recordedAt): bool
    {
        return $recordedAt->lt($ctx['received_at']->copy()->subSeconds((int) config('attendance_offline.online_grace_seconds', 120)));
    }

    /** kind=service_session (coach: role trainer + active trainer_profile — the `coach` middleware rules). */
    private function evaluateServiceSession(array $ctx, array $event, string $eventId, array $derived, Carbon $recordedAt): array
    {
        $actor = $ctx['actor'];
        $gymId = $ctx['gym_id'];

        $coach = $actor->role === 'trainer' && $actor->is_active && $actor->deleted_at === null
            ? DB::table('trainer_profiles')->where('profile_id', $actor->id)->where('gym_id', $gymId)->where('is_active', true)->first(['id', 'name'])
            : null;
        if (! $coach) {
            return $this->reject('permission_denied', $derived);
        }

        $assignment = DB::table('member_service_assignments')
            ->where('id', strtolower($event['service_assignment_id']))->where('gym_id', $gymId)
            ->first(['id', 'trainer_id', 'gym_member_id', 'service_type', 'package_name']);
        if (! $assignment) {
            return $this->reject('assignment_not_found', $derived);
        }
        $derived['service_assignment_id'] = $assignment->id;
        if ($assignment->trainer_id !== $coach->id) {
            // Same code + message as a missing assignment (no existence oracle).
            unset($derived['service_assignment_id']);
            return $this->reject('assignment_not_found', $derived);
        }
        if (! empty($event['member_id']) && strtolower($event['member_id']) !== strtolower($assignment->gym_member_id)) {
            return $this->reject('invalid_payload', $derived, 'member_id does not match the assignment.');
        }
        $derived['gym_member_id'] = $assignment->gym_member_id;

        $this->advisoryLock('attendance-member:' . $assignment->gym_member_id);

        $r = $this->sessions->deliver($coach->id, $gymId, $assignment->id, $event['note'] ?? null, [
            'at' => $recordedAt,
            'source_event_id' => $eventId,
        ]);
        if (isset($r['error'])) {
            $code = self::SERVICE_CODES[$r['error']['code']] ?? 'assignment_not_active';
            return $this->reject($code, $derived, $code === 'assignment_not_found' ? null : $r['error']['message']);
        }

        $logId = $r['data']['log_id'];
        $memberName = DB::table('gym_members as gm')->leftJoin('profiles as p', 'p.id', '=', 'gm.user_id')
            ->where('gm.id', $assignment->gym_member_id)->value('p.full_name') ?? 'Unknown';
        $this->logActivity(
            $gymId, $actor->id, 'create', 'services',
            "{$actor->full_name} logged a {$assignment->package_name} session for {$memberName} (offline)"
                . ($r['flags'] ? ' — pack exhausted, flagged for review' : ''),
            'service_session_logs', $logId,
            ['source' => 'offline_sync', 'event_id' => $eventId, 'assignment_id' => $assignment->id,
             'device_id' => $ctx['device_id'], 'device_recorded_at' => self::iso($recordedAt), 'flags' => $r['flags']],
        );

        return $this->accept($derived, serviceLogId: $logId, flags: $r['flags']);
    }

    /* ── persistence ────────────────────────────────────────────── */

    private function persist(array $ctx, array $event, string $eventId, string $hash, array $outcome, Carbon $processedAt, ?object $existing): void
    {
        $row = $this->eventRow($ctx, $event, $hash, $outcome['derived'] ?? [], [
            'processed_at' => self::isoWithOffset($processedAt),
            'result' => $outcome['status'],
            'reason_code' => $outcome['code'],
            'reason_message' => $outcome['message'],
            'retryable' => false,
            'attendance_log_id' => $outcome['attendance_id'] ?? null,
            'service_log_id' => $outcome['service_log_id'] ?? null,
            'flags' => $outcome['flags'] ?? [],
        ]);

        if ($existing) {
            unset($row['event_id'], $row['created_at']);
            $row['attempts'] = DB::raw('attempts + 1');
            DB::table('attendance_events')->where('event_id', $eventId)->update($row);
        } else {
            DB::table('attendance_events')->insert($row + ['event_id' => $eventId]);
        }
    }

    /** Record an unexpected failure as a retryable `error`, in its own small transaction. */
    private function recordError(array $ctx, array $event, string $eventId, string $hash, \Throwable $e): array
    {
        try {
            DB::transaction(function () use ($ctx, $event, $eventId, $hash, $e) {
                $existing = DB::table('attendance_events')->where('event_id', $eventId)->lockForUpdate()->first();
                $row = $this->eventRow($ctx, $event, $hash, [], [
                    'processed_at' => null,
                    'result' => 'error',
                    'reason_code' => 'server_error',
                    'reason_message' => Str::limit(class_basename($e) . ': ' . $e->getMessage(), 500),
                    'retryable' => true,
                    'attendance_log_id' => null,
                    'service_log_id' => null,
                    'flags' => [],
                ]);
                if (! $existing) {
                    DB::table('attendance_events')->insert($row + ['event_id' => $eventId]);
                } elseif ($existing->result === 'error') {
                    unset($row['created_at']);
                    $row['attempts'] = DB::raw('attempts + 1');
                    DB::table('attendance_events')->where('event_id', $eventId)->update($row);
                }
                // else: a concurrent request committed a real result; the
                // client's retry will replay it.
            });
        } catch (\Throwable $inner) {
            report($inner);
        }

        return $this->result($eventId, 'error', 'server_error', self::MESSAGES['server_error'],
            null, null, [], $ctx['received_at'], null);
    }

    private function eventRow(array $ctx, array $event, string $hash, array $derived, array $outcome): array
    {
        $actor = $ctx['actor'];
        $now = Carbon::now('UTC')->toIso8601String();
        $recordedAt = $derived['device_recorded_at'] ?? null;
        $flags = array_values($outcome['flags']);
        $tz = $derived['device_timezone'] ?? (is_string($event['device_timezone'] ?? null) ? $event['device_timezone'] : null);

        return [
            'kind' => $derived['kind'] ?? (in_array($event['kind'] ?? null, ['attendance', 'service_session'], true) ? $event['kind'] : 'invalid'),
            'method' => $derived['method'] ?? null,
            'gym_id' => $ctx['gym_id'],
            'branch_id' => $derived['branch_id'] ?? null,
            'gym_member_id' => $derived['gym_member_id'] ?? null,
            'class_session_id' => $derived['class_session_id'] ?? null,
            'studio_id' => $derived['studio_id'] ?? null,
            'service_assignment_id' => $derived['service_assignment_id'] ?? null,
            'actor_user_id' => $actor->id,
            'actor_type' => Str::limit((string) $actor->role, 16, ''),
            'device_id' => $ctx['device_id'],
            'app' => $ctx['app'],
            'app_version' => $ctx['app_version'] !== null ? Str::limit((string) $ctx['app_version'], 32, '') : null,
            'device_recorded_at' => $recordedAt ? self::isoWithOffset($recordedAt) : null,
            'device_timezone' => $tz !== null ? Str::limit($tz, 64, '') : null,
            'server_received_at' => self::isoWithOffset($ctx['received_at']),
            'processed_at' => $outcome['processed_at'],
            'result' => $outcome['result'],
            'reason_code' => $outcome['reason_code'],
            'reason_message' => $outcome['reason_message'],
            'retryable' => $outcome['retryable'],
            'attendance_log_id' => $outcome['attendance_log_id'],
            'service_log_id' => $outcome['service_log_id'],
            'flags' => json_encode($flags),
            'needs_review' => $flags !== [],
            'payload_hash' => $hash,
            'qr_meta' => isset($derived['qr_meta']) ? json_encode($derived['qr_meta']) : null,
            // Client metadata (never trusted) + the ids the client CLAIMED,
            // kept for auditing rejections (the columns hold only verified ids).
            'metadata' => json_encode([
                'client' => is_array($event['metadata'] ?? null) ? $event['metadata'] : null,
                'claimed' => array_filter([
                    'gym_id' => $event['gym_id'] ?? null,
                    'branch_id' => $event['branch_id'] ?? null,
                    'member_id' => $event['member_id'] ?? null,
                    'class_session_id' => $event['class_session_id'] ?? null,
                    'studio_id' => $event['studio_id'] ?? null,
                    'service_assignment_id' => $event['service_assignment_id'] ?? null,
                ], fn ($v) => is_string($v) && strlen($v) <= 64),
            ]),
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    /* ── helpers ────────────────────────────────────────────────── */

    private function accept(array $derived, ?string $attendanceId = null, ?string $serviceLogId = null, array $flags = []): array
    {
        return ['status' => 'accepted', 'code' => 'created', 'message' => self::MESSAGES['created'],
            'attendance_id' => $attendanceId, 'service_log_id' => $serviceLogId, 'flags' => array_values($flags), 'derived' => $derived];
    }

    private function reject(string $code, array $derived, ?string $message = null): array
    {
        return ['status' => 'rejected', 'code' => $code, 'message' => $message ?? (self::MESSAGES[$code] ?? $code),
            'attendance_id' => null, 'service_log_id' => null, 'flags' => [], 'derived' => $derived];
    }

    private function result(string $eventId, string $status, string $code, ?string $message, ?string $attendanceId,
        ?string $serviceLogId, array $flags, Carbon $receivedAt, ?Carbon $processedAt): array
    {
        return [
            'event_id' => $eventId,
            'status' => $status,
            'code' => $code,
            'message' => $message,
            'attendance_id' => $attendanceId,
            'service_log_id' => $serviceLogId,
            'flags' => array_values($flags),
            'server_received_at' => self::iso($receivedAt),
            'processed_at' => $processedAt ? self::iso($processedAt) : null,
            'retryable' => $status === 'error',
        ];
    }

    private function decodeFlags(mixed $flags): array
    {
        if (is_array($flags)) return array_values($flags);
        $decoded = is_string($flags) ? json_decode($flags, true) : null;
        return is_array($decoded) ? array_values($decoded) : [];
    }

    private function advisoryLock(string $key): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$key]);
        }
    }

    /**
     * v1 branch QR → its token. Accepts the JSON poster payload
     * {type:'gym_access', gym_id, branch_id, token} or a bare token uuid.
     * Legacy token-less payloads ("gym:<id>", JSON without token) can't be
     * validated server-side and are rejected as qr_invalid.
     *
     * @return array{0: ?string, 1: string} [token|null, format]
     */
    public static function parseBranchQr(?string $raw): array
    {
        $raw = trim((string) $raw);
        if ($raw === '') return [null, 'empty'];
        if (Str::isUuid($raw)) return [strtolower($raw), 'v1_token'];

        $json = json_decode($raw, true);
        if (is_array($json)) {
            if (($json['type'] ?? null) === 'gym_access' && is_string($json['token'] ?? null) && Str::isUuid($json['token'])) {
                return [strtolower($json['token']), 'v1_json'];
            }
            return [null, 'json_unsupported'];
        }
        return [null, 'unsupported'];
    }

    /**
     * Rejects calendar-impossible values the regex lets through (e.g.
     * 2026-02-30, 25:00, offset +15:00) instead of letting Carbon roll them
     * over into another day.
     */
    public static function isRealTimestamp(string $value): bool
    {
        if (! preg_match('/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/', $value, $m)) {
            return false;
        }
        if (! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return false;
        }
        if ((int) $m[4] > 23 || (int) $m[5] > 59 || (int) $m[6] > 59) {
            return false;
        }
        if (isset($m[8]) && $m[8] !== '' && ((int) $m[8] > 14 || (int) $m[9] > 59)) {
            return false;
        }
        return true;
    }

    /** sha256 input: recursively key-sorted JSON of the client event. */
    public static function canonicalJson(mixed $value): string
    {
        return (string) json_encode(self::canonicalize($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    }

    private static function canonicalize(mixed $value): mixed
    {
        if (! is_array($value)) return $value;
        if (! array_is_list($value)) ksort($value, SORT_STRING);
        return array_map(fn ($v) => self::canonicalize($v), $value);
    }

    /** Contract timestamp format: UTC, millisecond precision. */
    public static function iso(Carbon $t): string
    {
        return $t->copy()->utc()->format('Y-m-d\TH:i:s.v\Z');
    }

    /** For DB writes: explicit offset so Postgres' session TZ can't shift it. */
    public static function isoWithOffset(Carbon $t): string
    {
        return $t->copy()->utc()->format('Y-m-d\TH:i:s.vP');
    }
}
