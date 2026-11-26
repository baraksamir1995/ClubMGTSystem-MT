<?php

namespace Tests\Feature\Attendance;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** POST /api/attendance/sync — kind=service_session (coach PT/physio, D5). */
class ServiceSessionSyncTest extends OfflineSyncTestCase
{
    public function test_accepted_session_uses_device_time_and_decrements_once(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym, 'Mona');
        $a = $this->makeAssignment($gym, $mid, $tp, ['sessions_used' => 2]);
        $recorded = Carbon::now()->subHours(3)->startOfSecond();
        $event = $this->serviceEvent($gym, $a, ['device_recorded_at' => self::at($recorded)]);

        $r = $this->syncOne($coach, $event, null, 'coach');
        $this->assertSame('accepted', $r['status']);
        $this->assertSame([], $r['flags']);
        $this->assertNull($r['attendance_id']);

        $log = DB::table('service_session_logs')->first();
        $this->assertSame($r['service_log_id'], $log->id);
        $this->assertSame($event['event_id'], $log->source_event_id);
        $this->assertSame('offline note', $log->note);
        $this->assertTrue(Carbon::parse($log->delivered_at)->equalTo($recorded));
        $this->assertSame(3, (int) DB::table('member_service_assignments')->where('id', $a)->value('sessions_used'));
        $this->assertSame($mid, DB::table('attendance_events')->value('gym_member_id'));
        $this->assertSame($a, DB::table('attendance_events')->value('service_assignment_id'));
        $this->assertStringContainsString('(offline)', DB::table('staff_activity_logs')->where('entity_id', $log->id)->value('description'));

        // Replay: same id, no second row / decrement.
        $again = $this->syncOne($coach, $event, null, 'coach');
        $this->assertSame('event_replayed', $again['code']);
        $this->assertSame($r['service_log_id'], $again['service_log_id']);
        $this->assertSame(1, DB::table('service_session_logs')->count());
        $this->assertSame(3, (int) DB::table('member_service_assignments')->where('id', $a)->value('sessions_used'));
    }

    public function test_guard_window_is_symmetric_around_device_time(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        $a = $this->makeAssignment($gym, $mid, $tp);
        $offlineAt = Carbon::now()->subHour();

        // A later ONLINE delivery 10 min after the offline one already synced.
        DB::table('service_session_logs')->insert([
            'id' => (string) Str::uuid(), 'gym_id' => $gym, 'assignment_id' => $a, 'trainer_id' => $tp,
            'gym_member_id' => $mid, 'delivered_at' => $offlineAt->copy()->addMinutes(10)->toIso8601String(),
        ]);

        $r = $this->syncOne($coach, $this->serviceEvent($gym, $a, ['device_recorded_at' => self::at($offlineAt)]), null, 'coach');
        $this->assertSame('rejected', $r['status']);
        $this->assertSame('guard_window', $r['code']);

        $ok = $this->syncOne($coach, $this->serviceEvent($gym, $a, ['device_recorded_at' => self::at($offlineAt->copy()->subMinutes(31))]), null, 'coach');
        $this->assertSame('accepted', $ok['status']);
    }

    public function test_d2_pack_exhausted_is_accepted_flagged_and_never_overflows(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        $a = $this->makeAssignment($gym, $mid, $tp, ['sessions_total' => 10, 'sessions_used' => 10, 'status' => 'completed']);

        $r = $this->syncOne($coach, $this->serviceEvent($gym, $a), null, 'coach');
        $this->assertSame('accepted', $r['status']);
        $this->assertSame(['pack_exhausted'], $r['flags']);

        $log = DB::table('service_session_logs')->first();
        $this->assertSame('pack_exhausted', $log->review_flag);
        $assignment = DB::table('member_service_assignments')->where('id', $a)->first();
        $this->assertSame(10, (int) $assignment->sessions_used, 'sessions_used never exceeds sessions_total');
        $this->assertSame('completed', $assignment->status);
        $this->assertTrue((bool) DB::table('attendance_events')->value('needs_review'));
    }

    public function test_assignment_rules(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $otherTp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        [, $mid2] = $this->makeMember($gym);
        [, $foreignMid] = $this->makeMember($other);
        [, $foreignTp] = $this->makeCoach($other);

        $results = $this->sync($coach, [
            $this->serviceEvent($gym, $this->makeAssignment($gym, $mid, $otherTp)),
            $this->serviceEvent($gym, $this->makeAssignment($other, $foreignMid, $foreignTp)),
            $this->serviceEvent($gym, $this->makeAssignment($gym, $mid, $tp, ['status' => 'cancelled'])),
            $this->serviceEvent($gym, $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->subDays(2)])),
            $this->serviceEvent($gym, $this->makeAssignment($gym, $mid, $tp), ['member_id' => $mid2]),
            $this->serviceEvent($gym, $this->makeAssignment($gym, $mid, $tp), ['service_assignment_id' => null]),
        ], null, 'coach')->assertOk()->json('results');

        $this->assertSame(
            ['permission_denied', 'assignment_not_found', 'assignment_not_active', 'pack_expired', 'invalid_payload', 'invalid_payload'],
            array_column($results, 'code')
        );
        $this->assertSame(0, DB::table('service_session_logs')->count());
    }

    public function test_expiry_is_judged_at_device_time(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        // Expired an hour ago; the session was delivered 3 hours ago.
        $a = $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->subHour()]);
        $r = $this->syncOne($coach, $this->serviceEvent($gym, $a, ['device_recorded_at' => self::at(Carbon::now()->subHours(3))]), null, 'coach');
        $this->assertSame('accepted', $r['status']);
    }

    public function test_only_coaches_may_send_service_sessions(): void
    {
        $gym = $this->makeGym();
        [, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        $a = $this->makeAssignment($gym, $mid, $tp);

        $this->assertSame('permission_denied', $this->syncOne($this->makeAdmin($gym), $this->serviceEvent($gym, $a))['code']);

        // Trainer whose specialist profile was deactivated.
        [$inactiveCoach, $inactiveTp] = $this->makeCoach($gym);
        DB::table('trainer_profiles')->where('id', $inactiveTp)->update(['is_active' => false]);
        $b = $this->makeAssignment($gym, $mid, $inactiveTp);
        $this->assertSame('permission_denied', $this->syncOne($inactiveCoach, $this->serviceEvent($gym, $b), (string) Str::uuid(), 'coach')['code']);

        $this->assertSame(0, DB::table('service_session_logs')->count());
    }
}
