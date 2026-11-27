<?php

namespace Tests\Feature\Attendance;

use App\Services\MemberPassService;
use App\Services\SpecialistQrService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * PHASE3 Amendment 2 §C: a member scans the coach's QR (online or offline)
 * → kind=service_session, method=member_qr. Server verifies the signed QR
 * as of device_recorded_at and applies the online specialist-scan rules
 * (shared SpecialistSessionService) as of device time.
 */
class CoachQrSyncTest extends OfflineSyncTestCase
{
    private function setUpScene(): array
    {
        $gym = $this->makeGym();
        [, $tp] = $this->makeCoach($gym);
        [$member, $mid] = $this->makeMember($gym, 'Mona');
        // Printed/fetched by the coach a day ago.
        $qr = app(SpecialistQrService::class)->issue($gym, $tp, Carbon::now()->subDay());
        return [$gym, $tp, $member, $mid, $qr];
    }

    private function scan(string $gym, string $tp, string $raw, ?Carbon $at = null, array $extra = []): array
    {
        return $this->attendanceEvent($gym, array_merge([
            'kind' => 'service_session', 'attendance_method' => 'member_qr', 'trainer_id' => $tp,
            'qr' => ['raw' => $raw], 'service_assignment_id' => null,
            'device_recorded_at' => self::at($at ?? Carbon::now()->subHours(2)),
        ], $extra));
    }

    public function test_offline_scan_is_accepted_with_device_time_and_replays_idempotently(): void
    {
        [$gym, $tp, $member, $mid, $qr] = $this->setUpScene();
        $a = $this->makeAssignment($gym, $mid, $tp, ['sessions_used' => 3]);
        $at = Carbon::now()->subHours(2)->startOfSecond();
        $event = $this->scan($gym, $tp, $qr, $at, ['member_id' => $mid]);

        $r = $this->syncOne($member, $event, null, 'member');
        $this->assertSame(['accepted', 'created'], [$r['status'], $r['code']]);
        $log = DB::table('service_session_logs')->where('id', $r['service_log_id'])->first();
        $this->assertSame([$a, $tp, $mid, 'Member self-scan', $event['event_id']], [$log->assignment_id, $log->trainer_id, $log->gym_member_id, $log->note, $log->source_event_id]);
        $this->assertTrue(Carbon::parse($log->delivered_at)->equalTo($at));
        $this->assertSame(4, (int) DB::table('member_service_assignments')->where('id', $a)->value('sessions_used'));

        $ev = DB::table('attendance_events')->where('event_id', $event['event_id'])->first();
        $this->assertSame(['service_session', 'member_qr', $mid, $a], [$ev->kind, $ev->method, $ev->gym_member_id, $ev->service_assignment_id]);
        $meta = json_decode($ev->qr_meta, true);
        $this->assertSame([true, 2, $tp], [$meta['verified'], $meta['v'], $meta['trainer_id']]);

        $again = $this->syncOne($member, $event, null, 'member');
        $this->assertSame(['duplicate', 'event_replayed', $r['service_log_id']], [$again['status'], $again['code'], $again['service_log_id']]);
        $this->assertSame(1, DB::table('service_session_logs')->count());
    }

    public function test_second_scan_inside_the_guard_is_a_duplicate_of_the_original_log(): void
    {
        [$gym, $tp, $member, $mid, $qr] = $this->setUpScene();
        $this->makeAssignment($gym, $mid, $tp);
        $this->makeAssignment($gym, $mid, $tp); // a second pack must not be charged either
        $at = Carbon::now()->subHours(2);

        $first = $this->syncOne($member, $this->scan($gym, $tp, $qr, $at), null, 'member');
        $second = $this->syncOne($member, $this->scan($gym, $tp, $qr, $at->copy()->addMinutes(12)), null, 'member');
        $this->assertSame(['duplicate', 'recently_logged', $first['service_log_id']], [$second['status'], $second['code'], $second['service_log_id']]);

        // Symmetric: an earlier offline scan that syncs after a later one.
        $earlier = $this->syncOne($member, $this->scan($gym, $tp, $qr, $at->copy()->subMinutes(20)), null, 'member');
        $this->assertSame(['duplicate', 'recently_logged'], [$earlier['status'], $earlier['code']]);

        $outside = $this->syncOne($member, $this->scan($gym, $tp, $qr, $at->copy()->addMinutes(31)), null, 'member');
        $this->assertSame('accepted', $outside['status']);
        $this->assertSame(2, DB::table('service_session_logs')->count());
    }

    public function test_pack_rules_as_of_device_time(): void
    {
        [$gym, $tp, $member, $mid, $qr] = $this->setUpScene();

        $none = $this->syncOne($member, $this->scan($gym, $tp, $qr), null, 'member');
        $this->assertSame(['rejected', 'no_package'], [$none['status'], $none['code']]);

        // Expired now, valid at the visit → accepted.
        $a = $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->subHour()]);
        $ok = $this->syncOne($member, $this->scan($gym, $tp, $qr, Carbon::now()->subHours(3)), null, 'member');
        $this->assertSame('accepted', $ok['status']);

        // Already expired at the visit → rejected.
        DB::table('member_service_assignments')->where('id', $a)->update(['expires_at' => Carbon::now()->subDays(2)]);
        $late = $this->syncOne($member, $this->scan($gym, $tp, $qr, Carbon::now()->subDay()), null, 'member');
        $this->assertSame(['rejected', 'package_expired'], [$late['status'], $late['code']]);
    }

    public function test_d2_exhausted_pack_is_accepted_flagged_without_counter_change(): void
    {
        [$gym, $tp, $member, $mid, $qr] = $this->setUpScene();
        $a = $this->makeAssignment($gym, $mid, $tp, ['sessions_used' => 10, 'status' => 'completed']);

        $r = $this->syncOne($member, $this->scan($gym, $tp, $qr), null, 'member');
        $this->assertSame(['accepted', ['pack_exhausted']], [$r['status'], $r['flags']]);
        $this->assertSame('pack_exhausted', DB::table('service_session_logs')->value('review_flag'));
        $this->assertSame(10, (int) DB::table('member_service_assignments')->where('id', $a)->value('sessions_used'));
        $this->assertTrue((bool) DB::table('attendance_events')->value('needs_review'));
    }

    public function test_picks_the_soonest_expiring_usable_pack_and_forces_self(): void
    {
        [$gym, $tp, $member, $mid, $qr] = $this->setUpScene();
        [, $otherMid] = $this->makeMember($gym);
        $this->makeAssignment($gym, $otherMid, $tp);
        $later = $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->addDays(30)]);
        $soon = $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->addDays(3)]);

        $r = $this->syncOne($member, $this->scan($gym, $tp, $qr, null, ['member_id' => $otherMid]), null, 'member');
        $this->assertSame('accepted', $r['status']);
        $log = DB::table('service_session_logs')->first();
        $this->assertSame([$mid, $soon], [$log->gym_member_id, $log->assignment_id]);
        $this->assertSame(0, (int) DB::table('member_service_assignments')->where('id', $later)->value('sessions_used'));
    }

    public function test_qr_actor_and_payload_rejections(): void
    {
        [$gym, $tp, $member, $mid, $qr] = $this->setUpScene();
        $this->makeAssignment($gym, $mid, $tp);
        [, $otherTp] = $this->makeCoach($gym);
        $other = $this->makeGym();
        [, $foreignTp] = $this->makeCoach($other);

        $codes = array_column($this->sync($member, [
            $this->scan($gym, $otherTp, $qr),                                           // trainer ≠ QR
            $this->scan($gym, $foreignTp, app(SpecialistQrService::class)->issue($other, $foreignTp, Carbon::now()->subDay())),
            $this->scan($gym, $tp, json_encode(['type' => 'specialist_session', 'gym_id' => $gym, 'trainer_id' => $tp])), // v1 offline
            $this->scan($gym, $tp, $qr, null, ['service_assignment_id' => (string) Str::uuid()]),
            $this->scan($gym, $tp, $qr, null, ['trainer_id' => null]),
        ], null, 'member')->assertOk()->json('results'), 'code');
        $this->assertSame(['qr_invalid', 'qr_wrong_gym', 'offline_disabled', 'invalid_payload', 'invalid_payload'], $codes);

        $r = $this->syncOne($this->makeAdmin($gym), $this->scan($gym, $tp, $qr), (string) Str::uuid());
        $this->assertSame('permission_denied', $r['code']);

        app(MemberPassService::class)->rotate($gym);
        app(MemberPassService::class)->revoke($gym, json_decode($qr, true)['kid']);
        $this->assertSame('qr_invalid', $this->syncOne($member, $this->scan($gym, $tp, $qr), null, 'member')['code'], 'revoked key');
        $this->assertSame(0, DB::table('service_session_logs')->count());
    }

    public function test_v1_coach_qr_near_real_time_still_works(): void
    {
        [$gym, $tp, $member, $mid] = $this->setUpScene();
        $this->makeAssignment($gym, $mid, $tp);
        $v1 = json_encode(['type' => 'specialist_session', 'gym_id' => $gym, 'trainer_id' => $tp]);
        $r = $this->syncOne($member, $this->scan($gym, $tp, $v1, Carbon::now()->subSeconds(30)), null, 'member');
        $this->assertSame('accepted', $r['status']);
    }

    public function test_offline_gate_needs_both_flags(): void
    {
        [$gym, $tp, $member, $mid, $qr] = $this->setUpScene();
        $this->makeAssignment($gym, $mid, $tp);
        config(['attendance_offline.allow_member_qr_offline' => false]);
        $this->assertSame('offline_disabled', $this->syncOne($member, $this->scan($gym, $tp, $qr), null, 'member')['code']);
        config(['attendance_offline.allow_member_qr_offline' => true, 'attendance_offline.allow_service_session_offline' => false]);
        $this->assertSame('offline_disabled', $this->syncOne($member, $this->scan($gym, $tp, $qr), null, 'member')['code']);
        $this->assertSame('accepted', $this->syncOne($member, $this->scan($gym, $tp, $qr, Carbon::now()->subSeconds(20)), null, 'member')['status'], 'near-real-time always processed');
    }
}
