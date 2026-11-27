<?php

namespace Tests\Feature\Attendance;

use Illuminate\Support\Facades\DB;

/**
 * Phase 3 verification LOW fixes: /offline/me only hands out check-in
 * tokens the member may use and only active trainers; with the offline
 * policy off every snapshot is minimal (policy + keys, no lists/tokens).
 */
class OfflineScopeTest extends OfflineSyncTestCase
{
    public function test_me_sends_tokens_only_for_active_allowed_branches_and_only_active_trainers(): void
    {
        $gym = $this->makeGym();
        [$main, $mainToken] = $this->makeBranch($gym, 'A Main');
        [$other] = $this->makeBranch($gym, 'B Other');
        [$closed] = $this->makeBranch($gym, 'C Closed', false);
        [$member, $mid] = $this->makeMember($gym);
        $mm = $this->makeMembership($gym, $mid, 'duration', ['allowed_branch_ids' => '{' . $main . '}']);
        [, $active] = $this->makeCoach($gym);
        [, $inactive] = $this->makeCoach($gym);
        DB::table('trainer_profiles')->where('id', $inactive)->update(['is_active' => false]);

        $me = $this->actingAsUser($member)->getJson('/api/attendance/offline/me')->assertOk();
        $tokens = collect($me->json('branches'))->pluck('qr_token', 'id')->all();
        $this->assertSame([$main => $mainToken, $other => null, $closed => null], $tokens, 'allowed + active only');
        $this->assertSame([$active], collect($me->json('trainers'))->pluck('id')->all());

        // Frozen membership → no branch may be entered → no tokens at all.
        DB::table('member_memberships')->where('id', $mm)->update(['freeze_status' => 'frozen']);
        $tokens = collect($this->getJson('/api/attendance/offline/me')->json('branches'))->pluck('qr_token')->filter()->all();
        $this->assertSame([], $tokens);
    }

    public function test_policy_off_serves_minimal_snapshots(): void
    {
        config(['attendance_offline.enabled' => false]);
        $gym = $this->makeGym();
        $this->makeBranch($gym);
        [$member, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        [$coach, $tp] = $this->makeCoach($gym);
        $this->makeAssignment($gym, $mid, $tp);

        $admin = $this->actingAsUser($this->makeAdmin($gym))->getJson('/api/attendance/offline/bootstrap')->assertOk()->json();
        $this->assertSame(['server_time', 'as_of', 'gym', 'policy', 'pass_keys', 'branches', 'members', 'class_sessions', 'recent_attendance', 'next_cursor'], array_keys($admin));
        $this->assertSame([[], [], [], []], [$admin['branches'], $admin['members'], $admin['class_sessions'], $admin['recent_attendance']]);
        $this->assertNull($admin['next_cursor']);
        $this->assertFalse($admin['policy']['enabled']);
        $this->assertNotEmpty($admin['pass_keys']);

        $c = $this->actingAsUser($coach)->getJson('/api/attendance/offline/bootstrap')->assertOk()->json();
        $this->assertSame([[], [], null, null], [$c['assignments'], $c['recent_service_logs'], $c['own_qr'], $c['next_cursor']]);

        $me = $this->actingAsUser($member)->getJson('/api/attendance/offline/me')->assertOk()->json();
        $this->assertNull($me['member']);
        $this->assertSame([[], [], [], [], []], [$me['buckets'], $me['branches'], $me['recent_attendance'], $me['trainers'], $me['assignments']]);
        $this->assertStringNotContainsString('qr_token', json_encode($me));
        $this->assertNotEmpty($me['pass_keys']);

        // Permissions still apply when the policy is off.
        $this->actingAsUser($this->makeStaff($gym, ['members']))->getJson('/api/attendance/offline/bootstrap')->assertStatus(403);
        $this->actingAsUser($this->makeAdmin($gym))->getJson('/api/attendance/offline/me')->assertStatus(403);
    }
}
