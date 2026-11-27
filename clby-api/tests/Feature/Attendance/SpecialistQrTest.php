<?php

namespace Tests\Feature\Attendance;

use App\Services\MemberPassService;
use App\Services\SpecialistQrService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** PHASE3 Amendment 2 §C: signed coach (specialist) QR v2 — issue, fixed QR, verify, endpoints. */
class SpecialistQrTest extends OfflineSyncTestCase
{
    private function svc(): SpecialistQrService
    {
        return app(SpecialistQrService::class);
    }

    private function code(?string $raw, string $gym, ?Carbon $scan = null): string
    {
        $r = $this->svc()->verify($raw, $gym, $scan ?? Carbon::now());
        return $r['ok'] ? 'ok' : $r['code'];
    }

    /** Re-sign arbitrary coach-QR fields with the gym's active key. */
    private function signed(string $gym, string $trainerId, array $over = []): string
    {
        $key = app(MemberPassService::class)->activeKey($gym);
        $q = array_merge(['type' => 'specialist_session', 'gym_id' => $gym, 'trainer_id' => $trainerId, 'v' => 2, 'kid' => $key->kid,
            'iat' => time() - 3600, 'exp' => time() + 86400, 'jti' => str_repeat('j', 20)], $over);
        $sk = MemberPassService::b64urlDecode(Crypt::decryptString($key->secret_key_enc));
        $q['sig'] = MemberPassService::b64url(sodium_crypto_sign_detached(
            SpecialistQrService::canonical($q['kid'], $q['gym_id'], $q['trainer_id'], $q['iat'], $q['exp'], $q['jti']), $sk));
        return json_encode($q, JSON_UNESCAPED_SLASHES);
    }

    public function test_format_is_a_v1_superset_and_verifies_independently(): void
    {
        $gym = $this->makeGym();
        [, $tp] = $this->makeCoach($gym);
        $raw = $this->svc()->issue($gym, $tp);
        $q = json_decode($raw, true);
        $this->assertSame(['type', 'gym_id', 'trainer_id', 'v', 'kid', 'iat', 'exp', 'jti', 'sig'], array_keys($q));
        $this->assertSame(['specialist_session', $gym, $tp, 2], [$q['type'], $q['gym_id'], $q['trainer_id'], $q['v']]);
        $this->assertSame(3650 * 86400, $q['exp'] - $q['iat']);

        $pk = MemberPassService::b64urlDecode(app(MemberPassService::class)->passKeys($gym)[0]['public_key']);
        $msg = "clby_sq|2|{$q['kid']}|{$gym}|{$tp}|{$q['iat']}|{$q['exp']}|{$q['jti']}";
        $this->assertTrue(sodium_crypto_sign_verify_detached(MemberPassService::b64urlDecode($q['sig']), $msg, $pk));
        $this->assertSame('ok', $this->code($raw, $gym));
    }

    public function test_one_fixed_qr_per_trainer_and_reissue_on_key_rotation(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);

        $a = $this->actingAsUser($coach)->getJson('/api/coach/qr')->assertOk()->json();
        $this->assertSame(['qr', 'expires_at', 'kid'], array_keys($a));
        $this->assertSame($a, $this->getJson('/api/coach/qr')->assertOk()->json(), 'same text on every call');
        $this->assertSame($a, $this->getJson('/api/attendance/offline/bootstrap')->assertOk()->json('own_qr'), 'bootstrap own_qr = the same QR');
        $this->assertSame(1, DB::table('trainer_qr_posters')->count());

        app(MemberPassService::class)->rotate($gym);
        $b = $this->getJson('/api/coach/qr')->json();
        $this->assertNotSame($a['qr'], $b['qr']);
        $this->assertNotSame($a['kid'], $b['kid']);

        DB::table('trainer_qr_posters')->where('trainer_id', $tp)->update(['exp' => time() + 29 * 86400]);
        $this->assertNotSame($b['qr'], $this->getJson('/api/coach/qr')->json('qr'), 'within 30 days of exp → reissued');

        $this->actingAsUser($this->makeAdmin($gym))->getJson('/api/coach/qr')->assertStatus(403);
        [$member] = $this->makeMember($gym);
        $this->actingAsUser($member)->getJson('/api/coach/qr')->assertStatus(403);
        $this->assertStringNotContainsString('secret', json_encode($b));
    }

    public function test_verification_rules(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [, $tp] = $this->makeCoach($gym);
        [, $inactive] = $this->makeCoach($gym);
        DB::table('trainer_profiles')->where('id', $inactive)->update(['is_active' => false]);
        [, $foreignTp] = $this->makeCoach($other);
        [$branch] = $this->makeBranch($gym);
        $valid = $this->signed($gym, $tp);
        $q = json_decode($valid, true);
        $now = time();
        $branchQr = json_decode(app(\App\Services\BranchQrService::class)->issueStatic($gym, DB::table('branches')->where('id', $branch)->first())['qr'], true);

        $cases = [
            'valid' => [$valid, 'ok'],
            'wrong gym' => [$this->svc()->issue($other, $foreignTp), 'qr_wrong_gym'],
            'tampered trainer' => [json_encode(array_merge($q, ['trainer_id' => (string) Str::uuid()])), 'qr_invalid'],
            'tampered exp' => [json_encode(array_merge($q, ['exp' => $q['exp'] + 1])), 'qr_invalid'],
            'unknown kid' => [json_encode(array_merge($q, ['kid' => 'nope00000000'])), 'qr_invalid'],
            'branch-QR signature pasted' => [json_encode(array_merge($q, ['sig' => $branchQr['sig']])), 'qr_invalid'],
            'inactive trainer' => [$this->signed($gym, $inactive), 'qr_invalid'],
            'unknown trainer' => [$this->signed($gym, (string) Str::uuid()), 'qr_invalid'],
            'iat > exp' => [$this->signed($gym, $tp, ['iat' => $now, 'exp' => $now - 1]), 'qr_invalid'],
            'expired' => [$this->signed($gym, $tp, ['iat' => $now - 100, 'exp' => $now - 1]), 'qr_expired'],
            'iat after scan' => [$this->signed($gym, $tp, ['iat' => $now + 301]), 'qr_expired'],
            'extra key' => [substr($valid, 0, -1) . ',"x":1}', 'qr_invalid'],
            'uppercase trainer' => [$this->signed($gym, strtoupper($tp)), 'qr_invalid'],
            'jti short' => [$this->signed($gym, $tp, ['jti' => str_repeat('j', 15)]), 'qr_invalid'],
            'sig padded' => [str_replace($q['sig'], $q['sig'] . '==', $valid), 'qr_invalid'],
            'v1 coach QR → not v2' => [json_encode(['type' => 'specialist_session', 'gym_id' => $gym, 'trainer_id' => $tp]), 'not_v2'],
            'branch QR → not v2' => [json_encode($branchQr), 'not_v2'],
        ];
        foreach ($cases as $name => [$raw, $want]) {
            $this->assertSame($want, $this->code($raw, $gym), $name);
        }

        app(MemberPassService::class)->rotate($gym);
        app(MemberPassService::class)->revoke($gym, $q['kid']);
        $this->assertSame('qr_invalid', $this->code($valid, $gym), 'revoked key');
    }

    /** Old member apps read type/gym_id/trainer_id from the v2 text and call the online endpoint unchanged. */
    public function test_old_app_online_scan_with_v2_text(): void
    {
        $gym = $this->makeGym();
        [, $tp] = $this->makeCoach($gym);
        [$user, $mid] = $this->makeMember($gym);
        $this->makeAssignment($gym, $mid, $tp);
        $v2 = json_decode($this->svc()->issue($gym, $tp), true);

        $this->actingAsUser($user)->postJson('/api/specialists/scan', ['trainer_id' => $v2['trainer_id']])
            ->assertStatus(201)->assertJsonPath('data.trainer_id', $tp)->assertJsonPath('data.sessions_used', 1);
    }
}
