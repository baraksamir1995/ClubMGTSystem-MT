<?php

namespace Tests\Feature\Attendance;

use App\Services\BranchQrService;
use App\Services\MemberPassService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** PHASE3-CONTRACT §1–§3: signed branch QR v2 — issue, verify, endpoints. */
class BranchQrTest extends OfflineSyncTestCase
{
    private function svc(): BranchQrService
    {
        return app(BranchQrService::class);
    }

    private function branchRow(string $id): object
    {
        return DB::table('branches')->where('id', $id)->first(['id', 'gym_id', 'name', 'is_active', 'qr_token']);
    }

    private function code(?string $raw, string $gym, ?Carbon $scan = null): string
    {
        $r = $this->svc()->verify($raw, $gym, $scan ?? Carbon::now());
        return $r['ok'] ? 'ok' : $r['code'];
    }

    /** Re-sign arbitrary branch-QR fields with the gym's active key. */
    private function signed(string $gym, string $branchId, array $over = []): string
    {
        $b = $this->branchRow($branchId);
        $key = app(MemberPassService::class)->activeKey($gym);
        $q = array_merge(['type' => 'gym_access', 'gym_id' => $gym, 'branch_id' => $branchId, 'token' => $b->qr_token, 'v' => 2,
            'mode' => 'static', 'kid' => $key->kid, 'iat' => time() - 3600, 'exp' => time() + 86400, 'jti' => BranchQrService::newJti()], $over);
        $sk = MemberPassService::b64urlDecode(Crypt::decryptString($key->secret_key_enc));
        $q['sig'] = MemberPassService::b64url(sodium_crypto_sign_detached(BranchQrService::canonical(
            $q['mode'], $q['kid'], $q['gym_id'], $q['branch_id'], $q['token'], $q['iat'], $q['exp'], $q['jti']), $sk));
        return json_encode($q, JSON_UNESCAPED_SLASHES);
    }

    public function test_static_format_is_a_v1_superset_and_verifies_independently(): void
    {
        $gym = $this->makeGym();
        [$branch, $token] = $this->makeBranch($gym);
        $r = $this->svc()->issueStatic($gym, $this->branchRow($branch));

        $this->assertSame(['qr', 'mode', 'expires_at', 'kid'], array_keys($r));
        $q = json_decode($r['qr'], true);
        $this->assertSame(['type', 'gym_id', 'branch_id', 'token', 'v', 'mode', 'kid', 'iat', 'exp', 'jti', 'sig'], array_keys($q));
        $this->assertSame(['gym_access', $gym, $branch, $token, 2, 'static'], [$q['type'], $q['gym_id'], $q['branch_id'], $q['token'], $q['v'], $q['mode']]);
        $this->assertSame(365 * 86400, $q['exp'] - $q['iat']);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{16,32}$/', $q['jti']);

        $pk = MemberPassService::b64urlDecode(app(MemberPassService::class)->passKeys($gym)[0]['public_key']);
        $msg = "clby_bq|2|static|{$q['kid']}|{$gym}|{$branch}|{$token}|{$q['iat']}|{$q['exp']}|{$q['jti']}";
        $this->assertTrue(sodium_crypto_sign_verify_detached(MemberPassService::b64urlDecode($q['sig']), $msg, $pk));
        $this->assertSame('ok', $this->code($r['qr'], $gym));
    }

    public function test_rotating_batch_is_consecutive_and_cheap(): void
    {
        $gym = $this->makeGym();
        [$branch] = $this->makeBranch($gym);
        $row = $this->branchRow($branch);
        app(MemberPassService::class)->activeKey($gym);

        DB::enableQueryLog();
        $batch = $this->svc()->rotatingBatch($gym, $row, 2);
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertLessThanOrEqual(2, $queries, 'one key lookup, not one query per token');

        $this->assertCount(120, $batch['tokens']);
        $jtis = [];
        foreach ($batch['tokens'] as $i => $t) {
            $q = json_decode($t['qr'], true);
            $this->assertSame('rotating', $q['mode']);
            $this->assertSame($t['iat'] + 60, $t['exp']);
            if ($i > 0) $this->assertSame($batch['tokens'][$i - 1]['exp'], $t['iat']);
            $jtis[] = $q['jti'];
        }
        $this->assertCount(120, array_unique($jtis));
        $this->assertSame(0, $batch['tokens'][0]['iat'] % 60);
        $first = $batch['tokens'][0];
        $this->assertSame('ok', $this->code($first['qr'], $gym, Carbon::createFromTimestampUTC($first['iat'] + 10)));
        $last = end($batch['tokens']);
        $this->assertSame('ok', $this->code($last['qr'], $gym, Carbon::createFromTimestampUTC($last['iat'] + 5)));
    }

    public function test_verification_rules(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [$branch] = $this->makeBranch($gym);
        [$foreignBranch] = $this->makeBranch($other);
        [$closed] = $this->makeBranch($gym, 'Closed', false);
        $valid = $this->signed($gym, $branch);
        $q = json_decode($valid, true);
        $now = time();

        $cases = [
            'valid' => [$valid, 'ok'],
            'wrong gym' => [$this->svc()->issueStatic($other, $this->branchRow($foreignBranch))['qr'], 'qr_wrong_gym'],
            'tampered token' => [json_encode(array_merge($q, ['token' => (string) Str::uuid()])), 'qr_invalid'],
            'tampered mode' => [json_encode(array_merge($q, ['mode' => 'rotating'])), 'qr_invalid'],
            'tampered jti' => [json_encode(array_merge($q, ['jti' => BranchQrService::newJti()])), 'qr_invalid'],
            'unknown kid' => [json_encode(array_merge($q, ['kid' => 'nope00000000'])), 'qr_invalid'],
            'inactive branch' => [$this->signed($gym, $closed), 'qr_invalid'],
            'iat > exp' => [$this->signed($gym, $branch, ['iat' => $now, 'exp' => $now - 1]), 'qr_invalid'],
            'static expired' => [$this->signed($gym, $branch, ['iat' => $now - 7200, 'exp' => $now - 1]), 'qr_expired'],
            'iat after scan' => [$this->signed($gym, $branch, ['iat' => $now + 301]), 'qr_expired'],
            'rotating in grace' => [$this->signed($gym, $branch, ['mode' => 'rotating', 'iat' => $now - 80, 'exp' => $now - 20]), 'ok'],
            'rotating past grace' => [$this->signed($gym, $branch, ['mode' => 'rotating', 'iat' => $now - 91, 'exp' => $now - 31]), 'qr_expired'],
            'static no grace' => [$this->signed($gym, $branch, ['iat' => $now - 80, 'exp' => $now - 20]), 'qr_expired'],
            // strictness (PHASE2 amendment §3 rules)
            'jti too short' => [$this->signed($gym, $branch, ['jti' => str_repeat('a', 15)]), 'qr_invalid'],
            'jti bad char' => [$this->signed($gym, $branch, ['jti' => str_repeat('a', 15) . '.']), 'qr_invalid'],
            'uppercase branch' => [$this->signed($gym, $branch, ['branch_id' => strtoupper($branch)]), 'qr_invalid'],
            'extra key' => [substr($valid, 0, -1) . ',"x":1}', 'qr_invalid'],
            'missing key' => [json_encode(array_diff_key($q, ['jti' => 1])), 'qr_invalid'],
            'iat float' => [str_replace('"iat":' . $q['iat'], '"iat":' . $q['iat'] . '.0', $valid), 'qr_invalid'],
            'sig padded' => [str_replace($q['sig'], $q['sig'] . '==', $valid), 'qr_invalid'],
            'too long' => [str_pad($valid, 1025, ' '), 'qr_invalid'],
            'v float → not v2' => [str_replace('"v":2', '"v":2.0', $valid), 'not_v2'],
            'v1 payload → not v2' => [json_encode(array_diff_key($q, array_flip(['v', 'mode', 'kid', 'iat', 'exp', 'jti', 'sig']))), 'not_v2'],
            'bare token → not v2' => [$q['token'], 'not_v2'],
        ];
        foreach ($cases as $name => [$raw, $want]) {
            $this->assertSame($want, $this->code($raw, $gym), $name);
        }
    }

    public function test_member_pass_signature_cannot_be_pasted_into_a_branch_qr(): void
    {
        $gym = $this->makeGym();
        [$branch] = $this->makeBranch($gym);
        [, $mid] = $this->makeMember($gym);
        $pass = json_decode(app(MemberPassService::class)->issue($gym, $mid, null)['qr'], true);
        $q = json_decode($this->signed($gym, $branch, ['iat' => $pass['iat'], 'exp' => $pass['exp']]), true);
        $q['sig'] = $pass['sig'];
        $this->assertSame('qr_invalid', $this->code(json_encode($q, JSON_UNESCAPED_SLASHES), $gym));
    }

    public function test_token_regeneration_and_key_revocation_invalidate_posters(): void
    {
        $gym = $this->makeGym();
        [$branch] = $this->makeBranch($gym);
        $poster = $this->svc()->issueStatic($gym, $this->branchRow($branch))['qr'];
        $this->assertSame('ok', $this->code($poster, $gym));

        // Admin "Regenerate" changes the branch token → old posters are invalid.
        DB::table('branches')->where('id', $branch)->update(['qr_token' => (string) Str::uuid()]);
        $this->assertSame('qr_invalid', $this->code($poster, $gym));

        $fresh = $this->svc()->issueStatic($gym, $this->branchRow($branch))['qr'];
        $kid = json_decode($fresh, true)['kid'];
        app(MemberPassService::class)->rotate($gym);
        $this->assertSame('ok', $this->code($fresh, $gym), 'retired key: within grace');
        app(MemberPassService::class)->revoke($gym, $kid);
        $this->assertSame('qr_invalid', $this->code($fresh, $gym), 'revoked key: never');
    }

    public function test_endpoints_permissions_and_no_secrets(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [$branch] = $this->makeBranch($gym);
        [$foreignBranch] = $this->makeBranch($other);
        $staff = $this->makeStaff($gym, ['attendance']);

        $poster = $this->actingAsUser($staff)->getJson("/api/branches/{$branch}/qr?mode=static")->assertOk();
        $this->assertSame(['qr', 'mode', 'expires_at', 'kid'], array_keys($poster->json()));
        $this->assertSame('ok', $this->code($poster->json('qr'), $gym));
        $this->getJson("/api/branches/{$branch}/qr?mode=rotating")->assertStatus(422);
        $this->getJson("/api/branches/{$foreignBranch}/qr")->assertStatus(404);

        $batch = $this->getJson("/api/branches/{$branch}/qr/rotating-batch?hours=1")->assertOk();
        $this->assertSame(['tokens', 'kid', 'generated_at'], array_keys($batch->json()));
        $this->assertCount(60, $batch->json('tokens'));
        $this->assertSame(['qr', 'iat', 'exp'], array_keys($batch->json('tokens.0')));
        $this->getJson("/api/branches/{$branch}/qr/rotating-batch?hours=25")->assertStatus(422);
        $this->getJson("/api/branches/{$foreignBranch}/qr/rotating-batch")->assertStatus(404);

        $this->actingAsUser($this->makeStaff($gym, ['members']))->getJson("/api/branches/{$branch}/qr")->assertStatus(403);
        [$member] = $this->makeMember($gym);
        $this->actingAsUser($member)->getJson("/api/branches/{$branch}/qr")->assertStatus(403);

        $enc = DB::table('gym_signing_keys')->where('gym_id', $gym)->value('secret_key_enc');
        $secret = Crypt::decryptString($enc);
        foreach ([$poster->getContent(), $batch->getContent()] as $body) {
            $this->assertStringNotContainsString($secret, $body);
            $this->assertStringNotContainsString('secret', $body);
        }
    }

    public function test_offline_me_adds_branch_tokens_and_member_pass(): void
    {
        $gym = $this->makeGym();
        [$branch, $token] = $this->makeBranch($gym);
        [$member, $mid] = $this->makeMember($gym);

        $me = $this->actingAsUser($member)->getJson('/api/attendance/offline/me')->assertOk();
        $this->assertSame([['id' => $branch, 'name' => 'Main', 'is_active' => true, 'qr_token' => $token]], $me->json('branches'));
        $this->assertSame(['qr', 'expires_at', 'kid'], array_keys($me->json('member_pass')));
        $this->assertTrue(app(MemberPassService::class)->verify($me->json('member_pass.qr'), $gym)['ok']);
        $this->assertSame($mid, json_decode($me->json('member_pass.qr'), true)['m']);

        // Staff bootstrap does not expose branch tokens.
        $boot = $this->actingAsUser($this->makeAdmin($gym))->getJson('/api/attendance/offline/bootstrap')->assertOk();
        $this->assertArrayNotHasKey('qr_token', $boot->json('branches.0'));
    }

    /** PHASE3 §2: today's online endpoint keeps working with the token taken from a v2 poster. */
    public function test_attendance_qr_accepts_the_token_of_a_v2_qr(): void
    {
        $gym = $this->makeGym();
        [$branch] = $this->makeBranch($gym);
        [$user, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration', ['freeze_status' => 'frozen']);
        $v2 = json_decode($this->svc()->issueStatic($gym, $this->branchRow($branch))['qr'], true);

        // A deployed app reads only type/gym_id/branch_id/token and posts the token.
        // The deny path proves the token resolved to the branch and ran the
        // gym-entry rules (the allowed path is the Postgres-only SQL function;
        // covered by the Postgres e2e).
        $this->actingAsUser($user)->postJson('/api/attendance/qr', ['gym_member_id' => $mid, 'token' => $v2['token']])
            ->assertOk()->assertJsonPath('data.status', 'denied')->assertJsonPath('data.reason', 'membership_frozen');

        $other = $this->makeGym();
        [$foreignUser, $foreignMid] = $this->makeMember($other);
        $this->actingAsUser($foreignUser)->postJson('/api/attendance/qr', ['gym_member_id' => $foreignMid, 'token' => $v2['token']])
            ->assertOk()->assertJsonPath('data.reason', 'not_a_member');
    }
}
