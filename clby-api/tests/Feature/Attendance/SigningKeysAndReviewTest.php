<?php

namespace Tests\Feature\Attendance;

use App\Services\BranchQrService;
use App\Services\MemberPassService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Gym signing keys (kept after PHASE3 Amendment 2 removed the member pass:
 * they sign the gym + coach QR v2), the attendance:pass-key command, and
 * the read-only review endpoint GET /api/attendance/offline/events.
 */
class SigningKeysAndReviewTest extends OfflineSyncTestCase
{
    private function svc(): MemberPassService
    {
        return app(MemberPassService::class);
    }

    private function staffQr(string $gym, string $mid, ?string $qr, array $extra = []): array
    {
        return $this->attendanceEvent($gym, array_merge(
            ['member_id' => $mid, 'attendance_method' => 'staff_qr', 'qr' => $qr === null ? null : ['raw' => $qr]],
            $extra
        ));
    }

    public function test_pass_keys_list_active_retired_and_revoked_never_secrets(): void
    {
        $gym = $this->makeGym();
        [$branch] = $this->makeBranch($gym);
        $old = $this->svc()->activeKey($gym)->kid;
        $poster = app(BranchQrService::class)->issueStatic($gym, DB::table('branches')->where('id', $branch)->first());

        $this->assertNotNull($this->svc()->revoke($gym, $old), 'active key cannot be revoked');
        $mid = $this->svc()->rotate($gym);
        $new = $this->svc()->rotate($gym);
        $this->assertNull($this->svc()->revoke($gym, $mid));

        $keys = collect($this->svc()->passKeys($gym))->keyBy('kid');
        $this->assertSame(['active', 'retired', 'revoked'], [$keys[$new]['status'], $keys[$old]['status'], $keys[$mid]['status']]);
        $this->assertNull($keys[$new]['valid_until']);
        $this->assertTrue(Carbon::parse($keys[$mid]['valid_until'])->lte(Carbon::now()));
        $this->assertSame(['kid', 'public_key', 'status', 'valid_until'], array_keys($keys[$new]));
        $this->assertSame(43, strlen($keys[$new]['public_key']));

        // The retired key still verifies its QR within grace; revoked keys never.
        $this->assertTrue(app(BranchQrService::class)->verify($poster['qr'], $gym, Carbon::now())['ok']);
        $this->svc()->revoke($gym, $old);
        $this->assertSame('qr_invalid', app(BranchQrService::class)->verify($poster['qr'], $gym, Carbon::now())['code']);

        $other = $this->makeGym();
        $this->assertNotNull($this->svc()->revoke($other, $new), "can't revoke another gym's key");

        [$member] = $this->makeMember($gym);
        $body = $this->actingAsUser($member)->getJson('/api/attendance/offline/me')->assertOk()->getContent();
        foreach (DB::table('gym_signing_keys')->where('gym_id', $gym)->pluck('secret_key_enc') as $enc) {
            $this->assertStringNotContainsString($enc, $body);
            $this->assertStringNotContainsString(Crypt::decryptString($enc), $body);
        }
        $this->assertStringNotContainsString('secret', $body);
    }

    public function test_artisan_pass_key_command(): void
    {
        $gym = $this->makeGym();
        $active = $this->svc()->activeKey($gym)->kid;
        $secretEnc = DB::table('gym_signing_keys')->where('kid', $active)->value('secret_key_enc');
        $secret = Crypt::decryptString($secretEnc);

        $this->assertSame(1, Artisan::call('attendance:pass-key', ['gym_id' => $gym, '--revoke' => $active]));
        $this->assertStringContainsString('Rotate first', Artisan::output());
        $this->assertSame('active', DB::table('gym_signing_keys')->where('kid', $active)->value('status'));

        $this->assertSame(0, Artisan::call('attendance:pass-key', ['gym_id' => $gym, '--rotate' => true, '--revoke' => $active]));
        $out = Artisan::output();
        $newKid = DB::table('gym_signing_keys')->where('gym_id', $gym)->where('status', 'active')->value('kid');
        $this->assertStringContainsString("New active kid: {$newKid}", $out);
        $this->assertStringContainsString("Revoked kid: {$active}", $out);
        $this->assertSame('revoked', DB::table('gym_signing_keys')->where('kid', $active)->value('status'));
        $this->assertStringNotContainsString($secret, $out);
        $this->assertStringNotContainsString($secretEnc, $out);

        $this->assertSame(0, Artisan::call('attendance:pass-key', ['gym_id' => $gym]));
        $list = Artisan::output();
        $this->assertStringContainsString($newKid, $list);
        $this->assertStringContainsString('revoked', $list);
        $this->assertStringNotContainsString('secret', strtolower($list));

        $this->assertSame(1, Artisan::call('attendance:pass-key', ['gym_id' => (string) Str::uuid()]));
    }

    /* §6 */
    public function test_review_endpoint_hides_exception_text_for_error_rows(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        DB::table('attendance_events')->insert([
            'event_id' => (string) Str::uuid(), 'kind' => 'attendance', 'method' => 'manual', 'gym_id' => $gym,
            'actor_user_id' => $admin->id, 'actor_type' => 'gym_admin', 'server_received_at' => now()->toIso8601String(),
            'result' => 'error', 'reason_code' => 'server_error', 'retryable' => true,
            'reason_message' => 'QueryException: SQLSTATE[23505] insert into "attendance_logs" values (secret-binding)',
            'payload_hash' => str_repeat('a', 64), 'flags' => '[]', 'attempts' => 1,
        ]);
        $row = $this->actingAsUser($admin)->getJson('/api/attendance/offline/events?result=error')->assertOk()->json('data.0');
        $this->assertSame('server_error', $row['code']);
        $this->assertSame('Temporary server error; the event will be retried.', $row['message']);
    }

    /* ── GET /api/attendance/offline/events ─────────────────────── */

    public function test_review_endpoint_scoping_filters_and_paging(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [, $mid] = $this->makeMember($gym, 'Sara');
        $this->makeMembership($gym, $mid, 'duration');
        [, $foreignMid] = $this->makeMember($other);
        $this->makeMembership($other, $foreignMid, 'duration');
        $staff = $this->makeStaff($gym);

        $this->sync($staff, [
            $this->attendanceEvent($gym, ['member_id' => $mid]),
            $this->staffQr($gym, $mid, 'garbage'),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => self::at(Carbon::now()->subMinute())]),
        ])->assertOk();
        $this->sync($this->makeAdmin($other), [$this->attendanceEvent($other, ['member_id' => $foreignMid])], (string) Str::uuid())->assertOk();

        $admin = $this->makeAdmin($gym);
        $all = $this->actingAsUser($admin)->getJson('/api/attendance/offline/events')->assertOk();
        $this->assertCount(3, $all->json('data'), "other gym's events never visible");
        $this->assertNull($all->json('next_cursor'));
        $row = collect($all->json('data'))->firstWhere('result', 'rejected');
        $this->assertSame('qr_invalid', $row['code']);
        $this->assertNull($row['member'], 'unverified pass: no server-derived member');
        $this->assertSame('Sara', collect($all->json('data'))->firstWhere('result', 'accepted')['member']['full_name']);
        $this->assertSame($staff->full_name, $row['actor']['full_name']);
        $this->assertSame($this->deviceId, $row['device']['device_id']);
        $this->assertNotNull($row['device']['label']);
        $this->assertSame('staff_qr', $row['method']);

        $rejected = $this->getJson('/api/attendance/offline/events?result=rejected')->assertOk()->json('data');
        $this->assertSame(['rejected'], array_values(array_unique(array_column($rejected, 'result'))));
        $this->assertCount(1, $rejected);

        // Paging: 2 + 1, no overlap, newest first.
        $p1 = $this->getJson('/api/attendance/offline/events?limit=2')->assertOk();
        $this->assertCount(2, $p1->json('data'));
        $p2 = $this->getJson('/api/attendance/offline/events?limit=2&cursor=' . $p1->json('next_cursor'))->assertOk();
        $this->assertCount(1, $p2->json('data'));
        $this->assertNull($p2->json('next_cursor'));
        $ids = array_merge(array_column($p1->json('data'), 'event_id'), array_column($p2->json('data'), 'event_id'));
        $this->assertCount(3, array_unique($ids));
        $this->assertEqualsCanonicalizing(array_column($all->json('data'), 'event_id'), $ids);

        // needs_review filter.
        $this->assertCount(0, $this->getJson('/api/attendance/offline/events?needs_review=1')->json('data'));

        // Permissions: attendance view required; members never.
        $this->actingAsUser($this->makeStaff($gym, ['members']))->getJson('/api/attendance/offline/events')->assertStatus(403);
        [$member] = $this->makeMember($gym);
        $this->actingAsUser($member)->getJson('/api/attendance/offline/events')->assertStatus(403);
        $this->actingAsUser($admin)->getJson('/api/attendance/offline/events?cursor=bogus')->assertStatus(422);
    }

    public function test_review_endpoint_needs_review_filter(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'sessions', ['sessions_total' => 2, 'sessions_used' => 2, 'sessions_remaining' => 0]);
        $cs = $this->makeClassSession($gym);
        $admin = $this->makeAdmin($gym);
        $this->sync($admin, [
            $this->attendanceEvent($gym, ['member_id' => $mid, 'class_session_id' => $cs]),
            $this->attendanceEvent($gym, ['member_id' => $mid]),
        ])->assertOk();

        $flagged = $this->actingAsUser($admin)->getJson('/api/attendance/offline/events?needs_review=1')->assertOk()->json('data');
        $this->assertCount(1, $flagged);
        $this->assertSame(['sessions_exhausted'], $flagged[0]['flags']);
        $this->assertTrue($flagged[0]['needs_review']);
        $this->assertNotNull($flagged[0]['attendance_id']);
    }
}
