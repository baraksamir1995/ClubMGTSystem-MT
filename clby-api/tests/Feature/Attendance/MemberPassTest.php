<?php

namespace Tests\Feature\Attendance;

use App\Services\MemberPassService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** PHASE2-CONTRACT member pass: keys, issue, verify, endpoints. */
class MemberPassTest extends OfflineSyncTestCase
{
    private function svc(): MemberPassService
    {
        return app(MemberPassService::class);
    }

    /** Re-sign a modified pass payload with the gym's real key (to isolate a single check). */
    private function resign(array $p, string $gymId): string
    {
        $key = DB::table('gym_signing_keys')->where('kid', $p['kid'])->first();
        $sk = MemberPassService::b64urlDecode(Crypt::decryptString($key->secret_key_enc));
        $p['sig'] = MemberPassService::b64url(sodium_crypto_sign_detached(
            MemberPassService::canonical($p['kid'], $p['g'], $p['m'], $p['n'], $p['iat'], $p['exp']), $sk));
        return json_encode($p, JSON_UNESCAPED_SLASHES);
    }

    public function test_issue_format_and_round_trip(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $pass = $this->svc()->issue($gym, $mid, 101);

        $this->assertSame(['qr', 'expires_at', 'kid'], array_keys($pass));
        $p = json_decode($pass['qr'], true);
        $this->assertSame(['t', 'v', 'kid', 'g', 'm', 'n', 'iat', 'exp', 'sig'], array_keys($p), 'key order per contract');
        $this->assertSame('clby_mp', $p['t']);
        $this->assertSame(1, $p['v']);
        $this->assertSame($gym, $p['g']);
        $this->assertSame($mid, $p['m']);
        $this->assertSame(101, $p['n']);
        $this->assertSame(30 * 86400, $p['exp'] - $p['iat']);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]+$/', $p['sig'], 'base64url, no padding');
        $this->assertStringNotContainsString(' ', $pass['qr'], 'compact JSON');

        // Independent verification with the published public key.
        $pk = MemberPassService::b64urlDecode($this->svc()->passKeys($gym)[0]['public_key']);
        $msg = "clby_mp|1|{$p['kid']}|{$gym}|{$mid}|101|{$p['iat']}|{$p['exp']}";
        $this->assertTrue(sodium_crypto_sign_verify_detached(MemberPassService::b64urlDecode($p['sig']), $msg, $pk));

        $v = $this->svc()->verify($pass['qr'], $gym);
        $this->assertTrue($v['ok']);
        $this->assertSame($mid, $v['pass']['m']);
    }

    public function test_null_member_number_signs_empty_field(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $p = json_decode($this->svc()->issue($gym, $mid, null)['qr'], true);
        $this->assertNull($p['n']);
        $pk = MemberPassService::b64urlDecode($this->svc()->passKeys($gym)[0]['public_key']);
        $this->assertTrue(sodium_crypto_sign_verify_detached(
            MemberPassService::b64urlDecode($p['sig']), "clby_mp|1|{$p['kid']}|{$gym}|{$mid}||{$p['iat']}|{$p['exp']}", $pk));
    }

    public function test_tampering_and_shape_are_qr_invalid(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        [, $other] = $this->makeMember($gym);
        $qr = $this->svc()->issue($gym, $mid, 7)['qr'];
        $p = json_decode($qr, true);

        $tampered = [
            array_merge($p, ['m' => $other]),
            array_merge($p, ['n' => 8]),
            array_merge($p, ['exp' => $p['exp'] + 86400]),
            array_merge($p, ['sig' => strrev($p['sig'])]),
            array_merge($p, ['kid' => 'deadbeef0000']),     // unknown key
            array_merge($p, ['v' => 2]),
            array_merge($p, ['t' => 'other']),
            array_diff_key($p, ['n' => true]),             // missing field
            array_merge($p, ['iat' => (string) $p['iat']]), // wrong type
        ];
        foreach ($tampered as $i => $t) {
            $this->assertSame('qr_invalid', $this->svc()->verify(json_encode($t), $gym)['code'] ?? 'ok', "case {$i}");
        }
        $this->assertSame('qr_invalid', $this->svc()->verify('not json', $gym)['code']);
        $this->assertSame('qr_invalid', $this->svc()->verify(null, $gym)['code']);
    }

    public function test_wrong_gym_expired_future_and_deleted_member(): void
    {
        $gymA = $this->makeGym();
        $gymB = $this->makeGym();
        [, $mid] = $this->makeMember($gymA);
        $qr = $this->svc()->issue($gymA, $mid, null)['qr'];

        $this->assertSame('qr_wrong_gym', $this->svc()->verify($qr, $gymB)['code']);

        $old = $this->svc()->issue($gymA, $mid, null, null, Carbon::now()->subDays(31))['qr'];
        $this->assertSame('pass_expired', $this->svc()->verify($old, $gymA)['code']);
        // …but it was valid when scanned 2 days into its life (D2 spirit: expiry as of the scan).
        $this->assertTrue($this->svc()->verify($old, $gymA, Carbon::now()->subDays(29))['ok']);

        $future = $this->svc()->issue($gymA, $mid, null, null, Carbon::now()->addHour())['qr'];
        $this->assertSame('qr_invalid', $this->svc()->verify($future, $gymA)['code'], 'iat beyond skew');

        DB::table('gym_members')->where('id', $mid)->update(['deleted_at' => now()]);
        $this->assertSame('member_not_found', $this->svc()->verify($qr, $gymA)['code']);
    }

    public function test_rotation_and_retired_key_grace(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $oldQr = $this->svc()->issue($gym, $mid, null)['qr'];
        $oldKid = json_decode($oldQr, true)['kid'];

        $newKid = $this->svc()->rotate($gym);
        $this->assertNotSame($oldKid, $newKid);
        $keys = collect($this->svc()->passKeys($gym))->keyBy('kid');
        $this->assertSame('active', $keys[$newKid]['status']);
        $this->assertNull($keys[$newKid]['valid_until']);
        $this->assertSame('retired', $keys[$oldKid]['status']);
        $this->assertNotNull($keys[$oldKid]['valid_until']);
        $this->assertSame(1, DB::table('gym_signing_keys')->where('gym_id', $gym)->where('status', 'active')->count());

        $this->assertTrue($this->svc()->verify($oldQr, $gym)['ok'], 'retired key still verifies within grace');
        $this->assertSame($newKid, json_decode($this->svc()->issue($gym, $mid, null)['qr'], true)['kid'], 'new passes use the new key');

        // Past the grace the retired key is gone from pass_keys and refused.
        DB::table('gym_signing_keys')->where('kid', $oldKid)->update(['retired_at' => Carbon::now()->subDays(31)->toIso8601String()]);
        $this->assertArrayNotHasKey($oldKid, collect($this->svc()->passKeys($gym))->keyBy('kid')->all());
        $this->assertSame('qr_invalid', $this->svc()->verify($oldQr, $gym)['code']);
    }

    public function test_key_of_another_gym_cannot_sign_for_this_gym(): void
    {
        $gymA = $this->makeGym();
        $gymB = $this->makeGym();
        [, $mid] = $this->makeMember($gymA);
        // A pass that claims gym A but is signed with gym B's key.
        $p = json_decode($this->svc()->issue($gymB, $mid, null)['qr'], true);
        $p['g'] = $gymA;
        $this->assertSame('qr_invalid', $this->svc()->verify($this->resign($p, $gymB), $gymA)['code']);
    }

    public function test_endpoints_and_secret_never_returned(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [$member, $mid] = $this->makeMember($gym);
        [, $foreign] = $this->makeMember($other);

        $mine = $this->actingAsUser($member)->getJson('/api/me/member-pass')->assertOk();
        $this->assertSame(['qr', 'expires_at', 'kid'], array_keys($mine->json()));
        $this->assertSame($mid, json_decode($mine->json('qr'), true)['m']);
        // Cached: same pass on the next call.
        $this->assertSame($mine->json('qr'), $this->getJson('/api/me/member-pass')->json('qr'));

        $admin = $this->makeAdmin($gym);
        $card = $this->actingAsUser($admin)->getJson("/api/members/{$mid}/member-pass")->assertOk();
        $this->assertTrue($this->svc()->verify($card->json('qr'), $gym)['ok']);
        $this->getJson("/api/members/{$foreign}/member-pass")->assertStatus(404);
        $this->actingAsUser($this->makeStaff($gym, ['attendance']))->getJson("/api/members/{$mid}/member-pass")->assertStatus(403);
        $this->actingAsUser($this->makeStaff($gym, ['members']))->getJson("/api/members/{$mid}/member-pass")->assertOk();
        $this->actingAsUser($member)->getJson("/api/members/{$mid}/member-pass")->assertStatus(403);
        $this->actingAsUser($admin)->getJson('/api/me/member-pass')->assertStatus(404);

        [$coach] = $this->makeCoach($gym);
        $bodies = [
            $mine->getContent(), $card->getContent(),
            $this->actingAsUser($admin)->getJson('/api/attendance/offline/bootstrap')->assertOk()->getContent(),
            $this->actingAsUser($coach)->getJson('/api/attendance/offline/bootstrap')->assertOk()->getContent(),
            $this->actingAsUser($member)->getJson('/api/attendance/offline/me')->assertOk()->getContent(),
        ];
        $key = DB::table('gym_signing_keys')->where('gym_id', $gym)->first();
        $secret = Crypt::decryptString($key->secret_key_enc);
        foreach ($bodies as $body) {
            $this->assertStringNotContainsString($secret, $body);
            $this->assertStringNotContainsString($key->secret_key_enc, $body);
            $this->assertStringNotContainsString('secret', $body);
        }
        $keys = $this->actingAsUser($admin)->getJson('/api/attendance/offline/bootstrap')->json('pass_keys');
        $this->assertSame([['kid' => $key->kid, 'public_key' => $key->public_key, 'status' => 'active', 'valid_until' => null]], $keys);
        $this->assertSame(43, strlen($key->public_key), '32 bytes base64url');
    }
}
