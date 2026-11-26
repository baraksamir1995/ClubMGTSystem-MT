<?php

namespace Tests\Feature\Attendance;

use App\Services\MemberPassService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** PHASE2-CONTRACT "Amendments after Phase 2 verification" §1–§6. */
class MemberPassHardeningTest extends OfflineSyncTestCase
{
    private function svc(): MemberPassService
    {
        return app(MemberPassService::class);
    }

    /** Sign arbitrary field values with the gym's real active key; returns the decoded pass array. */
    private function signed(string $gym, array $over = []): array
    {
        $key = $this->svc()->activeKey($gym);
        $p = array_merge(['t' => 'clby_mp', 'v' => 1, 'kid' => $key->kid, 'g' => $gym, 'm' => null, 'n' => 7,
            'iat' => time() - 60, 'exp' => time() - 60 + 30 * 86400], $over);
        $sk = MemberPassService::b64urlDecode(Crypt::decryptString($key->secret_key_enc));
        $p['sig'] = MemberPassService::b64url(sodium_crypto_sign_detached(
            MemberPassService::canonical($p['kid'], $p['g'], $p['m'], $p['n'], $p['iat'], $p['exp']), $sk));
        return $p;
    }

    private function code(?string $raw, string $gym, ?Carbon $at = null): string
    {
        $r = $this->svc()->verify($raw, $gym, $at);
        return $r['ok'] ? 'ok' : $r['code'];
    }

    /* §1 */
    public function test_pass_must_predate_the_scan_and_iat_after_exp_is_invalid(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $qr = $this->svc()->issue($gym, $mid, null)['qr'];

        $this->assertSame('qr_invalid', $this->code($qr, $gym, Carbon::now()->subHours(2)), 'issued after the scan');
        $this->assertSame('ok', $this->code($qr, $gym, Carbon::now()->subSeconds(200)), 'within skew');
        $this->assertSame('qr_invalid', $this->code(json_encode($this->signed($gym, ['m' => $mid, 'iat' => time() - 10, 'exp' => time() - 20])), $gym));
    }

    /* §2 */
    public function test_wrong_gym_is_reported_before_key_lookup(): void
    {
        $gymA = $this->makeGym();
        $gymB = $this->makeGym();
        [, $mid] = $this->makeMember($gymB);
        $p = json_decode($this->svc()->issue($gymB, $mid, null)['qr'], true);
        $p['kid'] = 'neverseen0000';
        $this->assertSame('qr_wrong_gym', $this->code(json_encode($p), $gymA));
    }

    /* §3 */
    public function test_strict_canonical_parsing(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $good = $this->signed($gym, ['m' => $mid]);
        $raw = json_encode($good, JSON_UNESCAPED_SLASHES);
        $this->assertSame('ok', $this->code($raw, $gym));

        $sig = $good['sig'];
        $alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        $altLast = $alpha[strpos($alpha, $sig[85]) | 1];
        $bad = [
            'v float' => str_replace('"v":1', '"v":1.0', $raw),
            'iat float' => str_replace('"iat":' . $good['iat'], '"iat":' . $good['iat'] . '.0', $raw),
            'exp exponent' => str_replace('"exp":' . $good['exp'], '"exp":' . ($good['exp'] / 1e9) . 'e9', $raw),
            'n float' => str_replace('"n":7', '"n":7.0', $raw),
            'n string' => str_replace('"n":7', '"n":"7"', $raw),
            'extra key' => substr($raw, 0, -1) . ',"x":1}',
            'missing key' => json_encode(array_diff_key($good, ['n' => 1])),
            'bom' => "\u{FEFF}" . $raw,
            'too long' => $raw . str_repeat(' ', 1025 - strlen($raw)),
            'sig padded' => str_replace($sig, $sig . '==', $raw),
            'sig std alphabet' => str_replace($sig, strtr($sig, '-_', '+/'), $raw),
            'sig non-canonical bits' => str_replace($sig, substr($sig, 0, 85) . $altLast, $raw),
            'sig short' => str_replace($sig, substr($sig, 0, 84), $raw),
            'array' => '[' . $raw . ']',
            'm uppercase (signed)' => json_encode($this->signed($gym, ['m' => strtoupper($mid)]), JSON_UNESCAPED_SLASHES),
            'n beyond 2^53' => json_encode($this->signed($gym, ['m' => $mid, 'n' => 9007199254740992]), JSON_UNESCAPED_SLASHES),
        ];
        $this->assertNotSame($sig, substr($sig, 0, 85) . $altLast);
        foreach ($bad as $name => $text) {
            $this->assertSame('qr_invalid', $this->code($text, $gym), $name);
        }

        // Boundaries that stay valid.
        $this->assertSame('ok', $this->code(json_encode($this->signed($gym, ['m' => $mid, 'n' => 9007199254740991]), JSON_UNESCAPED_SLASHES), $gym));
        $this->assertSame('ok', $this->code(str_pad($raw, 1024, ' '), $gym), '1024 chars incl. trailing JSON whitespace');
    }

    /* §4 */
    public function test_revoked_keys_are_never_accepted_and_listed_as_revoked(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $oldQr = $this->svc()->issue($gym, $mid, null)['qr'];
        $oldKid = json_decode($oldQr, true)['kid'];

        $this->assertNotNull($this->svc()->revoke($gym, $oldKid), 'active key cannot be revoked');
        $this->assertSame('ok', $this->code($oldQr, $gym));

        $newKid = $this->svc()->rotate($gym);
        $this->assertSame('ok', $this->code($oldQr, $gym), 'retired: still in grace');
        $this->assertNull($this->svc()->revoke($gym, $oldKid));
        $this->assertSame('qr_invalid', $this->code($oldQr, $gym), 'revoked: no grace');

        $keys = collect($this->svc()->passKeys($gym))->keyBy('kid');
        $this->assertSame('active', $keys[$newKid]['status']);
        $this->assertSame('revoked', $keys[$oldKid]['status']);
        $this->assertNotNull($keys[$oldKid]['valid_until']);
        $this->assertTrue(Carbon::parse($keys[$oldKid]['valid_until'])->lte(Carbon::now()));

        $otherGym = $this->makeGym();
        $this->assertNotNull($this->svc()->revoke($otherGym, $newKid), "can't revoke another gym's key");
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

    /* §1 + §5 through sync */
    public function test_sync_qr_meta_only_for_verified_passes_and_pass_must_predate_scan(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration');
        $qr = $this->passQr($gym, $mid);

        $results = $this->sync($this->makeStaff($gym), [
            $this->attendanceEvent($gym, ['member_id' => $mid, 'attendance_method' => 'staff_qr', 'qr' => ['raw' => $qr],
                'device_recorded_at' => self::at(Carbon::now()->subHours(6))]),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'attendance_method' => 'staff_qr', 'qr' => ['raw' => $qr]]),
        ])->assertOk()->json('results');
        $this->assertSame(['qr_invalid', 'created'], array_column($results, 'code'));

        $rejected = json_decode(DB::table('attendance_events')->where('event_id', $results[0]['event_id'])->value('qr_meta'), true);
        $this->assertSame(['verified' => false, 'reason' => 'qr_invalid'], $rejected);
        $accepted = json_decode(DB::table('attendance_events')->where('event_id', $results[1]['event_id'])->value('qr_meta'), true);
        $this->assertTrue($accepted['verified']);
        $this->assertSame($mid, $accepted['m']);
        $this->assertArrayNotHasKey('sig', $accepted);
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
}
