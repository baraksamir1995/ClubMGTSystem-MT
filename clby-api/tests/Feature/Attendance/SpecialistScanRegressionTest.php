<?php

namespace Tests\Feature\Attendance;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * POST /api/specialists/scan (member scans the coach QR, online) — written
 * against the pre-refactor SpecialistScanController and kept green after
 * the rules moved into SpecialistSessionService. Bodies compared exactly.
 */
class SpecialistScanRegressionTest extends AttendanceTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-11-27T10:00:00Z'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function scan($user, string $trainerId)
    {
        $this->actingAsUser($user);
        return $this->postJson('/api/specialists/scan', ['trainer_id' => $trainerId]);
    }

    private function trainer(string $gym, string $name = 'Coach C'): string
    {
        $id = (string) Str::uuid();
        DB::table('trainer_profiles')->insert(['id' => $id, 'gym_id' => $gym, 'name' => $name, 'trainer_type' => 'physio', 'is_active' => true]);
        return $id;
    }

    public function test_success_picks_soonest_expiring_usable_pack(): void
    {
        $gym = $this->makeGym();
        $tp = $this->trainer($gym);
        [$user, $mid] = $this->makeMember($gym);
        $later = $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->addDays(20), 'package_name' => 'Later']);
        $soon = $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->addDays(5), 'sessions_used' => 9, 'package_name' => 'Soon']);

        $res = $this->scan($user, $tp)->assertStatus(201);
        $logId = $res->json('data.log_id');
        $this->assertSame(
            '{"data":{"trainer_id":"' . $tp . '","trainer_name":"Coach C","trainer_type":"physio","log_id":"' . $logId . '","assignment_id":"' . $soon . '","package_name":"Soon","service_type":"personal_training","sessions_total":10,"sessions_used":10,"sessions_remaining":0,"completed":true,"delivered_at":"2026-11-27T10:00:00+00:00"}}',
            $res->getContent()
        );
        $this->assertSame('completed', DB::table('member_service_assignments')->where('id', $soon)->value('status'));
        $this->assertSame(0, (int) DB::table('member_service_assignments')->where('id', $later)->value('sessions_used'));
        $log = DB::table('service_session_logs')->where('id', $logId)->first();
        $this->assertSame('Member self-scan', $log->note);
        $this->assertSame($mid, $log->gym_member_id);
    }

    public function test_error_bodies(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        $tp = $this->trainer($gym);
        $foreignTp = $this->trainer($other);
        [$user, $mid] = $this->makeMember($gym);

        $res = $this->scan($user, $foreignTp)->assertStatus(404);
        $this->assertSame('{"error":"This specialist code is not valid for your gym.","code":"specialist_not_found"}', $res->getContent());

        $res = $this->scan($user, $tp)->assertStatus(404);
        $this->assertSame('{"error":"You don\'t have a session package with this specialist yet.","code":"no_package","trainer_id":"' . $tp . '","trainer_name":"Coach C","trainer_type":"physio"}', $res->getContent());

        $a = $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->subDay()]);
        $res = $this->scan($user, $tp)->assertStatus(409);
        $this->assertSame('{"error":"Your package with this specialist has expired.","code":"package_expired","trainer_id":"' . $tp . '","trainer_name":"Coach C","trainer_type":"physio"}', $res->getContent());

        DB::table('member_service_assignments')->where('id', $a)->update(['expires_at' => null, 'sessions_used' => 10, 'status' => 'completed']);
        $res = $this->scan($user, $tp)->assertStatus(409);
        $this->assertSame('{"error":"You\'ve used all sessions in your package with this specialist.","code":"package_exhausted","trainer_id":"' . $tp . '","trainer_name":"Coach C","trainer_type":"physio"}', $res->getContent());

        // Inactive specialist (fix/specialist-scan d2be08a): refused before any pack lookup.
        DB::table('trainer_profiles')->where('id', $tp)->update(['is_active' => false]);
        $res = $this->scan($user, $tp)->assertStatus(404);
        $this->assertSame('{"error":"This specialist is no longer active at your gym.","code":"specialist_not_found"}', $res->getContent());
        DB::table('trainer_profiles')->where('id', $tp)->update(['is_active' => true]);

        $admin = $this->makeAdmin($gym);
        $res = $this->scan($admin, $tp)->assertStatus(403);
        $this->assertSame('{"error":"No active membership found for your account.","code":"no_member"}', $res->getContent());
        $this->assertSame(0, DB::table('service_session_logs')->count());
    }

    public function test_guard_is_per_member_and_specialist_across_packs(): void
    {
        $gym = $this->makeGym();
        $tp = $this->trainer($gym);
        [$user, $mid] = $this->makeMember($gym);
        $this->makeAssignment($gym, $mid, $tp);
        $this->makeAssignment($gym, $mid, $tp);
        $this->scan($user, $tp)->assertStatus(201);

        Carbon::setTestNow(Carbon::parse('2026-11-27T10:12:00Z'));
        $res = $this->scan($user, $tp)->assertStatus(409);
        $this->assertSame(
            '{"error":"This session was already logged in the last 30 minutes.","code":"recently_logged","trainer_id":"' . $tp . '","trainer_name":"Coach C","trainer_type":"physio","minutes_left":18,"last_delivered_at":"2026-11-27T10:00:00+00:00"}',
            $res->getContent()
        );
        $this->assertSame(1, DB::table('service_session_logs')->count());
    }
}
