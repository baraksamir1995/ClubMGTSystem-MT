<?php

namespace Tests\Feature\Attendance;

use App\Services\MemberPassService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** PHASE3-CONTRACT §2: member_qr sync with signed branch QR v2 + rotating replay protection. */
class MemberQrV2SyncTest extends OfflineSyncTestCase
{
    private function setUpGym(): array
    {
        $gym = $this->makeGym();
        [$branch, $token] = $this->makeBranch($gym, 'Zayed');
        [$member, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        return [$gym, $branch, $token, $member, $mid];
    }

    private function mqr(string $gym, string $raw, ?Carbon $at = null, array $extra = []): array
    {
        return $this->attendanceEvent($gym, array_merge([
            'attendance_method' => 'member_qr', 'qr' => ['raw' => $raw],
            'device_recorded_at' => self::at($at ?? Carbon::now()->subHour()),
        ], $extra));
    }

    /** First token of a rotating batch starting at $start (scan at start + 10 s). */
    private function rotating(string $gym, string $branch, Carbon $start): string
    {
        return $this->branchQr($gym, $branch, 'rotating', $start);
    }

    public function test_static_poster_offline_check_in_is_accepted_with_qr_meta(): void
    {
        [$gym, $branch, , $member, $mid] = $this->setUpGym();
        $poster = $this->branchQr($gym, $branch, 'static', Carbon::now()->subDays(3));
        $r = $this->syncOne($member, $this->mqr($gym, $poster), null, 'member');

        $this->assertSame('accepted', $r['status']);
        $row = DB::table('attendance_logs')->first();
        $this->assertSame([$mid, $branch, 'qr', 'Zayed'], [$row->gym_member_id, $row->branch_id, $row->method, $row->access_point]);
        $meta = json_decode(DB::table('attendance_events')->value('qr_meta'), true);
        $this->assertSame(['verified', 'v', 'mode', 'kid', 'jti', 'iat', 'exp', 'branch_id'], array_keys($meta));
        $this->assertSame([true, 2, 'static', $branch], [$meta['verified'], $meta['v'], $meta['mode'], $meta['branch_id']]);

        // Static posters: no replay limit beyond D1 — the same poster works again.
        $again = $this->syncOne($member, $this->mqr($gym, $poster, Carbon::now()->subMinutes(30)), null, 'member');
        $this->assertSame('accepted', $again['status']);
    }

    public function test_rotating_token_replay_in_one_batch_and_across_batches(): void
    {
        [$gym, $branch, , $member, $mid] = $this->setUpGym();
        $start = Carbon::now()->subHour()->startOfMinute();
        $raw = $this->rotating($gym, $branch, $start);
        $scan = $start->copy()->addSeconds(10);

        $results = $this->sync($member, [$this->mqr($gym, $raw, $scan), $this->mqr($gym, $raw, $scan->copy()->addSeconds(5))], null, 'member')
            ->assertOk()->json('results');
        $this->assertSame(['accepted', 'duplicate'], array_column($results, 'status'));
        $this->assertSame('qr_replayed', $results[1]['code']);
        $this->assertSame($results[0]['attendance_id'], $results[1]['attendance_id']);

        $later = $this->syncOne($member, $this->mqr($gym, $raw, $scan->copy()->addSeconds(20)), (string) Str::uuid(), 'member');
        $this->assertSame(['duplicate', 'qr_replayed', $results[0]['attendance_id']], [$later['status'], $later['code'], $later['attendance_id']]);
        $this->assertSame(1, DB::table('attendance_logs')->count());
        $this->assertSame(1, DB::table('attendance_qr_redemptions')->count());

        // Replay protection is per member: someone else may use the same token once.
        [$other, $otherMid] = $this->makeMember($gym);
        $this->makeMembership($gym, $otherMid, 'duration');
        $this->assertSame('accepted', $this->syncOne($other, $this->mqr($gym, $raw, $scan), (string) Str::uuid(), 'member')['status']);
    }

    public function test_redemption_unique_index_backstops_the_check(): void
    {
        [$gym, , , , $mid] = $this->setUpGym();
        $row = ['gym_id' => $gym, 'jti' => str_repeat('j', 22), 'gym_member_id' => $mid, 'event_id' => (string) Str::uuid(), 'created_at' => now()];
        DB::table('attendance_qr_redemptions')->insert($row + ['id' => (string) Str::uuid()]);
        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        DB::table('attendance_qr_redemptions')->insert(array_merge($row, ['id' => (string) Str::uuid(), 'event_id' => (string) Str::uuid()]));
    }

    public function test_rotating_expiry_grace_judged_at_device_time(): void
    {
        [$gym, $branch, , $member] = $this->setUpGym();
        $start = Carbon::now()->subHour()->startOfMinute();
        $raw = $this->rotating($gym, $branch, $start);

        $inGrace = $this->syncOne($member, $this->mqr($gym, $raw, $start->copy()->addSeconds(60 + 25)), null, 'member');
        $this->assertSame('accepted', $inGrace['status']);
        $late = $this->syncOne($member, $this->mqr($gym, $this->rotating($gym, $branch, $start), $start->copy()->addSeconds(60 + 31)), null, 'member');
        $this->assertSame(['rejected', 'qr_expired'], [$late['status'], $late['code']]);
        $this->assertSame(['verified' => false, 'reason' => 'qr_expired', 'v' => 2],
            json_decode(DB::table('attendance_events')->where('event_id', $late['event_id'])->value('qr_meta'), true));
    }

    public function test_cross_gym_regenerated_token_revoked_key_and_membership_rules(): void
    {
        [$gym, $branch, , $member, $mid] = $this->setUpGym();
        $other = $this->makeGym();
        [$foreignBranch] = $this->makeBranch($other);
        $poster = $this->branchQr($gym, $branch, 'static', Carbon::now()->subDays(2));

        $this->assertSame('qr_wrong_gym', $this->syncOne($member, $this->mqr($gym, $this->branchQr($other, $foreignBranch)), null, 'member')['code']);

        DB::table('branches')->where('id', $branch)->update(['qr_token' => (string) Str::uuid()]);
        $this->assertSame('qr_invalid', $this->syncOne($member, $this->mqr($gym, $poster), null, 'member')['code'], 'regenerated token');

        $fresh = $this->branchQr($gym, $branch, 'static', Carbon::now()->subDays(2));
        $kid = json_decode($fresh, true)['kid'];
        app(MemberPassService::class)->rotate($gym);
        app(MemberPassService::class)->revoke($gym, $kid);
        $this->assertSame('qr_invalid', $this->syncOne($member, $this->mqr($gym, $fresh), null, 'member')['code'], 'revoked key');

        DB::table('member_memberships')->where('gym_member_id', $mid)->update(['freeze_status' => 'frozen']);
        $this->assertSame('membership_frozen', $this->syncOne($member,
            $this->mqr($gym, $this->branchQr($gym, $branch, 'static', Carbon::now()->subDays(2))), null, 'member')['code']);
        $this->assertSame(0, DB::table('attendance_logs')->count());
    }

    public function test_v1_member_qr_is_online_only_and_v2_obeys_the_policy_flag(): void
    {
        [$gym, $branch, $token, $member] = $this->setUpGym();

        $offlineV1 = $this->syncOne($member, $this->mqr($gym, $token), null, 'member');
        $this->assertSame('offline_disabled', $offlineV1['code']);
        $recentV1 = $this->syncOne($member, $this->mqr($gym, $token, Carbon::now()->subSeconds(30)), null, 'member');
        $this->assertSame('accepted', $recentV1['status'], 'v1 near-real-time unchanged');

        config(['attendance_offline.allow_member_qr_offline' => false]);
        $r = $this->syncOne($member, $this->mqr($gym, $this->branchQr($gym, $branch)), null, 'member');
        $this->assertSame('offline_disabled', $r['code'], 'v2 offline still needs allow_member_qr_offline');
    }
}
