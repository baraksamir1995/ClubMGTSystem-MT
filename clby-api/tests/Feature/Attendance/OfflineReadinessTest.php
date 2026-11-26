<?php

namespace Tests\Feature\Attendance;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** GET /api/attendance/offline/{status,bootstrap,me}. */
class OfflineReadinessTest extends OfflineSyncTestCase
{
    private const POLICY_KEYS = [
        'enabled', 'max_batch', 'max_data_age_hours', 'max_event_age_days', 'future_skew_seconds',
        'allow_manual_offline', 'allow_staff_qr_offline', 'allow_member_qr_offline',
        'allow_service_session_offline', 'expired_cache_policy', 'retry_base_seconds', 'retry_max_seconds', 'online_grace_seconds',
    ];

    public function test_status_reports_policy_and_device(): void
    {
        config(['attendance_offline.enabled' => false, 'attendance_offline.allow_member_qr_offline' => false]);
        $gym = $this->makeGym();
        [$member, $mid] = $this->makeMember($gym);
        $this->actingAsUser($member);

        $res = $this->getJson('/api/attendance/offline/status?device_id=' . $this->deviceId)->assertOk();
        $this->assertSame(120, $res->json('policy.online_grace_seconds'));
        $this->assertSame(self::POLICY_KEYS, array_keys($res->json('policy')));
        $this->assertFalse($res->json('enabled'));
        $this->assertFalse($res->json('policy.allow_member_qr_offline'));
        $this->assertSame(50, $res->json('policy.max_batch'));
        $this->assertSame(['registered' => false, 'revoked' => false], $res->json('device'));

        $this->syncOne($member, $this->attendanceEvent($gym), null, 'member'); // registers the (device, user) pair
        $this->getJson('/api/attendance/offline/status?device_id=' . $this->deviceId)
            ->assertJsonPath('device.registered', true)->assertJsonPath('device.revoked', false);

        // Another user on the same device id: their own pair isn't registered yet.
        $this->actingAsUser($this->makeAdmin($gym));
        $this->getJson('/api/attendance/offline/status?device_id=' . $this->deviceId)->assertJsonPath('device.registered', false);
    }

    public function test_admin_bootstrap_shape_and_cursor_paging(): void
    {
        $gym = $this->makeGym('Africa/Cairo');
        [$branch] = $this->makeBranch($gym, 'Main');
        [, $a] = $this->makeMember($gym, 'Alpha');
        [, $b] = $this->makeMember($gym, 'Beta');
        $this->makeMembership($gym, $a, 'duration', ['allowed_branch_ids' => '{' . $branch . '}']);
        $this->makeMembership($gym, $b, 'sessions', ['sessions_total' => 8, 'sessions_remaining' => 5]);
        $cs = $this->makeClassSession($gym, $branch);
        $other = $this->makeGym();
        $this->makeMember($other, 'Foreign');
        $staff = $this->makeStaff($gym);
        $this->syncOne($staff, $this->attendanceEvent($gym, ['member_id' => $a]));

        $this->actingAsUser($staff);
        $page1 = $this->getJson('/api/attendance/offline/bootstrap?limit=1')->assertOk();
        $this->assertSame(['server_time', 'as_of', 'gym', 'policy', 'branches', 'members', 'class_sessions', 'recent_attendance', 'next_cursor'], array_keys($page1->json()));
        $this->assertSame(['id' => $gym, 'name' => $page1->json('gym.name'), 'timezone' => 'Africa/Cairo'], $page1->json('gym'));
        $this->assertCount(1, $page1->json('members'));
        $this->assertNotNull($page1->json('next_cursor'));
        $this->assertSame([['id' => $branch, 'name' => 'Main', 'is_active' => true]], $page1->json('branches'));
        $this->assertSame($cs, $page1->json('class_sessions.0.id'));
        $this->assertSame('Yoga', $page1->json('class_sessions.0.name'));
        $this->assertCount(1, $page1->json('recent_attendance'));

        $page2 = $this->getJson('/api/attendance/offline/bootstrap?limit=1&cursor=' . $page1->json('next_cursor'))->assertOk();
        // Later pages: members only (branches / class_sessions / recent_attendance on page 1).
        $this->assertSame(['server_time', 'as_of', 'gym', 'policy', 'members', 'next_cursor'], array_keys($page2->json()));
        $this->assertCount(1, $page2->json('members'));
        $this->assertNull($page2->json('next_cursor'));

        $members = collect([$page1->json('members.0'), $page2->json('members.0')])->keyBy('gym_member_id');
        $this->assertEqualsCanonicalizing([$a, $b], $members->keys()->all(), 'only this gym');
        $this->assertSame('4567', $members[$a]['phone_last4']);
        $this->assertSame([$branch], $members[$a]['buckets'][0]['allowed_branch_ids']);
        $this->assertSame(
            ['membership_id', 'plan_type', 'source_type', 'status', 'payment_status', 'start_date', 'end_date', 'sessions_remaining', 'sessions_total', 'freeze_status', 'allowed_branch_ids'],
            array_keys($members[$b]['buckets'][0])
        );
        $this->assertSame(5, $members[$b]['buckets'][0]['sessions_remaining']);
        // CONTRACT §6.4: date-only bucket fields, gym-local.
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $members[$b]['buckets'][0]['start_date']);
        $this->assertSame(Carbon::now('Africa/Cairo')->addDays(20)->toDateString(), $members[$a]['buckets'][0]['end_date']);
    }

    public function test_bootstrap_permissions(): void
    {
        $gym = $this->makeGym();
        [$member] = $this->makeMember($gym);
        $this->actingAsUser($member)->getJson('/api/attendance/offline/bootstrap')->assertStatus(403);
        $this->actingAsUser($this->makeStaff($gym, ['members']))->getJson('/api/attendance/offline/bootstrap')
            ->assertStatus(403)->assertJsonPath('code', 'permission_denied');
        $this->actingAsUser($this->makeAdmin($gym))->getJson('/api/attendance/offline/bootstrap?app=coach')->assertStatus(403);
    }

    public function test_coach_bootstrap_lists_only_own_assignments(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $otherTp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym, 'Client');
        $mine = $this->makeAssignment($gym, $mid, $tp, ['sessions_used' => 4, 'expires_at' => Carbon::now()->addMonth()]);
        $this->makeAssignment($gym, $mid, $otherTp);
        $this->syncOne($coach, $this->serviceEvent($gym, $mine), null, 'coach');

        $res = $this->actingAsUser($coach)->getJson('/api/attendance/offline/bootstrap')->assertOk();
        $this->assertSame(['server_time', 'as_of', 'gym', 'policy', 'assignments', 'recent_service_logs', 'next_cursor'], array_keys($res->json()));
        $this->assertCount(1, $res->json('assignments'));
        $row = $res->json('assignments.0');
        $this->assertSame($mine, $row['assignment_id']);
        $this->assertSame('Client', $row['member_name']);
        $this->assertSame(5, $row['sessions_used']);
        $this->assertNotNull($row['last_session_at']);
        $this->assertCount(1, $res->json('recent_service_logs'));
    }

    public function test_member_me_snapshot(): void
    {
        $gym = $this->makeGym();
        [$branch, $token] = $this->makeBranch($gym);
        [$member, $mid] = $this->makeMember($gym, 'Me');
        $this->makeMembership($gym, $mid, 'duration');
        [, $other] = $this->makeMember($gym);
        $this->makeMembership($gym, $other, 'duration');
        $this->syncOne($member, $this->attendanceEvent($gym, ['attendance_method' => 'member_qr', 'qr' => ['raw' => $token]]), null, 'member');
        $this->syncOne($this->makeAdmin($gym), $this->attendanceEvent($gym, ['member_id' => $other]), (string) Str::uuid());

        $res = $this->actingAsUser($member)->getJson('/api/attendance/offline/me')->assertOk();
        $this->assertSame(['server_time', 'as_of', 'gym', 'policy', 'member', 'buckets', 'branches', 'recent_attendance'], array_keys($res->json()));
        $this->assertSame($mid, $res->json('member.gym_member_id'));
        $this->assertCount(1, $res->json('buckets'));
        $this->assertCount(1, $res->json('recent_attendance'), 'own attendance only');
        $this->assertSame($mid, $res->json('recent_attendance.0.gym_member_id'));

        $this->actingAsUser($this->makeAdmin($gym))->getJson('/api/attendance/offline/me')->assertStatus(403);
        $this->assertSame(2, DB::table('attendance_logs')->count());
    }
}
