<?php

namespace Tests\Feature\Attendance;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * POST /api/coach/sessions/decrement regression suite — written against
 * the pre-refactor CoachController::decrement and kept green after the
 * transaction moved into ServiceSessionService.
 */
class CoachDecrementRegressionTest extends AttendanceTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-11-26T10:00:00Z'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function decrement(array $body)
    {
        return $this->postJson('/api/coach/sessions/decrement', $body);
    }

    public function test_success_shape_and_rows(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        $a = $this->makeAssignment($gym, $mid, $tp, ['sessions_used' => 3]);

        $res = $this->actingAsUser($coach)->decrement(['assignment_id' => $a, 'note' => 'legs']);
        $res->assertStatus(201);
        $logId = $res->json('data.log_id');
        $this->assertSame(
            '{"data":{"log_id":"' . $logId . '","assignment_id":"' . $a . '","sessions_used":4,"sessions_remaining":6,"completed":false,"delivered_at":"2026-11-26T10:00:00+00:00"}}',
            $res->getContent()
        );
        $log = DB::table('service_session_logs')->where('id', $logId)->first();
        $this->assertSame('legs', $log->note);
        $this->assertSame($tp, $log->trainer_id);
        $this->assertSame($mid, $log->gym_member_id);
        $this->assertSame(4, (int) DB::table('member_service_assignments')->where('id', $a)->value('sessions_used'));
        $this->assertSame('active', DB::table('member_service_assignments')->where('id', $a)->value('status'));
    }

    public function test_last_session_completes_assignment(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        $a = $this->makeAssignment($gym, $mid, $tp, ['sessions_used' => 9]);

        $res = $this->actingAsUser($coach)->decrement(['assignment_id' => $a]);
        $res->assertStatus(201)->assertJsonPath('data.completed', true)->assertJsonPath('data.sessions_remaining', 0);
        $this->assertSame('completed', DB::table('member_service_assignments')->where('id', $a)->value('status'));
    }

    public function test_error_codes(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $otherTp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        $this->actingAsUser($coach);

        $missing = $this->decrement(['assignment_id' => '00000000-0000-4000-8000-000000000000']);
        $missing->assertStatus(404);
        $this->assertSame('{"error":"Assignment not found","code":"not_found"}', $missing->getContent());

        $foreign = $this->decrement(['assignment_id' => $this->makeAssignment($gym, $mid, $otherTp)]);
        $foreign->assertStatus(403);
        $this->assertSame('{"error":"This assignment belongs to a different coach.","code":"forbidden"}', $foreign->getContent());

        $inactive = $this->decrement(['assignment_id' => $this->makeAssignment($gym, $mid, $tp, ['status' => 'cancelled'])]);
        $inactive->assertStatus(409);
        $this->assertSame('{"error":"Assignment is no longer active.","code":"not_active"}', $inactive->getContent());

        $spent = $this->decrement(['assignment_id' => $this->makeAssignment($gym, $mid, $tp, ['sessions_used' => 10])]);
        $spent->assertStatus(409);
        $this->assertSame('{"error":"No sessions remaining on this package.","code":"exhausted"}', $spent->getContent());

        $expired = $this->decrement(['assignment_id' => $this->makeAssignment($gym, $mid, $tp, ['expires_at' => Carbon::now()->subDay()])]);
        $expired->assertStatus(409);
        $this->assertSame('{"error":"Package expired.","code":"expired"}', $expired->getContent());

        $this->assertSame(0, DB::table('service_session_logs')->count());
    }

    public function test_thirty_minute_guard(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        $a = $this->makeAssignment($gym, $mid, $tp);
        $this->actingAsUser($coach)->decrement(['assignment_id' => $a])->assertStatus(201);

        Carbon::setTestNow(Carbon::parse('2026-11-26T10:10:00Z'));
        $res = $this->decrement(['assignment_id' => $a]);
        $res->assertStatus(409);
        $this->assertSame(
            '{"error":"This member was already logged in the last 30 minutes.","code":"recently_logged","minutes_left":20,"last_delivered_at":"2026-11-26T10:00:00+00:00"}',
            $res->getContent()
        );
        $this->assertSame(1, (int) DB::table('member_service_assignments')->where('id', $a)->value('sessions_used'));
    }

    public function test_non_coach_is_rejected(): void
    {
        $gym = $this->makeGym();
        $res = $this->actingAsUser($this->makeAdmin($gym))->decrement(['assignment_id' => '00000000-0000-4000-8000-000000000000']);
        $res->assertStatus(403)->assertJsonPath('code', 'not_a_coach');
    }
}
