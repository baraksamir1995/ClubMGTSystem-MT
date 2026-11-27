<?php

namespace Tests\Feature\Attendance;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * CONTRACT §6.2 — server-side offline gate. An event is offline when
 * device_recorded_at < server_received_at − online_grace_seconds (120 s).
 */
class OfflineGateTest extends OfflineSyncTestCase
{
    private function memberQrSetup(): array
    {
        $gym = $this->makeGym();
        [, $token] = $this->makeBranch($gym);
        [$member, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        return [$gym, $token, $member];
    }

    public function test_member_qr_backdated_is_offline_disabled_by_default_policy(): void
    {
        config(['attendance_offline.allow_member_qr_offline' => false]); // the shipped default
        [$gym, $token, $member] = $this->memberQrSetup();

        $results = $this->sync($member, [
            $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => ['raw' => $token],
                'device_recorded_at' => self::at(Carbon::now()->subHour())]),
            $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => ['raw' => $token],
                'device_recorded_at' => self::at(Carbon::now()->subSeconds(90))]),
        ], null, 'member')->assertOk()->json('results');

        $this->assertSame(['offline_disabled', 'created'], array_column($results, 'code'));
        $this->assertSame(1, DB::table('attendance_logs')->count());
        $this->assertSame('offline_disabled', DB::table('attendance_events')->where('result', 'rejected')->value('reason_code'), 'stored for audit');
    }

    public function test_enabled_false_rejects_every_offline_kind_but_processes_near_real_time(): void
    {
        config(['attendance_offline.enabled' => false]);
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        [$coach, $tp] = $this->makeCoach($gym);
        $a = $this->makeAssignment($gym, $mid, $tp);
        $admin = $this->makeAdmin($gym);
        $old = self::at(Carbon::now()->subMinutes(10));

        $codes = array_column($this->sync($admin, [
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => $old]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => self::at(Carbon::now()->subSeconds(30))]),
        ])->assertOk()->json('results'), 'code');
        $this->assertSame(['offline_disabled', 'created'], $codes);

        $r = $this->syncOne($coach, $this->serviceEvent($gym, $a, ['device_recorded_at' => $old]), null, 'coach');
        $this->assertSame('offline_disabled', $r['code']);
        $r = $this->syncOne($coach, $this->serviceEvent($gym, $a, ['device_recorded_at' => self::at(Carbon::now())]), null, 'coach');
        $this->assertSame('created', $r['code']);
    }

    public function test_per_kind_flags(): void
    {
        config([
            'attendance_offline.allow_manual_offline' => false,
            'attendance_offline.allow_service_session_offline' => false,
        ]);
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        [$coach, $tp] = $this->makeCoach($gym);
        $old = self::at(Carbon::now()->subMinutes(10));

        $codes = array_column($this->sync($this->makeAdmin($gym), [
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => $old]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => self::recent()]),
        ])->assertOk()->json('results'), 'code');
        $this->assertSame(['offline_disabled', 'created'], $codes);

        $r = $this->syncOne($coach, $this->serviceEvent($gym, $this->makeAssignment($gym, $mid, $tp), ['device_recorded_at' => $old]), null, 'coach');
        $this->assertSame('offline_disabled', $r['code']);
    }

    public function test_already_processed_events_are_never_re_evaluated(): void
    {
        [$gym, $token, $member] = $this->memberQrSetup();
        $branchId = DB::table('branches')->where('qr_token', $token)->value('id');
        // Offline member_qr needs a signed v2 QR (PHASE3 D3).
        $event = $this->attendanceEvent($gym, ['attendance_method' => 'member_qr',
            'qr' => ['raw' => $this->branchQr($gym, $branchId, 'static', Carbon::now()->subHours(2))],
            'device_recorded_at' => self::at(Carbon::now()->subHour())]);
        $first = $this->syncOne($member, $event, null, 'member');
        $this->assertSame('created', $first['code']);

        config(['attendance_offline.enabled' => false]);
        $again = $this->syncOne($member, $event, null, 'member');
        $this->assertSame('event_replayed', $again['code']);
        $this->assertSame($first['attendance_id'], $again['attendance_id']);
    }
}
