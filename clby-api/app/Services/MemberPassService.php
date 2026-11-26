<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Server-signed member pass (docs/offline-attendance/PHASE2-CONTRACT.md).
 *
 * QR text (compact JSON, keys in this order):
 *   {"t":"clby_mp","v":1,"kid":…,"g":<gym_id>,"m":<gym_member_id>,"n":<member_number|null>,"iat":…,"exp":…,"sig":…}
 * sig = Ed25519 (libsodium) over "clby_mp|1|<kid>|<g>|<m>|<n or empty>|<iat>|<exp>",
 * base64url without padding.
 *
 * Keys: one active per gym in gym_signing_keys, created lazily. The secret
 * key is stored encrypted with Crypt (APP_KEY) and is only ever decrypted in
 * sign(); it is never logged or returned. Rotation retires the active key,
 * which stays valid for verification until retired_at + TTL.
 */
class MemberPassService
{
    public const PURPOSE = 'member_pass';

    public function ttlDays(): int
    {
        return max(1, (int) config('attendance_offline.member_pass_ttl_days', 30));
    }

    /* ── keys ───────────────────────────────────────────────────── */

    /** The gym's active key row (created on first need). Never includes the secret in callers' output. */
    public function activeKey(string $gymId): object
    {
        $key = $this->findActive($gymId);
        if ($key) {
            return $key;
        }
        try {
            // Own savepoint: a lost race must not abort an outer pg transaction.
            DB::transaction(fn () => $this->createKey($gymId));
        } catch (UniqueConstraintViolationException) {
            // A concurrent request created it first.
        }
        return $this->findActive($gymId);
    }

    /** Retire the active key and create a new one. Returns the new kid. */
    public function rotate(string $gymId): string
    {
        return DB::transaction(function () use ($gymId) {
            DB::table('gym_signing_keys')
                ->where('gym_id', $gymId)->where('purpose', self::PURPOSE)->where('status', 'active')
                ->update(['status' => 'retired', 'retired_at' => Carbon::now('UTC')->toIso8601String()]);
            return $this->createKey($gymId);
        });
    }

    /**
     * Keys for client-side verification: the active key, retired keys still
     * inside their grace, and REVOKED keys (status "revoked", so clients
     * reject passes signed with them offline; valid_until = revoked_at).
     * Shape: [{kid, public_key, status, valid_until|null}].
     */
    public function passKeys(string $gymId): array
    {
        $this->activeKey($gymId);
        $now = Carbon::now('UTC');

        return DB::table('gym_signing_keys')
            ->where('gym_id', $gymId)->where('purpose', self::PURPOSE)
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'retired' THEN 1 ELSE 2 END")
            ->orderByDesc('created_at')
            ->get(['kid', 'public_key', 'status', 'retired_at', 'revoked_at'])
            ->map(function ($k) {
                $validUntil = match ($k->status) {
                    'active' => null,
                    'revoked' => $k->revoked_at ? Carbon::parse($k->revoked_at) : Carbon::now('UTC'),
                    default => $this->graceEnd($k),
                };
                return [
                    'kid' => $k->kid,
                    'public_key' => $k->public_key,
                    'status' => $k->status,
                    'valid_until' => $validUntil ? AttendanceSyncService::iso($validUntil) : null,
                ];
            })
            ->filter(fn ($k) => $k['status'] !== 'retired' || ($k['valid_until'] !== null && Carbon::parse($k['valid_until'])->gt($now)))
            ->values()
            ->all();
    }

    /**
     * Revoke a key of this gym: never accepted again, no grace. Refuses to
     * revoke the ACTIVE key (the gym would have no signing key) — rotate first.
     *
     * @return string|null error message, null on success
     */
    public function revoke(string $gymId, string $kid): ?string
    {
        $key = DB::table('gym_signing_keys')->where('kid', $kid)->where('purpose', self::PURPOSE)->first();
        if (! $key || strtolower((string) $key->gym_id) !== strtolower($gymId)) {
            return "No member-pass key {$kid} for gym {$gymId}.";
        }
        if ($key->status === 'active') {
            return "Key {$kid} is the active key; rotate first (--rotate) so the gym has a replacement.";
        }
        if ($key->status !== 'revoked') {
            DB::table('gym_signing_keys')->where('kid', $kid)->update([
                'status' => 'revoked',
                'revoked_at' => Carbon::now('UTC')->toIso8601String(),
            ]);
        }
        return null;
    }

    /* ── issue ──────────────────────────────────────────────────── */

    /**
     * Pass for a gym member, reused for member_pass_cache_minutes (and only
     * while the signing key is still active). Returns {qr, expires_at, kid}.
     */
    public function passFor(string $gymId, string $gymMemberId, ?int $memberNumber): array
    {
        $key = $this->activeKey($gymId);
        $cacheKey = "member-pass:{$gymId}:{$gymMemberId}:{$key->kid}";
        $minutes = max(60, (int) config('attendance_offline.member_pass_cache_minutes', 60));

        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['qr'], $cached['expires_at'])) {
            return $cached;
        }

        $pass = $this->issue($gymId, $gymMemberId, $memberNumber, $key);
        Cache::put($cacheKey, $pass, now()->addMinutes($minutes));
        return $pass;
    }

    /** Always signs a fresh pass. */
    public function issue(string $gymId, string $gymMemberId, ?int $memberNumber, ?object $key = null, ?CarbonInterface $at = null): array
    {
        $key ??= $this->activeKey($gymId);
        $iat = ($at ?? Carbon::now('UTC'))->getTimestamp();
        $exp = $iat + $this->ttlDays() * 86400;

        $message = self::canonical($key->kid, $gymId, $gymMemberId, $memberNumber, $iat, $exp);
        $secret = self::b64urlDecode(Crypt::decryptString($key->secret_key_enc));
        try {
            $sig = sodium_crypto_sign_detached($message, $secret);
        } finally {
            sodium_memzero($secret);
        }

        $qr = json_encode([
            't' => 'clby_mp',
            'v' => 1,
            'kid' => $key->kid,
            'g' => $gymId,
            'm' => $gymMemberId,
            'n' => $memberNumber,
            'iat' => $iat,
            'exp' => $exp,
            'sig' => self::b64url($sig),
        ], JSON_UNESCAPED_SLASHES);

        return [
            'qr' => $qr,
            'expires_at' => AttendanceSyncService::iso(Carbon::createFromTimestampUTC($exp)),
            'kid' => $key->kid,
        ];
    }

    /* ── verify ─────────────────────────────────────────────────── */

    /**
     * Server-side verification, in the amended order (PHASE2-CONTRACT
     * amendments §1–§3): 1 parse (strict, canonical) → 4 gym → 2 key →
     * 3 signature → 5 time → 6 member.
     *
     * `$at` is the scan time (device_recorded_at for sync): expiry and
     * retired-key grace are judged then, and the pass must predate it
     * (iat ≤ at + skew) as well as server now (iat ≤ now + skew).
     *
     * @return array{ok: true, pass: array}|array{ok: false, code: string}
     *   codes: qr_invalid | qr_wrong_gym | pass_expired | member_not_found
     *   (unknown / revoked / out-of-grace kid → qr_invalid server-side)
     */
    public function verify(?string $raw, string $gymId, ?CarbonInterface $at = null, ?CarbonInterface $now = null): array
    {
        $now = Carbon::instance($now ?? Carbon::now('UTC'));
        $at = Carbon::instance($at ?? $now);

        // 1. strict parse
        $p = self::parse($raw);
        if ($p === null) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }

        // 4. gym (before the key, so a foreign gym's pass reads "wrong gym")
        if ($p['g'] !== strtolower($gymId)) {
            return ['ok' => false, 'code' => 'qr_wrong_gym'];
        }

        // 2. key: this gym's, not revoked, active or retired within grace at scan time
        $key = DB::table('gym_signing_keys')->where('kid', $p['kid'])->where('purpose', self::PURPOSE)->first();
        if (! $key || strtolower((string) $key->gym_id) !== $p['g'] || $key->status === 'revoked') {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        if ($key->status !== 'active') {
            $end = $this->graceEnd($key);
            if ($key->status !== 'retired' || ! $end || $at->gte($end)) {
                return ['ok' => false, 'code' => 'qr_invalid'];
            }
        }

        // 3. signature
        $pk = self::b64urlDecodeStrict($key->public_key, SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES);
        $sig = self::b64urlDecodeStrict($p['sig'], SODIUM_CRYPTO_SIGN_BYTES);
        if ($pk === null || $sig === null
            || ! sodium_crypto_sign_verify_detached($sig, self::canonical($p['kid'], $p['g'], $p['m'], $p['n'], $p['iat'], $p['exp']), $pk)) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }

        // 5. time
        $skew = (int) config('attendance_offline.future_skew_seconds', 300);
        if ($p['iat'] > $p['exp']
            || $p['iat'] > $now->getTimestamp() + $skew
            || $p['iat'] > $at->getTimestamp() + $skew) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        if ($p['exp'] <= $at->getTimestamp()) {
            return ['ok' => false, 'code' => 'pass_expired'];
        }

        // 6. member
        $exists = DB::table('gym_members')->where('id', $p['m'])->where('gym_id', $gymId)->whereNull('deleted_at')->exists();
        if (! $exists) {
            return ['ok' => false, 'code' => 'member_not_found'];
        }

        return ['ok' => true, 'pass' => $p];
    }

    /**
     * Step 1 — strict canonical parse (amendment §3); null = qr_invalid.
     *  - ≤ 1024 chars, no BOM, a JSON object with exactly the 9 keys;
     *  - t === "clby_mp", v === 1 (integer, not 1.0);
     *  - kid: 1–32 of [A-Za-z0-9_-]; g, m: lowercase canonical UUIDs (as issued);
     *  - n: integer (|n| ≤ 2^53−1, so every client can represent it) or null;
     *  - iat, exp: integers (no fraction / exponent);
     *  - sig: base64url, no padding, decodes to exactly 64 bytes and
     *    re-encodes to the identical string (no non-canonical trailing bits).
     */
    public static function parse(?string $raw): ?array
    {
        if (! is_string($raw) || $raw === '' || strlen($raw) > 1024) return null;
        if (str_starts_with($raw, "\xEF\xBB\xBF")) return null;
        $p = json_decode($raw, true, 4, JSON_BIGINT_AS_STRING);
        if (! is_array($p) || array_is_list($p)) return null;
        $keys = ['t', 'v', 'kid', 'g', 'm', 'n', 'iat', 'exp', 'sig'];
        if (count($p) !== 9 || array_diff($keys, array_keys($p)) !== []) return null;

        $uuid = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';
        if ($p['t'] !== 'clby_mp' || $p['v'] !== 1) return null;
        if (! is_string($p['kid']) || ! preg_match('/^[A-Za-z0-9_-]{1,32}$/', $p['kid'])) return null;
        if (! is_string($p['g']) || ! preg_match($uuid, $p['g'])) return null;
        if (! is_string($p['m']) || ! preg_match($uuid, $p['m'])) return null;
        if ($p['n'] !== null && (! is_int($p['n']) || abs($p['n']) > 9007199254740991)) return null;
        if (! is_int($p['iat']) || ! is_int($p['exp'])) return null;
        if (! is_string($p['sig']) || self::b64urlDecodeStrict($p['sig'], SODIUM_CRYPTO_SIGN_BYTES) === null) return null;
        return $p;
    }

    /**
     * Canonical base64url (no padding) → bytes of exactly $len, or null.
     * Rejects '+', '/', '=', whitespace and non-canonical trailing bits.
     */
    public static function b64urlDecodeStrict(string $txt, int $len): ?string
    {
        if (! preg_match('/^[A-Za-z0-9_-]+$/', $txt)) return null;
        $bin = self::b64urlDecode($txt);
        if ($bin === false || strlen($bin) !== $len || self::b64url($bin) !== $txt) return null;
        return $bin;
    }

    public static function canonical(string $kid, string $g, string $m, ?int $n, int $iat, int $exp): string
    {
        return implode('|', ['clby_mp', '1', $kid, $g, $m, $n === null ? '' : (string) $n, (string) $iat, (string) $exp]);
    }

    public static function b64url(string $bin): string
    {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    public static function b64urlDecode(string $txt): string|false
    {
        return base64_decode(strtr($txt, '-_', '+/'), true);
    }

    /* ── internals ──────────────────────────────────────────────── */

    private function findActive(string $gymId): ?object
    {
        return DB::table('gym_signing_keys')
            ->where('gym_id', $gymId)->where('purpose', self::PURPOSE)->where('status', 'active')
            ->first();
    }

    private function createKey(string $gymId): string
    {
        $pair = sodium_crypto_sign_keypair();
        $secret = sodium_crypto_sign_secretkey($pair);
        $public = sodium_crypto_sign_publickey($pair);
        $kid = bin2hex(random_bytes(6));
        try {
            DB::table('gym_signing_keys')->insert([
                'kid' => $kid,
                'gym_id' => $gymId,
                'purpose' => self::PURPOSE,
                'public_key' => self::b64url($public),
                'secret_key_enc' => Crypt::encryptString(self::b64url($secret)),
                'status' => 'active',
                'created_at' => Carbon::now('UTC')->toIso8601String(),
            ]);
        } finally {
            sodium_memzero($secret);
            sodium_memzero($pair);
        }
        return $kid;
    }

    private function graceEnd(object $key): ?Carbon
    {
        return $key->retired_at ? Carbon::parse($key->retired_at)->addDays($this->ttlDays()) : null;
    }
}
