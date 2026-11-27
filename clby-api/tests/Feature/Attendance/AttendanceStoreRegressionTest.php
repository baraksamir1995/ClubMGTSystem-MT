<?php

namespace Tests\Feature\Attendance;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * POST /api/attendance (AttendanceController::store) regression suite.
 *
 * Written against the pre-refactor controller and kept green after the
 * logic moved into AttendanceCheckInService: every response body is
 * compared byte-for-byte, plus the rows written.
 */
class AttendanceStoreRegressionTest extends AttendanceTestCase
{
    private function store(array $body)
    {
        return $this->postJson('/api/attendance', $body);
    }

    public function test_member_of_another_gym_is_not_found(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [, $mid] = $this->makeMember($other);
        $this->makeMembership($other, $mid);

        $res = $this->actingAsUser($this->makeAdmin($gym))->store(['gym_member_id' => $mid]);
        $res->assertStatus(404);
        $this->assertSame('{"error":"Member not found"}', $res->getContent());
        $this->assertSame(0, DB::table('attendance_logs')->count());
    }

    public function test_validation_error_shape_is_unchanged(): void
    {
        $gym = $this->makeGym();
        $res = $this->actingAsUser($this->makeAdmin($gym))->store([]);
        $res->assertStatus(422);
        $this->assertSame('{"message":"The gym member id field is required.","errors":{"gym_member_id":["The gym member id field is required."]}}', $res->getContent());
    }

    public function test_staff_without_attendance_module_is_forbidden(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $res = $this->actingAsUser($this->makeStaff($gym, ['members']))->store(['gym_member_id' => $mid]);
        $res->assertStatus(403);
        $this->assertSame('{"error":"Forbidden \\u2014 insufficient permissions","required":"attendance"}', $res->getContent());
    }

    public function test_no_active_subscription(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        // ended yesterday → filtered out
        $this->makeMembership($gym, $mid, 'duration', ['end_date' => Carbon::now()->subDays(2)]);

        $res = $this->actingAsUser($this->makeAdmin($gym))->store(['gym_member_id' => $mid]);
        $res->assertStatus(422);
        $this->assertSame('{"error":"Member does not have an active subscription"}', $res->getContent());
    }

    public function test_gym_entry_success_writes_row_without_decrement(): void
    {
        $gym = $this->makeGym();
        [$branch] = $this->makeBranch($gym);
        [, $mid] = $this->makeMember($gym, 'Sara');
        $mm = $this->makeMembership($gym, $mid, 'duration');
        $admin = $this->makeAdmin($gym);

        $res = $this->actingAsUser($admin)->store([
            'gym_member_id' => $mid, 'check_in_at' => '2026-11-20T08:00:00+02:00',
            'method' => 'manual', 'access_point' => 'Front desk', 'branch_id' => $branch,
        ]);
        $res->assertStatus(201);
        $id = $res->json('data.id');
        $this->assertTrue(Str::isUuid($id));
        $this->assertSame('{"data":{"id":"' . $id . '"}}', $res->getContent());

        $row = DB::table('attendance_logs')->where('id', $id)->first();
        $this->assertSame($mid, $row->gym_member_id);
        $this->assertSame('manual', $row->method);
        $this->assertSame('Front desk', $row->access_point);
        $this->assertSame($branch, $row->branch_id);
        $this->assertNull($row->class_session_id);
        $this->assertNull($row->source_event_id ?? null);
        $this->assertSame(0, (int) DB::table('member_memberships')->where('id', $mm)->value('sessions_used'));

        $log = DB::table('staff_activity_logs')->where('entity_id', $id)->first();
        $this->assertSame('checkin', $log->action_type);
        $this->assertSame('attendance_logs', $log->entity);
        $this->assertSame('Admin checked in Sara (Gym Access)', $log->description);
    }

    public function test_gym_entry_with_sessions_plan_is_denied(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'sessions', ['sessions_total' => 8, 'sessions_remaining' => 8]);
        $res = $this->actingAsUser($this->makeAdmin($gym))->store(['gym_member_id' => $mid]);
        $res->assertStatus(422);
        $this->assertSame('{"error":"This plan does not allow gym access. Session plans are class-only."}', $res->getContent());
    }

    public function test_gym_entry_frozen(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration', ['freeze_status' => 'frozen']);
        $res = $this->actingAsUser($this->makeAdmin($gym))->store(['gym_member_id' => $mid]);
        $res->assertStatus(422);
        $this->assertSame('{"error":"Membership is frozen"}', $res->getContent());
    }

    public function test_class_entry_with_duration_plan_is_denied(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        $cs = $this->makeClassSession($gym);
        $res = $this->actingAsUser($this->makeAdmin($gym))->store(['gym_member_id' => $mid, 'class_session_id' => $cs]);
        $res->assertStatus(422);
        $this->assertSame('{"error":"This plan does not allow class access. Duration plans are gym-only."}', $res->getContent());
    }

    public function test_class_entry_frozen_and_spent(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $cs = $this->makeClassSession($gym);

        [, $frozen] = $this->makeMember($gym);
        $this->makeMembership($gym, $frozen, 'sessions', ['sessions_total' => 8, 'sessions_remaining' => 8, 'freeze_status' => 'frozen']);
        $res = $this->actingAsUser($admin)->store(['gym_member_id' => $frozen, 'class_session_id' => $cs]);
        $res->assertStatus(422);
        $this->assertSame('{"error":"Membership is frozen"}', $res->getContent());

        [, $spent] = $this->makeMember($gym);
        $this->makeMembership($gym, $spent, 'sessions', ['sessions_total' => 8, 'sessions_used' => 8, 'sessions_remaining' => 0]);
        $res = $this->actingAsUser($admin)->store(['gym_member_id' => $spent, 'class_session_id' => $cs]);
        $res->assertStatus(422);
        $this->assertSame('{"error":"No remaining sessions"}', $res->getContent());
    }

    public function test_class_entry_success_decrements_then_duplicate_is_rejected(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym, 'Omar');
        $mm = $this->makeMembership($gym, $mid, 'sessions', ['sessions_total' => 8, 'sessions_used' => 2, 'sessions_remaining' => 6]);
        $cs = $this->makeClassSession($gym);
        $admin = $this->makeAdmin($gym);

        $res = $this->actingAsUser($admin)->store(['gym_member_id' => $mid, 'class_session_id' => $cs, 'access_point' => 'Yoga']);
        $res->assertStatus(201);
        $id = $res->json('data.id');
        $this->assertSame('{"data":{"id":"' . $id . '"}}', $res->getContent());

        $m = DB::table('member_memberships')->where('id', $mm)->first();
        $this->assertSame(3, (int) $m->sessions_used);
        $this->assertSame(5, (int) $m->sessions_remaining);
        $this->assertSame('manual', DB::table('attendance_logs')->where('id', $id)->value('method'));
        $this->assertSame('Admin checked in Omar for Yoga (session decremented)',
            DB::table('staff_activity_logs')->where('entity_id', $id)->value('description'));

        $dup = $this->actingAsUser($admin)->store(['gym_member_id' => $mid, 'class_session_id' => $cs]);
        $dup->assertStatus(422);
        $this->assertSame('{"error":"Already checked in for this session"}', $dup->getContent());
        $this->assertSame(1, DB::table('attendance_logs')->count());
        $this->assertSame(3, (int) DB::table('member_memberships')->where('id', $mm)->value('sessions_used'));
    }

    public function test_duration_member_uses_transferred_sessions_for_class(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $sub = $this->makeMembership($gym, $mid, 'duration');
        $transfer = $this->makeMembership($gym, $mid, 'sessions', [
            'source_type' => 'transfer', 'sessions_total' => 3, 'sessions_remaining' => 3,
        ]);
        $cs = $this->makeClassSession($gym);

        $this->actingAsUser($this->makeStaff($gym))->store(['gym_member_id' => $mid, 'class_session_id' => $cs])->assertStatus(201);
        $this->assertSame(1, (int) DB::table('member_memberships')->where('id', $transfer)->value('sessions_used'));
        $this->assertSame(2, (int) DB::table('member_memberships')->where('id', $transfer)->value('sessions_remaining'));
        $this->assertSame(0, (int) DB::table('member_memberships')->where('id', $sub)->value('sessions_used'));
    }

    public function test_unbounded_class_bucket_decrement_never_goes_negative(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $mm = $this->makeMembership($gym, $mid, 'duration_session', ['sessions_total' => null, 'sessions_remaining' => null]);
        $cs = $this->makeClassSession($gym);
        $this->actingAsUser($this->makeAdmin($gym))->store(['gym_member_id' => $mid, 'class_session_id' => $cs])->assertStatus(201);
        $m = DB::table('member_memberships')->where('id', $mm)->first();
        $this->assertSame(1, (int) $m->sessions_used);
        $this->assertSame(0, (int) $m->sessions_remaining);
    }
}
