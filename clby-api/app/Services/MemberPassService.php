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
     * Public keys clients may verify with: the active key plus retired keys
     * still inside their grace. Shape: [{kid, public_key, status, valid_until|null}].
     */
    public function passKeys(string $gymId): array
    {
        $this->activeKey($gymId);
        $now = Carbon::now('UTC');

        return DB::table('gym_signing_keys')
            ->where('gym_id', $gymId)->where('purpose', self::PURPOSE)
            ->orderByRaw("CASE status WHEN 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->get(['kid', 'public_key', 'status', 'retired_at'])
            ->map(function ($k) {
                $validUntil = $k->status === 'active' ? null : $this->graceEnd($k);
                return [
                    'kid' => $k->kid,
                    'public_key' => $k->public_key,
                    'status' => $k->status,
                    'valid_until' => $validUntil ? AttendanceSyncService::iso($validUntil) : null,
                ];
            })
            ->filter(fn ($k) => $k['valid_until'] === null || Carbon::parse($k['valid_until'])->gt($now))
            ->values()
            ->all();
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
     * Server-side verification steps 1–6. `$at` is when the pass was
     * scanned (device_recorded_at for sync) — expiry and key grace are judged
     * then; `iat` may not be later than server now + future skew.
     *
     * @return array{ok: true, pass: array}|array{ok: false, code: string}
     *   codes: qr_invalid | qr_wrong_gym | pass_expired | member_not_found
     *   (an unknown/out-of-grace kid is reported as qr_invalid server-side)
     */
    public function verify(?string $raw, string $gymId, ?CarbonInterface $at = null, ?CarbonInterface $now = null): array
    {
        $now = Carbon::instance($now ?? Carbon::now('UTC'));
        $at = Carbon::instance($at ?? $now);

        // 1. shape
        $p = self::parse($raw);
        if ($p === null) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }

        // 2. key known (active, or retired within grace at scan time)
        $key = DB::table('gym_signing_keys')->where('kid', $p['kid'])->where('purpose', self::PURPOSE)->first();
        if (! $key || strtolower((string) $key->gym_id) !== strtolower($p['g'])) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        if ($key->status !== 'active') {
            $end = $this->graceEnd($key);
            if (! $end || $at->gte($end)) {
                return ['ok' => false, 'code' => 'qr_invalid'];
            }
        }

        // 3. signature
        $sig = self::b64urlDecode($p['sig']);
        $pk = self::b64urlDecode($key->public_key);
        if (strlen((string) $sig) !== SODIUM_CRYPTO_SIGN_BYTES || strlen((string) $pk) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
            || ! sodium_crypto_sign_verify_detached($sig, self::canonical($p['kid'], $p['g'], $p['m'], $p['n'], $p['iat'], $p['exp']), $pk)) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }

        // 4. gym
        if (strtolower($p['g']) !== strtolower($gymId)) {
            return ['ok' => false, 'code' => 'qr_wrong_gym'];
        }

        // 5. time
        $skew = (int) config('attendance_offline.future_skew_seconds', 300);
        if ($p['iat'] > $now->getTimestamp() + $skew || $p['iat'] > $p['exp']) {
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

    /** Step 1: parse + type-check; null when not a v1 member pass. */
    public static function parse(?string $raw): ?array
    {
        if (! is_string($raw) || $raw === '' || strlen($raw) > 2048) return null;
        $p = json_decode($raw, true);
        if (! is_array($p)) return null;
        if (($p['t'] ?? null) !== 'clby_mp' || ($p['v'] ?? null) !== 1) return null;
        foreach (['kid', 'g', 'm', 'iat', 'exp', 'sig'] as $k) {
            if (! array_key_exists($k, $p)) return null;
        }
        if (! array_key_exists('n', $p)) return null;
        if (! is_string($p['kid']) || ! preg_match('/^[A-Za-z0-9_-]{1,32}$/', $p['kid'])) return null;
        if (! is_string($p['g']) || ! Str::isUuid($p['g'])) return null;
        if (! is_string($p['m']) || ! Str::isUuid($p['m'])) return null;
        if ($p['n'] !== null && ! is_int($p['n'])) return null;
        if (! is_int($p['iat']) || ! is_int($p['exp'])) return null;
        if (! is_string($p['sig']) || ! preg_match('/^[A-Za-z0-9_-]+$/', $p['sig'])) return null;
        return $p;
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
