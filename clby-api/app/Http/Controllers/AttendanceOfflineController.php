<?php

namespace App\Http\Controllers;

use App\Services\AttendanceCheckInService;
use App\Services\AttendanceSyncService;
use App\Services\MemberPassService;
use App\Services\StaffPermission;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Offline attendance endpoints (docs/offline-attendance/CONTRACT.md §2–3).
 *
 * Mounted in the members+staff route group (auth:sanctum, RequireGymId,
 * verified_member, LogActivityMiddleware) because members, staff and
 * coaches all sync; what each role may do is enforced here / per event.
 */
class AttendanceOfflineController extends Controller
{
    private const ADMIN_ROLES = ['gym_admin', 'staff', 'trainer', 'super_admin'];

    /* ── POST /api/attendance/sync ──────────────────────────────── */

    public function sync(Request $request, AttendanceSyncService $sync): JsonResponse
    {
        $max = (int) config('attendance_offline.max_batch', 50);
        $request->validate([
            'device_id' => 'required|uuid',
            'app' => 'required|in:admin,coach,member',
            'app_version' => 'nullable|string|max:32',
            'events' => "required|array|min:1|max:{$max}",
            'events.*' => 'required|array',
            'events.*.event_id' => 'required|uuid|distinct:ignore_case',
        ]);

        $user = $request->user();
        $deviceId = strtolower($request->input('device_id'));

        if ($denied = $this->bindDevice($request, $deviceId)) {
            return $denied;
        }

        $results = $sync->process($user, [
            'device_id' => $deviceId,
            'app' => $request->input('app'),
            'app_version' => $request->input('app_version'),
            'events' => array_values($request->input('events')),
        ]);

        return response()->json([
            'server_time' => AttendanceSyncService::iso(Carbon::now('UTC')),
            'results' => $results,
        ]);
    }

    /**
     * CONTRACT §6.1: register the (device_id, user) pair on first sight. A
     * device may be shared by several accounts; each pair is independent.
     * 403 device_mismatch only when the same user presents the device for a
     * different gym; 403 device_revoked when that pair was revoked.
     */
    private function bindDevice(Request $request, string $deviceId): ?JsonResponse
    {
        $user = $request->user();
        $now = Carbon::now('UTC')->toIso8601String();
        $platform = $request->header('X-App-Platform');
        $pair = fn () => DB::table('attendance_devices')->where('device_id', $deviceId)->where('user_id', $user->id)->first();

        $device = $pair();
        if (! $device) {
            DB::table('attendance_devices')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'device_id' => $deviceId,
                'gym_id' => $user->gym_id,
                'user_id' => $user->id,
                'app' => $request->input('app'),
                'platform' => $platform ? Str::limit($platform, 16, '') : null,
                'app_version' => $request->input('app_version'),
                'first_seen_at' => $now,
                'last_seen_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            // Re-read: a concurrent first sync of the same pair may have won.
            $device = $pair();
        }

        if (strtolower((string) $device->gym_id) !== strtolower((string) $user->gym_id)) {
            return response()->json([
                'error' => 'This device is registered to this account for a different gym.',
                'code' => 'device_mismatch',
            ], 403);
        }
        if ($device->revoked_at !== null) {
            return response()->json([
                'error' => 'This device has been revoked for offline attendance.',
                'code' => 'device_revoked',
            ], 403);
        }

        DB::table('attendance_devices')->where('id', $device->id)->update(array_filter([
            'app' => $request->input('app'),
            'platform' => $platform ? Str::limit($platform, 16, '') : null,
            'app_version' => $request->input('app_version'),
            'last_seen_at' => $now,
            'last_sync_at' => $now,
            'updated_at' => $now,
        ], fn ($v) => $v !== null));

        return null;
    }

    /* ── GET /api/attendance/offline/status ─────────────────────── */

    public function status(Request $request): JsonResponse
    {
        $request->validate(['device_id' => 'nullable|uuid']);
        $user = $request->user();

        $registered = false;
        $revoked = false;
        if ($deviceId = $request->query('device_id') ?? $request->header('X-Device-Id')) {
            if (Str::isUuid($deviceId)) {
                $device = DB::table('attendance_devices')
                    ->where('device_id', strtolower($deviceId))
                    ->where('user_id', $user->id)
                    ->where('gym_id', $user->gym_id)
                    ->first(['revoked_at']);
                $registered = (bool) $device;
                $revoked = $device && $device->revoked_at !== null;
            }
        }

        return response()->json([
            'server_time' => $this->now(),
            'enabled' => (bool) config('attendance_offline.enabled'),
            'policy' => self::policy(),
            'device' => ['registered' => $registered, 'revoked' => $revoked],
        ]);
    }

    /* ── GET /api/attendance/offline/bootstrap ──────────────────── */

    public function bootstrap(Request $request): JsonResponse
    {
        $request->validate([
            'cursor' => 'nullable|uuid',
            'limit' => 'nullable|integer|min:1|max:1000',
            'app' => 'nullable|in:admin,coach,member',
        ]);
        $user = $request->user();

        if (! in_array($user->role, self::ADMIN_ROLES, true)) {
            return response()->json([
                'error' => 'Members use GET /api/attendance/offline/me.',
                'code' => 'permission_denied',
            ], 403);
        }

        $app = $request->query('app') ?? $request->header('X-App');
        $coach = $this->coachProfile($user);
        $wantsCoach = $app === 'coach' || ($app !== 'admin' && $coach !== null);

        if ($wantsCoach) {
            if (! $coach) {
                return response()->json([
                    'error' => 'Coach snapshot requires an active specialist profile.',
                    'code' => 'permission_denied',
                ], 403);
            }
            return $this->coachBootstrap($request, $coach);
        }

        if (! StaffPermission::has($user, 'attendance')) {
            return response()->json([
                'error' => 'Forbidden — insufficient permissions',
                'code' => 'permission_denied',
                'required' => 'attendance',
            ], 403);
        }
        return $this->adminBootstrap($request);
    }

    private function adminBootstrap(Request $request): JsonResponse
    {
        $user = $request->user();
        $gym = $this->gym($user->gym_id);
        $limit = (int) ($request->query('limit') ?? 500);
        $cursor = $request->query('cursor') ? strtolower($request->query('cursor')) : null;
        $asOf = $this->now();

        $rows = DB::table('gym_members as gm')
            ->leftJoin('profiles as p', 'p.id', '=', 'gm.user_id')
            ->where('gm.gym_id', $user->gym_id)
            ->whereNull('gm.deleted_at')
            ->when($cursor, fn ($q) => $q->where('gm.id', '>', $cursor))
            ->orderBy('gm.id')
            ->limit($limit + 1)
            ->get(['gm.id', 'gm.member_number', 'gm.status', 'p.full_name', 'p.phone', 'p.photo_url']);

        $nextCursor = null;
        if ($rows->count() > $limit) {
            $rows = $rows->slice(0, $limit)->values();
            $nextCursor = $rows->last()->id;
        }

        $buckets = $this->buckets($rows->pluck('id')->all())->groupBy('gym_member_id');

        $members = $rows->map(fn ($r) => [
            'gym_member_id' => $r->id,
            'member_number' => $r->member_number !== null ? (int) $r->member_number : null,
            'full_name' => $r->full_name,
            'phone_last4' => self::last4($r->phone),
            'photo_url' => $r->photo_url,
            'status' => $r->status,
            'buckets' => ($buckets[$r->id] ?? collect())->map(fn ($b) => $this->bucketShape($b, $gym['timezone']))->values(),
        ])->values();

        $payload = [
            'server_time' => $asOf,
            'as_of' => $asOf,
            'gym' => $gym,
            'policy' => self::policy(),
            'members' => $members,
            'next_cursor' => $nextCursor,
        ];
        if ($cursor !== null) {
            // Later pages carry members only; branches / class_sessions /
            // recent_attendance are sent once, on the first page.
            return response()->json($payload);
        }

        // Class sessions yesterday → +7 days (gym-local dates).
        $tz = $gym['timezone'];
        $today = Carbon::now($tz);
        $sessions = DB::table('class_sessions as cs')
            ->leftJoin('classes as c', 'c.id', '=', 'cs.class_id')
            ->where('cs.gym_id', $user->gym_id)
            ->whereBetween('cs.session_date', [$today->copy()->subDay()->toDateString(), $today->copy()->addDays(7)->toDateString()])
            ->where('cs.status', '<>', 'cancelled')
            ->orderBy('cs.session_date')->orderBy('cs.start_time')
            ->get(['cs.id', 'cs.class_id', 'c.name', 'cs.branch_id', 'cs.studio_id', 'cs.session_date', 'cs.start_time', 'cs.end_time'])
            ->map(fn ($s) => [
                'id' => $s->id,
                'class_id' => $s->class_id,
                'name' => $s->name,
                'branch_id' => $s->branch_id,
                'studio_id' => $s->studio_id,
                'starts_at' => $this->localIso($s->session_date, $s->start_time, $tz),
                'ends_at' => $this->localIso($s->session_date, $s->end_time, $tz),
            ])->values();

        $recent = DB::table('attendance_logs')
            ->where('gym_id', $user->gym_id)
            ->where('check_in_at', '>=', Carbon::now('UTC')->subHours(48)->toIso8601String())
            ->orderByDesc('check_in_at')
            ->limit(10000)
            ->get(['id', 'gym_member_id', 'class_session_id', 'branch_id', 'check_in_at'])
            ->map(fn ($a) => $this->attendanceShape($a))->values();

        return response()->json([
            'server_time' => $asOf,
            'as_of' => $asOf,
            'gym' => $gym,
            'policy' => self::policy(),
            'branches' => $this->branches($user->gym_id),
            'members' => $members,
            'class_sessions' => $sessions,
            'recent_attendance' => $recent,
            'pass_keys' => app(MemberPassService::class)->passKeys($user->gym_id),
            'next_cursor' => $nextCursor,
        ]);
    }

    private function coachBootstrap(Request $request, object $coach): JsonResponse
    {
        $user = $request->user();
        $limit = (int) ($request->query('limit') ?? 500);
        $cursor = $request->query('cursor') ? strtolower($request->query('cursor')) : null;
        $asOf = $this->now();

        // Scoped to this coach (not the whole table).
        $lastSessionSub = DB::table('service_session_logs')
            ->where('trainer_id', $coach->id)
            ->select('assignment_id', DB::raw('MAX(delivered_at) AS last_at'))
            ->groupBy('assignment_id');

        $rows = DB::table('member_service_assignments as a')
            ->leftJoin('gym_members as gm', 'gm.id', '=', 'a.gym_member_id')
            ->leftJoin('profiles as p', 'p.id', '=', 'gm.user_id')
            ->leftJoinSub($lastSessionSub, 'ls', 'ls.assignment_id', '=', 'a.id')
            ->where('a.gym_id', $user->gym_id)
            ->where('a.trainer_id', $coach->id)
            ->when($cursor, fn ($q) => $q->where('a.id', '>', $cursor))
            ->orderBy('a.id')
            ->limit($limit + 1)
            ->get([
                'a.id', 'a.gym_member_id', 'p.full_name', 'gm.member_number', 'p.photo_url', 'a.service_type',
                'a.package_name', 'a.sessions_total', 'a.sessions_used', 'a.status', 'a.expires_at', 'ls.last_at',
            ]);

        $nextCursor = null;
        if ($rows->count() > $limit) {
            $rows = $rows->slice(0, $limit)->values();
            $nextCursor = $rows->last()->id;
        }

        $assignments = $rows->map(fn ($r) => [
            'assignment_id' => $r->id,
            'gym_member_id' => $r->gym_member_id,
            'member_name' => $r->full_name,
            'member_number' => $r->member_number !== null ? (int) $r->member_number : null,
            'photo_url' => $r->photo_url,
            'service_type' => $r->service_type,
            'package_name' => $r->package_name,
            'sessions_total' => (int) $r->sessions_total,
            'sessions_used' => (int) $r->sessions_used,
            'status' => $r->status,
            'expires_at' => $this->isoOrNull($r->expires_at),
            'last_session_at' => $this->isoOrNull($r->last_at),
        ])->values();

        $base = [
            'server_time' => $asOf,
            'as_of' => $asOf,
            'gym' => $this->gym($user->gym_id),
            'policy' => self::policy(),
            'assignments' => $assignments,
        ];
        if ($cursor !== null) {
            // Later pages carry assignments only (recent_service_logs: first page).
            return response()->json($base + ['next_cursor' => $nextCursor]);
        }

        $recent = DB::table('service_session_logs')
            ->where('gym_id', $user->gym_id)
            ->where('trainer_id', $coach->id)
            ->where('delivered_at', '>=', Carbon::now('UTC')->subHours(48)->toIso8601String())
            ->orderByDesc('delivered_at')
            ->get(['id', 'assignment_id', 'delivered_at'])
            ->map(fn ($l) => [
                'service_log_id' => $l->id,
                'assignment_id' => $l->assignment_id,
                'logged_at' => $this->isoOrNull($l->delivered_at),
            ])->values();

        return response()->json([
            'server_time' => $asOf,
            'as_of' => $asOf,
            'gym' => $this->gym($user->gym_id),
            'policy' => self::policy(),
            'assignments' => $assignments,
            'recent_service_logs' => $recent,
            'pass_keys' => app(MemberPassService::class)->passKeys($user->gym_id),
            'next_cursor' => $nextCursor,
        ]);
    }

    /* ── GET /api/attendance/offline/events (staff review, read-only) ── */

    /**
     * PHASE2-CONTRACT "Staff review endpoints": the gym's synced events,
     * newest first, keyset-paged on (server_received_at, event_id).
     * Route: admin group + permission:attendance,view. Gym-scoped.
     */
    public function events(Request $request): JsonResponse
    {
        $request->validate([
            'result' => 'nullable|in:accepted,rejected,duplicate,error',
            'needs_review' => 'nullable|in:0,1,true,false',
            'cursor' => 'nullable|string|max:200',
            'limit' => 'nullable|integer|min:1|max:200',
        ]);
        $gymId = $request->user()->gym_id;
        $limit = (int) ($request->query('limit') ?? 50);

        $after = null;
        if ($cursor = $request->query('cursor')) {
            $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
            $parts = $decoded ? explode('|', $decoded, 2) : [];
            if (count($parts) !== 2 || ! Str::isUuid($parts[1])) {
                return response()->json(['message' => 'Invalid cursor.', 'errors' => ['cursor' => ['Invalid cursor.']]], 422);
            }
            try {
                $after = [AttendanceSyncService::isoWithOffset(Carbon::parse($parts[0])), strtolower($parts[1])];
            } catch (\Throwable) {
                return response()->json(['message' => 'Invalid cursor.', 'errors' => ['cursor' => ['Invalid cursor.']]], 422);
            }
        }

        $rows = DB::table('attendance_events as ae')
            ->leftJoin('gym_members as gm', 'gm.id', '=', 'ae.gym_member_id')
            ->leftJoin('profiles as pm', 'pm.id', '=', 'gm.user_id')
            ->leftJoin('profiles as pa', 'pa.id', '=', 'ae.actor_user_id')
            ->leftJoin('attendance_devices as d', function ($j) {
                $j->on('d.device_id', '=', 'ae.device_id')->on('d.user_id', '=', 'ae.actor_user_id');
            })
            ->where('ae.gym_id', $gymId)
            ->when($request->query('result'), fn ($q, $r) => $q->where('ae.result', $r))
            ->when(in_array($request->query('needs_review'), ['1', 'true'], true), fn ($q) => $q->where('ae.needs_review', true))
            ->when($after, fn ($q) => $q->where(function ($w) use ($after) {
                $w->where('ae.server_received_at', '<', $after[0])
                  ->orWhere(fn ($x) => $x->where('ae.server_received_at', '=', $after[0])->where('ae.event_id', '<', $after[1]));
            }))
            ->orderByDesc('ae.server_received_at')
            ->orderByDesc('ae.event_id')
            ->limit($limit + 1)
            ->get([
                'ae.event_id', 'ae.kind', 'ae.method', 'ae.result', 'ae.reason_code', 'ae.reason_message', 'ae.flags',
                'ae.needs_review', 'ae.attendance_log_id', 'ae.service_log_id', 'ae.attempts',
                'ae.device_recorded_at', 'ae.device_timezone', 'ae.server_received_at', 'ae.processed_at',
                'ae.gym_member_id', 'ae.branch_id', 'ae.class_session_id', 'ae.studio_id', 'ae.service_assignment_id',
                'gm.member_number', 'pm.full_name as member_name',
                'ae.actor_user_id', 'ae.actor_type', 'pa.full_name as actor_name',
                'ae.device_id', 'd.label as device_label', 'd.platform as device_platform', 'ae.app', 'ae.app_version',
            ]);

        $next = null;
        if ($rows->count() > $limit) {
            $rows = $rows->slice(0, $limit)->values();
            $last = $rows->last();
            $next = rtrim(strtr(base64_encode(
                AttendanceSyncService::iso(Carbon::parse($last->server_received_at)) . '|' . $last->event_id
            ), '+/', '-_'), '=');
        }

        $data = $rows->map(function ($r) {
            $flags = is_string($r->flags) ? (json_decode($r->flags, true) ?: []) : [];
            return [
                'event_id' => $r->event_id,
                'kind' => $r->kind,
                'method' => $r->method,
                'result' => $r->result,
                'code' => $r->reason_code,
                // Amendment §6: never expose exception text from `error` rows.
                'message' => $r->result === 'error'
                    ? 'Temporary server error; the event will be retried.'
                    : $r->reason_message,
                'flags' => array_values($flags),
                'needs_review' => (bool) $r->needs_review,
                'attendance_id' => $r->attendance_log_id,
                'service_log_id' => $r->service_log_id,
                'attempts' => (int) $r->attempts,
                'device_recorded_at' => $this->isoOrNull($r->device_recorded_at),
                'device_timezone' => $r->device_timezone,
                'server_received_at' => $this->isoOrNull($r->server_received_at),
                'processed_at' => $this->isoOrNull($r->processed_at),
                'member' => $r->gym_member_id ? [
                    'gym_member_id' => $r->gym_member_id,
                    'member_number' => $r->member_number !== null ? (int) $r->member_number : null,
                    'full_name' => $r->member_name,
                ] : null,
                'actor' => ['user_id' => $r->actor_user_id, 'type' => $r->actor_type, 'full_name' => $r->actor_name],
                'device' => [
                    'device_id' => $r->device_id,
                    'label' => $r->device_label
                        ?? trim(implode(' ', array_filter([$r->app, $r->device_platform, $r->app_version]))) ?: null,
                    'platform' => $r->device_platform,
                    'app' => $r->app,
                    'app_version' => $r->app_version,
                ],
                'branch_id' => $r->branch_id,
                'class_session_id' => $r->class_session_id,
                'studio_id' => $r->studio_id,
                'service_assignment_id' => $r->service_assignment_id,
            ];
        })->values();

        return response()->json(['data' => $data, 'next_cursor' => $next]);
    }

    /* ── GET /api/attendance/offline/me ─────────────────────────── */

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (in_array($user->role, self::ADMIN_ROLES, true)) {
            return response()->json([
                'error' => 'Staff use GET /api/attendance/offline/bootstrap.',
                'code' => 'permission_denied',
            ], 403);
        }

        $member = DB::table('gym_members as gm')
            ->leftJoin('profiles as p', 'p.id', '=', 'gm.user_id')
            ->where('gm.user_id', $user->id)
            ->where('gm.gym_id', $user->gym_id)
            ->whereNull('gm.deleted_at')
            ->first(['gm.id', 'gm.member_number', 'p.full_name']);
        if (! $member) {
            return response()->json(['error' => 'No membership in this gym.', 'code' => 'member_not_found'], 404);
        }

        $asOf = $this->now();
        $gym = $this->gym($user->gym_id);
        $recent = DB::table('attendance_logs')
            ->where('gym_id', $user->gym_id)
            ->where('gym_member_id', $member->id)
            ->where('check_in_at', '>=', Carbon::now('UTC')->subHours(48)->toIso8601String())
            ->orderByDesc('check_in_at')
            ->get(['id', 'gym_member_id', 'class_session_id', 'branch_id', 'check_in_at'])
            ->map(fn ($a) => $this->attendanceShape($a))->values();

        return response()->json([
            'server_time' => $asOf,
            'as_of' => $asOf,
            'gym' => $gym,
            'policy' => self::policy(),
            'member' => [
                'gym_member_id' => $member->id,
                'member_number' => $member->member_number !== null ? (int) $member->member_number : null,
                'full_name' => $member->full_name,
            ],
            'buckets' => $this->buckets([$member->id])->map(fn ($b) => $this->bucketShape($b, $gym['timezone']))->values(),
            'branches' => $this->branches($user->gym_id),
            'recent_attendance' => $recent,
            'pass_keys' => app(MemberPassService::class)->passKeys($user->gym_id),
        ]);
    }

    /* ── shared shapes ──────────────────────────────────────────── */

    /** CONTRACT §4 policy object. */
    public static function policy(): array
    {
        $c = config('attendance_offline');
        return [
            'enabled' => (bool) $c['enabled'],
            'max_batch' => (int) $c['max_batch'],
            'max_data_age_hours' => (int) $c['max_data_age_hours'],
            'max_event_age_days' => (int) $c['max_event_age_days'],
            'future_skew_seconds' => (int) $c['future_skew_seconds'],
            'allow_manual_offline' => (bool) $c['allow_manual_offline'],
            'allow_staff_qr_offline' => (bool) $c['allow_staff_qr_offline'],
            'allow_member_qr_offline' => (bool) $c['allow_member_qr_offline'],
            'allow_service_session_offline' => (bool) $c['allow_service_session_offline'],
            'expired_cache_policy' => (string) $c['expired_cache_policy'],
            'retry_base_seconds' => (int) $c['retry_base_seconds'],
            'retry_max_seconds' => (int) $c['retry_max_seconds'],
            'online_grace_seconds' => (int) $c['online_grace_seconds'],
        ];
    }

    /** Active buckets (status='active') with their plan type. */
    private function buckets(array $memberIds)
    {
        if ($memberIds === []) {
            return collect();
        }
        return DB::table('member_memberships as mm')
            ->leftJoin('membership_plans as mp', 'mp.id', '=', 'mm.plan_id')
            ->whereIn('mm.gym_member_id', $memberIds)
            ->where('mm.status', 'active')
            ->orderByRaw("CASE mm.source_type WHEN 'subscription' THEN 0 ELSE 1 END")
            ->orderBy('mm.end_date')
            ->get([
                'mm.id', 'mm.gym_member_id', 'mp.plan_type', 'mm.source_type', 'mm.status', 'mm.payment_status',
                'mm.start_date', 'mm.end_date', 'mm.sessions_remaining', 'mm.sessions_total', 'mm.freeze_status',
                'mm.allowed_branch_ids',
            ]);
    }

    /** CONTRACT §6.4: start_date / end_date are gym-local YYYY-MM-DD dates. */
    private function bucketShape(object $b, string $tz): array
    {
        $allowed = AttendanceCheckInService::pgArray($b->allowed_branch_ids);
        return [
            'membership_id' => $b->id,
            'plan_type' => $b->plan_type,
            'source_type' => $b->source_type,
            'status' => $b->status,
            'payment_status' => $b->payment_status,
            'start_date' => $this->localDate($b->start_date, $tz),
            'end_date' => $this->localDate($b->end_date, $tz),
            'sessions_remaining' => $b->sessions_remaining !== null ? (int) $b->sessions_remaining : null,
            'sessions_total' => $b->sessions_total !== null ? (int) $b->sessions_total : null,
            'freeze_status' => $b->freeze_status,
            'allowed_branch_ids' => $allowed === [] ? null : $allowed,
        ];
    }

    private function attendanceShape(object $a): array
    {
        return [
            'attendance_id' => $a->id,
            'gym_member_id' => $a->gym_member_id,
            'class_session_id' => $a->class_session_id,
            'branch_id' => $a->branch_id,
            'check_in_at' => $this->isoOrNull($a->check_in_at),
        ];
    }

    private function branches(string $gymId): array
    {
        return DB::table('branches')->where('gym_id', $gymId)->orderBy('name')
            ->get(['id', 'name', 'is_active'])
            ->map(fn ($b) => ['id' => $b->id, 'name' => $b->name, 'is_active' => (bool) $b->is_active])
            ->all();
    }

    private function gym(string $gymId): array
    {
        $g = DB::table('gyms')->where('id', $gymId)->first(['id', 'name', 'timezone']);
        $tz = $g->timezone ?? 'UTC';
        if (! in_array($tz, \DateTimeZone::listIdentifiers(), true)) {
            $tz = 'UTC';
        }
        return ['id' => $g->id ?? $gymId, 'name' => $g->name ?? null, 'timezone' => $tz];
    }

    private function coachProfile($user): ?object
    {
        if ($user->role !== 'trainer' || ! $user->is_active || $user->deleted_at !== null) {
            return null;
        }
        return DB::table('trainer_profiles')
            ->where('profile_id', $user->id)->where('gym_id', $user->gym_id)->where('is_active', true)
            ->first(['id', 'name']);
    }

    private function now(): string
    {
        return AttendanceSyncService::iso(Carbon::now('UTC'));
    }

    private function isoOrNull(mixed $v): ?string
    {
        if ($v === null || $v === '') return null;
        try {
            return AttendanceSyncService::iso(Carbon::parse($v));
        } catch (\Throwable) {
            return null;
        }
    }

    private function localDate(mixed $v, string $tz): ?string
    {
        if ($v === null || $v === '') return null;
        try {
            return Carbon::parse($v)->setTimezone($tz)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function localIso(string $date, string $time, string $tz): ?string
    {
        try {
            return AttendanceSyncService::iso(Carbon::parse(substr($date, 0, 10) . ' ' . $time, $tz));
        } catch (\Throwable) {
            return null;
        }
    }

    private static function last4(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);
        return $digits === '' ? null : substr($digits, -4);
    }
}
