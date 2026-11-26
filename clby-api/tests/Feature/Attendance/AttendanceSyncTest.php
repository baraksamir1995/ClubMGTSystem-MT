<?php

namespace Tests\Feature\Attendance;

use App\Models\User;
use App\Services\AttendanceCheckInService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * POST /api/attendance/sync — kind=attendance (manual / staff_qr / member_qr),
 * idempotency, envelope and device rules.
 */
class AttendanceSyncTest extends OfflineSyncTestCase
{
    /* ── happy path + idempotency ───────────────────────────────── */

    public function test_accepted_event_creates_exactly_one_log_with_device_time(): void
    {
        $gym = $this->makeGym('Africa/Cairo');
        [$branch] = $this->makeBranch($gym, 'Downtown');
        [, $mid] = $this->makeMember($gym, 'Sara');
        $this->makeMembership($gym, $mid, 'duration');
        $admin = $this->makeAdmin($gym);
        $recorded = Carbon::now()->subMinutes(42)->startOfSecond();

        $event = $this->attendanceEvent($gym, [
            'member_id' => $mid, 'branch_id' => $branch,
            'device_recorded_at' => self::at($recorded->copy()->setTimezone('Africa/Cairo')),
        ]);
        $r = $this->syncOne($admin, $event);

        $this->assertSame('accepted', $r['status']);
        $this->assertSame('created', $r['code']);
        $this->assertSame([], $r['flags']);
        $this->assertFalse($r['retryable']);
        $this->assertNotNull($r['processed_at']);
        $this->assertNull($r['service_log_id']);
        $this->assertSame(1, DB::table('attendance_logs')->count());

        $row = DB::table('attendance_logs')->first();
        $this->assertSame($r['attendance_id'], $row->id);
        $this->assertSame($event['event_id'], $row->source_event_id);
        $this->assertSame($admin->id, $row->recorded_by);
        $this->assertSame('manual', $row->method);
        $this->assertSame('Downtown', $row->access_point);
        $this->assertSame($branch, $row->branch_id);
        $this->assertNull($row->review_flag);
        $this->assertTrue(Carbon::parse($row->check_in_at)->equalTo($recorded), 'check_in_at = device_recorded_at');

        $ev = DB::table('attendance_events')->where('event_id', $event['event_id'])->first();
        $this->assertSame('accepted', $ev->result);
        $this->assertSame('manual', $ev->method);
        $this->assertSame($mid, $ev->gym_member_id);
        $this->assertSame($row->id, $ev->attendance_log_id);
        $this->assertSame('Africa/Cairo', $ev->device_timezone);
        $this->assertSame(1, (int) $ev->attempts);
        $this->assertSame(['screen' => 'test'], json_decode($ev->metadata, true)['client']);

        $log = DB::table('staff_activity_logs')->where('entity_id', $row->id)->first();
        $this->assertSame('Admin checked in Sara (Gym Access) (offline)', $log->description);
        $this->assertSame($event['event_id'], json_decode($log->details, true)['event_id']);
    }

    public function test_replay_returns_same_ids_and_writes_no_second_row(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        $admin = $this->makeAdmin($gym);
        $event = $this->attendanceEvent($gym, ['member_id' => $mid]);

        $first = $this->syncOne($admin, $event);
        $second = $this->syncOne($admin, $event);

        $this->assertSame('accepted', $first['status']);
        $this->assertSame('duplicate', $second['status']);
        $this->assertSame('event_replayed', $second['code']);
        $this->assertSame($first['attendance_id'], $second['attendance_id']);
        $this->assertSame($first['server_received_at'], $second['server_received_at']);
        $this->assertSame($first['processed_at'], $second['processed_at']);
        $this->assertSame(1, DB::table('attendance_logs')->count());
        $this->assertSame(2, (int) DB::table('attendance_events')->value('attempts'));
    }

    /**
     * Timeout after commit: the server committed the batch but the client
     * never saw the response, so it resends the whole batch.
     */
    public function test_resent_batch_after_lost_response_creates_nothing_new(): void
    {
        $gym = $this->makeGym();
        [, $a] = $this->makeMember($gym);
        [, $b] = $this->makeMember($gym);
        $this->makeMembership($gym, $a, 'duration');
        $mm = $this->makeMembership($gym, $b, 'sessions', ['sessions_total' => 5, 'sessions_remaining' => 5]);
        $cs = $this->makeClassSession($gym);
        $admin = $this->makeAdmin($gym);
        $batch = [
            $this->attendanceEvent($gym, ['member_id' => $a]),
            $this->attendanceEvent($gym, ['member_id' => $b, 'class_session_id' => $cs]),
        ];

        $first = $this->sync($admin, $batch)->assertOk()->json('results');
        $again = $this->sync($admin, $batch)->assertOk()->json('results');

        $this->assertSame(['accepted', 'accepted'], array_column($first, 'status'));
        $this->assertSame(['duplicate', 'duplicate'], array_column($again, 'status'));
        $this->assertSame(array_column($first, 'attendance_id'), array_column($again, 'attendance_id'));
        $this->assertSame(2, DB::table('attendance_logs')->count());
        $this->assertSame(1, (int) DB::table('member_memberships')->where('id', $mm)->value('sessions_used'), 'decremented once');
    }

    public function test_same_id_different_payload_is_event_id_reused(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        [, $other] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        $admin = $this->makeAdmin($gym);
        $event = $this->attendanceEvent($gym, ['member_id' => $mid]);
        $this->syncOne($admin, $event);

        $r = $this->syncOne($admin, array_merge($event, ['member_id' => $other]));
        $this->assertSame('rejected', $r['status']);
        $this->assertSame('event_id_reused', $r['code']);
        $this->assertSame(1, DB::table('attendance_logs')->count());
    }

    public function test_same_id_from_another_gym_is_event_id_conflict_without_details(): void
    {
        $gymA = $this->makeGym();
        $gymB = $this->makeGym();
        [, $midA] = $this->makeMember($gymA);
        [, $midB] = $this->makeMember($gymB);
        $this->makeMembership($gymA, $midA, 'duration');
        $this->makeMembership($gymB, $midB, 'duration');
        $eventA = $this->attendanceEvent($gymA, ['member_id' => $midA]);
        $this->syncOne($this->makeAdmin($gymA), $eventA);

        $r = $this->syncOne($this->makeAdmin($gymB), $this->attendanceEvent($gymB, ['event_id' => $eventA['event_id'], 'member_id' => $midB]), (string) Str::uuid());
        $this->assertSame('rejected', $r['status']);
        $this->assertSame('event_id_conflict', $r['code']);
        $this->assertNull($r['attendance_id']);
        $this->assertSame(1, DB::table('attendance_logs')->count());
        $this->assertSame($gymA, DB::table('attendance_events')->value('gym_id'), 'original row untouched');
    }

    public function test_partial_batch_valid_invalid_valid(): void
    {
        $gym = $this->makeGym();
        [, $a] = $this->makeMember($gym);
        [, $b] = $this->makeMember($gym);
        $this->makeMembership($gym, $a, 'duration');
        $this->makeMembership($gym, $b, 'duration');
        $admin = $this->makeAdmin($gym);

        $results = $this->sync($admin, [
            $this->attendanceEvent($gym, ['member_id' => $a]),
            $this->attendanceEvent($gym, ['member_id' => $b, 'device_recorded_at' => 'yesterday-ish']),
            $this->attendanceEvent($gym, ['member_id' => $b]),
        ])->assertOk()->json('results');

        $this->assertSame(['accepted', 'rejected', 'accepted'], array_column($results, 'status'));
        $this->assertSame('invalid_payload', $results[1]['code']);
        $this->assertSame(2, DB::table('attendance_logs')->count());
        $this->assertSame(3, DB::table('attendance_events')->count(), 'rejected events are stored too');
    }

    /* ── tenant + permission ────────────────────────────────────── */

    public function test_cross_tenant_ids_are_rejected(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'sessions', ['sessions_total' => 5, 'sessions_remaining' => 5]);
        [, $foreignMember] = $this->makeMember($other);
        $this->makeMembership($other, $foreignMember, 'duration');
        [$foreignBranch] = $this->makeBranch($other);
        $foreignClass = $this->makeClassSession($other);
        $foreignStudio = $this->makeStudio($other);
        $admin = $this->makeAdmin($gym);

        $results = $this->sync($admin, [
            $this->attendanceEvent($gym, ['member_id' => $foreignMember]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'branch_id' => $foreignBranch]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'class_session_id' => $foreignClass]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'studio_id' => $foreignStudio]),
            $this->attendanceEvent($other, ['member_id' => $foreignMember]),
        ])->assertOk()->json('results');

        $this->assertSame(
            ['member_not_found', 'branch_not_found', 'class_session_not_found', 'studio_not_found', 'tenant_mismatch'],
            array_column($results, 'code')
        );
        $this->assertSame(['rejected'], array_values(array_unique(array_column($results, 'status'))));
        $this->assertSame(0, DB::table('attendance_logs')->count());
        // Server-derived columns never hold the foreign ids; the claim is kept in metadata for audit.
        $ev = DB::table('attendance_events')->where('reason_code', 'member_not_found')->first();
        $this->assertNull($ev->gym_member_id);
        $this->assertSame($gym, $ev->gym_id);
        $this->assertSame($foreignMember, json_decode($ev->metadata, true)['claimed']['member_id']);
    }

    public function test_staff_without_attendance_module_is_denied_and_trainer_with_it_is_allowed(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');

        $r = $this->syncOne($this->makeStaff($gym, ['members']), $this->attendanceEvent($gym, ['member_id' => $mid]));
        $this->assertSame('permission_denied', $r['code']);

        [$trainer] = $this->makeCoach($gym, ['attendance']);
        $r = $this->syncOne($trainer, $this->attendanceEvent($gym, ['member_id' => $mid, 'attendance_method' => 'staff_qr']), (string) Str::uuid());
        $this->assertSame('accepted', $r['status']);
        $this->assertSame('qr', DB::table('attendance_logs')->value('method'), 'D6: staff_qr stored as qr');
        $this->assertSame('staff_qr', DB::table('attendance_events')->where('result', 'accepted')->value('method'));
    }

    public function test_member_cannot_send_manual_events(): void
    {
        $gym = $this->makeGym();
        [$member, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        $r = $this->syncOne($member, $this->attendanceEvent($gym, ['member_id' => $mid]), null, 'member');
        $this->assertSame('permission_denied', $r['code']);
        $this->assertSame(0, DB::table('attendance_logs')->count());
    }

    /* ── class rules + D2 ───────────────────────────────────────── */

    public function test_class_duplicate_returns_existing_attendance_id(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $mm = $this->makeMembership($gym, $mid, 'sessions', ['sessions_total' => 5, 'sessions_remaining' => 5]);
        $cs = $this->makeClassSession($gym);
        $admin = $this->makeAdmin($gym);

        // Checked in online first …
        $existing = $this->actingAsUser($admin)->postJson('/api/attendance', ['gym_member_id' => $mid, 'class_session_id' => $cs])
            ->assertStatus(201)->json('data.id');
        // … then an offline device syncs its own check-in for the same class.
        $r = $this->syncOne($admin, $this->attendanceEvent($gym, ['member_id' => $mid, 'class_session_id' => $cs]));

        $this->assertSame('duplicate', $r['status']);
        $this->assertSame('already_checked_in', $r['code']);
        $this->assertSame($existing, $r['attendance_id']);
        $this->assertSame(1, DB::table('attendance_logs')->count());
        $this->assertSame(1, (int) DB::table('member_memberships')->where('id', $mm)->value('sessions_used'));
    }

    public function test_d2_class_sessions_ran_out_before_sync_is_accepted_and_flagged(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $mm = $this->makeMembership($gym, $mid, 'sessions', ['sessions_total' => 8, 'sessions_used' => 8, 'sessions_remaining' => 0]);
        $cs = $this->makeClassSession($gym);

        $r = $this->syncOne($this->makeAdmin($gym), $this->attendanceEvent($gym, ['member_id' => $mid, 'class_session_id' => $cs]));

        $this->assertSame('accepted', $r['status']);
        $this->assertSame(['sessions_exhausted'], $r['flags']);
        $row = DB::table('attendance_logs')->first();
        $this->assertSame('sessions_exhausted', $row->review_flag);
        $m = DB::table('member_memberships')->where('id', $mm)->first();
        $this->assertSame(8, (int) $m->sessions_used, 'counter untouched');
        $this->assertSame(0, (int) $m->sessions_remaining, 'never negative');
        $ev = DB::table('attendance_events')->first();
        $this->assertTrue((bool) $ev->needs_review);
        $this->assertSame(['sessions_exhausted'], json_decode($ev->flags, true));
    }

    public function test_d2_validity_is_judged_on_the_visit_date_in_gym_timezone(): void
    {
        $gym = $this->makeGym('Africa/Cairo');
        [, $mid] = $this->makeMember($gym);
        // Ended 2 days ago (UTC) — expired "now", valid on the visit date.
        $this->makeMembership($gym, $mid, 'duration', ['end_date' => Carbon::now()->subDays(2)->setTime(12, 0)]);
        $admin = $this->makeAdmin($gym);

        $online = $this->actingAsUser($admin)->postJson('/api/attendance', ['gym_member_id' => $mid]);
        $online->assertStatus(422);

        $r = $this->syncOne($admin, $this->attendanceEvent($gym, [
            'member_id' => $mid,
            'device_recorded_at' => self::at(Carbon::now()->subDays(3)->setTimezone('Africa/Cairo')),
        ]));
        $this->assertSame('accepted', $r['status']);

        $late = $this->syncOne($admin, $this->attendanceEvent($gym, ['member_id' => $mid]));
        $this->assertSame('rejected', $late['status']);
        $this->assertSame('no_active_subscription', $late['code']);
    }

    public function test_store_error_codes_map_one_to_one(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $cs = $this->makeClassSession($gym);
        [, $none] = $this->makeMember($gym);
        [, $sessionsOnly] = $this->makeMember($gym);
        $this->makeMembership($gym, $sessionsOnly, 'sessions', ['sessions_total' => 3, 'sessions_remaining' => 3]);
        [, $durationOnly] = $this->makeMember($gym);
        $this->makeMembership($gym, $durationOnly, 'duration');
        [, $frozen] = $this->makeMember($gym);
        $this->makeMembership($gym, $frozen, 'duration_session', ['freeze_status' => 'frozen']);

        $codes = array_column($this->sync($admin, [
            $this->attendanceEvent($gym, ['member_id' => $none]),
            $this->attendanceEvent($gym, ['member_id' => $sessionsOnly]),
            $this->attendanceEvent($gym, ['member_id' => $durationOnly, 'class_session_id' => $cs]),
            $this->attendanceEvent($gym, ['member_id' => $frozen]),
            $this->attendanceEvent($gym, ['member_id' => $frozen, 'class_session_id' => $cs]),
        ])->assertOk()->json('results'), 'code');

        $this->assertSame(['no_active_subscription', 'gym_access_not_included', 'class_access_not_included', 'membership_frozen', 'membership_frozen'], $codes);
    }

    /* ── clock rules ────────────────────────────────────────────── */

    public function test_future_and_too_old_events_are_rejected_and_stored(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration', ['end_date' => null]);
        $admin = $this->makeAdmin($gym);

        $results = $this->sync($admin, [
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => self::at(Carbon::now()->addMinutes(10))]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => self::at(Carbon::now()->subDays(8))]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => self::at(Carbon::now()->addMinutes(4))]),
        ])->assertOk()->json('results');

        $this->assertSame(['clock_in_future', 'event_too_old', 'created'], array_column($results, 'code'));
        $this->assertSame(3, DB::table('attendance_events')->count());
        $this->assertSame(1, DB::table('attendance_logs')->count());
    }

    /* ── member_qr ──────────────────────────────────────────────── */

    private function qrJson(string $gym, string $branch, string $token): array
    {
        return ['raw' => json_encode(['type' => 'gym_access', 'gym_id' => $gym, 'branch_id' => $branch, 'token' => $token])];
    }

    public function test_member_qr_accepted_and_forced_to_self(): void
    {
        $gym = $this->makeGym();
        [$branch, $token] = $this->makeBranch($gym, 'Zayed');
        [$member, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        [, $someoneElse] = $this->makeMember($gym);
        $this->makeMembership($gym, $someoneElse, 'duration');

        $r = $this->syncOne($member, $this->attendanceEvent($gym, [
            'attendance_method' => 'member_qr', 'member_id' => $someoneElse, 'qr' => $this->qrJson($gym, $branch, $token),
        ]), null, 'member');

        $this->assertSame('accepted', $r['status']);
        $row = DB::table('attendance_logs')->first();
        $this->assertSame($mid, $row->gym_member_id, 'forced to the caller');
        $this->assertSame('qr', $row->method);
        $this->assertSame($branch, $row->branch_id);
        $this->assertSame('Zayed', $row->access_point);
        $meta = json_decode(DB::table('attendance_events')->value('qr_meta'), true);
        $this->assertSame('v1_json', $meta['format']);
        $this->assertStringNotContainsString($token, DB::table('attendance_events')->value('qr_meta'), 'token never stored');
    }

    public function test_member_qr_rejections(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [$branch, $token] = $this->makeBranch($gym);
        [$closed, $closedToken] = $this->makeBranch($gym, 'Closed', false);
        [$foreignBranch, $foreignToken] = $this->makeBranch($other);
        [$member, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        [$frozenUser, $frozen] = $this->makeMember($gym);
        $this->makeMembership($gym, $frozen, 'duration', ['freeze_status' => 'frozen']);

        $results = $this->sync($member, [
            $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => $this->qrJson($other, $foreignBranch, $foreignToken)]),
            $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => ['raw' => (string) Str::uuid()]]),
            $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => ['raw' => 'gym:' . $gym]]),
            $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => $this->qrJson($gym, $closed, $closedToken)]),
        ], null, 'member')->assertOk()->json('results');
        $this->assertSame(['qr_wrong_gym', 'qr_invalid', 'qr_invalid', 'branch_inactive'], array_column($results, 'code'));

        $r = $this->syncOne($frozenUser, $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => ['raw' => $token]]), (string) Str::uuid(), 'member');
        $this->assertSame('membership_frozen', $r['code']);

        $r = $this->syncOne($this->makeAdmin($gym), $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'member_id' => $mid, 'qr' => ['raw' => $token]]), (string) Str::uuid());
        $this->assertSame('permission_denied', $r['code'], 'staff cannot send member_qr');

        $this->assertSame(0, DB::table('attendance_logs')->count());
    }

    /* ── envelope + device ──────────────────────────────────────── */

    public function test_envelope_validation(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $events = array_map(fn () => $this->attendanceEvent($gym), range(1, 51));
        $this->sync($admin, $events)->assertStatus(422)->assertJsonValidationErrors('events');

        $dup = $this->attendanceEvent($gym);
        $this->sync($admin, [$dup, $dup])->assertStatus(422);
        $this->sync($admin, [])->assertStatus(422);
        $this->actingAsUser($admin)->postJson('/api/attendance/sync', ['app' => 'admin', 'events' => [$dup]])->assertStatus(422);
        $this->sync($admin, [['kind' => 'attendance']])->assertStatus(422); // no event_id → can't report per event
        $this->assertSame(0, DB::table('attendance_events')->count());
    }

    /** CONTRACT §6.1: a shared device works for every account; each (device, user) pair is independent. */
    public function test_shared_device_is_bound_per_user_and_revoked_per_pair(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        $joe = $this->makeAdmin($gym);
        $aya = $this->makeStaff($gym);
        [$member, $own] = $this->makeMember($gym);
        $this->makeMembership($gym, $own, 'duration');
        [, $token] = $this->makeBranch($gym);

        $this->assertSame('accepted', $this->syncOne($joe, $this->attendanceEvent($gym, ['member_id' => $mid]))['status']);
        $this->assertSame('accepted', $this->syncOne($aya, $this->attendanceEvent($gym, ['member_id' => $mid]))['status']);
        $this->assertSame('accepted', $this->syncOne($member, $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => ['raw' => $token]]), null, 'member')['status']);
        $this->assertSame(3, DB::table('attendance_devices')->where('device_id', $this->deviceId)->count());

        // Revoking joe's pair leaves aya's untouched.
        DB::table('attendance_devices')->where('device_id', $this->deviceId)->where('user_id', $joe->id)->update(['revoked_at' => now()]);
        $this->sync($joe, [$this->attendanceEvent($gym, ['member_id' => $mid])])->assertStatus(403)->assertJsonPath('code', 'device_revoked');
        $this->assertSame('accepted', $this->syncOne($aya, $this->attendanceEvent($gym, ['member_id' => $mid]))['status']);
        $this->assertSame(4, DB::table('attendance_logs')->count());
    }

    public function test_device_mismatch_only_for_same_user_in_another_gym(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->sync($admin, [$this->attendanceEvent($gym)])->assertOk();

        // The same account later belongs to another gym (account/gym switch).
        $admin->forceFill(['gym_id' => $other])->save();
        $this->sync($admin->fresh(), [$this->attendanceEvent($other)])
            ->assertStatus(403)->assertJsonPath('code', 'device_mismatch');
    }

    public function test_unexpected_exception_is_retryable_and_reprocessed_on_resend(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        $admin = $this->makeAdmin($gym);
        $event = $this->attendanceEvent($gym, ['member_id' => $mid]);

        $this->app->instance(AttendanceCheckInService::class, new class extends AttendanceCheckInService {
            public function checkIn(User $actor, string $gymId, string $memberId, array $opts = []): array
            {
                parent::checkIn($actor, $gymId, $memberId, $opts); // writes, then blows up → rolled back
                throw new \RuntimeException('db hiccup');
            }
        });
        $r = $this->syncOne($admin, $event);
        $this->assertSame('error', $r['status']);
        $this->assertSame('server_error', $r['code']);
        $this->assertTrue($r['retryable']);
        $this->assertNull($r['processed_at']);
        $this->assertSame(0, DB::table('attendance_logs')->count(), 'partial write rolled back');
        $this->assertSame('error', DB::table('attendance_events')->value('result'));

        $this->app->forgetInstance(AttendanceCheckInService::class);
        $this->app->forgetInstance(\App\Services\AttendanceSyncService::class);
        $retry = $this->syncOne($admin, $event);
        $this->assertSame('accepted', $retry['status'], 'a stored error is re-processed, not replayed');
        $this->assertSame(1, DB::table('attendance_logs')->count());
        $this->assertSame(2, (int) DB::table('attendance_events')->value('attempts'));
    }

    public function test_rate_limiter_is_keyed_by_user_not_device(): void
    {
        config(['attendance_offline.sync_rate_per_minute' => 2]);
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->sync($admin, [$this->attendanceEvent($gym)], (string) Str::uuid())->assertOk();
        $this->sync($admin, [$this->attendanceEvent($gym)], (string) Str::uuid())->assertOk();
        // Rotating device ids buys no extra quota.
        $this->sync($admin, [$this->attendanceEvent($gym)], (string) Str::uuid())->assertStatus(429);
        // Another user has their own bucket.
        $this->sync($this->makeStaff($gym), [$this->attendanceEvent($gym)])->assertOk();
    }

    /** CONTRACT §6.3 */
    public function test_conflicting_event_ids_are_audited_without_touching_the_original(): void
    {
        $gymA = $this->makeGym();
        $gymB = $this->makeGym();
        [, $midA] = $this->makeMember($gymA);
        [, $otherA] = $this->makeMember($gymA);
        $this->makeMembership($gymA, $midA, 'duration');
        $adminA = $this->makeAdmin($gymA);
        $adminB = $this->makeAdmin($gymB);
        $event = $this->attendanceEvent($gymA, ['member_id' => $midA]);
        $this->syncOne($adminA, $event);
        $original = (array) DB::table('attendance_events')->first();

        $this->assertSame('event_id_reused', $this->syncOne($adminA, array_merge($event, ['member_id' => $otherA]))['code']);
        $deviceB = (string) Str::uuid();
        $this->assertSame('event_id_conflict', $this->syncOne($adminB, $this->attendanceEvent($gymB, ['event_id' => $event['event_id']]), $deviceB)['code']);

        $this->assertSame($original, (array) DB::table('attendance_events')->first(), 'original row unchanged');
        $rows = DB::table('attendance_event_conflicts')->orderBy('reason_code', 'desc')->get();
        $this->assertCount(2, $rows);
        $this->assertSame(['event_id_reused', $adminA->id, $gymA, $this->deviceId], [$rows[0]->reason_code, $rows[0]->actor_user_id, $rows[0]->gym_id, $rows[0]->device_id]);
        $this->assertSame(['event_id_conflict', $adminB->id, $gymB, $deviceB], [$rows[1]->reason_code, $rows[1]->actor_user_id, $rows[1]->gym_id, $rows[1]->device_id]);
        $this->assertSame($event['event_id'], $rows[1]->event_id);
        $this->assertSame(64, strlen($rows[1]->payload_hash));
        $this->assertNotSame($original['payload_hash'], $rows[0]->payload_hash);
    }

    public function test_impossible_dates_are_invalid_payload(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        $feb30 = Carbon::now()->subDay()->format('Y') . '-02-30T10:00:00Z';
        $results = $this->sync($this->makeAdmin($gym), [
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => $feb30]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => Carbon::now()->format('Y-m-d') . 'T25:00:00Z']),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => Carbon::now()->subMinute()->format('Y-m-d\TH:i:s') . '+15:00']),
        ])->assertOk()->json('results');
        $this->assertSame(['invalid_payload', 'invalid_payload', 'invalid_payload'], array_column($results, 'code'));
    }
}
