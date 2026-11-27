<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Per-gym Ed25519 signing keys (gym_signing_keys, purpose 'member_pass' —
 * the name is historical). PHASE3 Amendment 2 removed the member pass
 * itself; these keys now sign and verify the gym (branch) QR v2 and the
 * coach (specialist) QR v2.
 *
 * One active key per gym, created lazily. The secret is stored encrypted
 * with Crypt (APP_KEY) and only decrypted inside withSigner(); it is never
 * logged or returned. Rotation retires the active key (verifiable until
 * retired_at + member_pass_ttl_days); revocation is immediate and final.
 * pass_keys (bootstrap, /offline/me) publishes the public keys.
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

    public static function b64url(string $bin): string
    {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    public static function b64urlDecode(string $txt): string|false
    {
        return base64_decode(strtr($txt, '-_', '+/'), true);
    }

    /**
     * Raw Ed25519 public key for `kid` if it may verify a credential of
     * `gymId` scanned at `at`: the gym's own key, never revoked, active or
     * retired within grace. Shared by member passes and branch QR v2.
     */
    public function verificationKey(string $kid, string $gymId, CarbonInterface $at): ?string
    {
        $key = DB::table('gym_signing_keys')->where('kid', $kid)->where('purpose', self::PURPOSE)->first();
        if (! $key || strtolower((string) $key->gym_id) !== strtolower($gymId) || $key->status === 'revoked') {
            return null;
        }
        if ($key->status !== 'active') {
            $end = $this->graceEnd($key);
            if ($key->status !== 'retired' || ! $end || Carbon::instance($at)->gte($end)) {
                return null;
            }
        }
        return self::b64urlDecodeStrict($key->public_key, SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES);
    }

    /**
     * Run $fn($kid, $sign) with the gym's active key; $sign(string $message)
     * returns the base64url signature. The secret is decrypted once (so a
     * rotating batch costs one decrypt) and wiped afterwards. It never
     * leaves this method.
     */
    public function withSigner(string $gymId, callable $fn, ?object $key = null): mixed
    {
        $key ??= $this->activeKey($gymId);
        $secret = self::b64urlDecode(Crypt::decryptString($key->secret_key_enc));
        try {
            return $fn($key->kid, fn (string $message) => self::b64url(sodium_crypto_sign_detached($message, $secret)));
        } finally {
            sodium_memzero($secret);
        }
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
