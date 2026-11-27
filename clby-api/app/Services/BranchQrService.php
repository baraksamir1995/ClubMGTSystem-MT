<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Signed branch QR v2 (docs/offline-attendance/PHASE3-CONTRACT.md §1–§2).
 *
 * QR text = strict JSON superset of the v1 poster payload, keys in order:
 *   {"type":"gym_access","gym_id","branch_id","token","v":2,"mode","kid","iat","exp","jti","sig"}
 * sig = Ed25519 with the gym's signing key (gym_signing_keys) over
 *   clby_bq|2|<mode>|<kid>|<gym_id>|<branch_id>|<token>|<iat>|<exp>|<jti>
 * (distinct prefix from the member pass's "clby_mp|1|…").
 *
 * Deployed apps read only type/gym_id/branch_id/token, so a v2 poster still
 * works with POST /attendance/qr unchanged.
 *
 * Product decision (Phase 3 amendment): ONE fixed QR per branch — only
 * `static` posters are issued (posterFor). Rotating QRs are no longer
 * issued, but verify() still handles mode "rotating" (dormant path, kept for
 * the shared corpus and the Dart verifier).
 */
class BranchQrService
{
    public const UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/';
    /** Rotating QRs: exp − iat must be ≤ this, else qr_invalid. */
    public const ROTATING_MAX_LIFETIME = 120;

    public function __construct(private MemberPassService $keys) {}

    public function staticTtlDays(): int
    {
        return max(1, (int) config('attendance_offline.branch_qr_static_ttl_days', 365));
    }

    public function rotatingGrace(): int
    {
        return max(0, (int) config('attendance_offline.rotating_grace_seconds', 30));
    }

    /* ── issue ──────────────────────────────────────────────────── */

    /**
     * The branch's ONE fixed poster QR: {qr, mode, expires_at, kid}. The
     * same text on every call; reissued (and stored) only when the branch
     * token was regenerated, the signing kid is no longer the gym's active
     * key (rotate / revoke), or the poster is within
     * branch_qr_reissue_before_days of exp. Concurrent first calls are
     * serialised (row lock + pg advisory lock) so all callers get one text.
     */
    public function posterFor(string $gymId, object $branch): array
    {
        $activeKid = $this->keys->activeKey($gymId)->kid;
        $branchId = strtolower((string) $branch->id);
        $token = strtolower((string) $branch->qr_token);

        $fresh = function (?object $row) use ($activeKid, $token): bool {
            $minLeft = (int) config('attendance_offline.branch_qr_reissue_before_days', 30) * 86400;
            return $row && $row->kid === $activeKid && strtolower((string) $row->token) === $token
                && ((int) $row->exp - time()) > $minLeft;
        };
        $shape = fn (object $row) => ['qr' => $row->qr, 'mode' => 'static',
            'expires_at' => AttendanceSyncService::iso(Carbon::createFromTimestampUTC((int) $row->exp)), 'kid' => $row->kid];

        $row = DB::table('branch_qr_posters')->where('branch_id', $branchId)->first();
        if ($fresh($row)) {
            return $shape($row);
        }

        return DB::transaction(function () use ($gymId, $branch, $branchId, $token, $fresh, $shape) {
            if (DB::getDriverName() === 'pgsql') {
                DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['branch-qr-poster:' . $branchId]);
            }
            $row = DB::table('branch_qr_posters')->where('branch_id', $branchId)->lockForUpdate()->first();
            if ($fresh($row)) {
                return $shape($row);          // another request reissued it meanwhile
            }

            $issued = $this->issueStatic($gymId, $branch);
            $q = json_decode($issued['qr'], true);
            $values = ['gym_id' => strtolower($gymId), 'qr' => $issued['qr'], 'kid' => $q['kid'], 'token' => $token,
                'iat' => $q['iat'], 'exp' => $q['exp'], 'updated_at' => Carbon::now('UTC')->toIso8601String()];
            if ($row) {
                DB::table('branch_qr_posters')->where('branch_id', $branchId)->update($values);
            } else {
                DB::table('branch_qr_posters')->insert($values + ['branch_id' => $branchId, 'created_at' => $values['updated_at']]);
            }
            return $issued;
        });
    }

    /** Sign a new static poster QR (not stored — use posterFor() for the branch's fixed QR). */
    public function issueStatic(string $gymId, object $branch, ?CarbonInterface $at = null): array
    {
        $iat = ($at ?? Carbon::now('UTC'))->getTimestamp();
        $exp = $iat + $this->staticTtlDays() * 86400;

        return $this->keys->withSigner($gymId, function (string $kid, callable $sign) use ($gymId, $branch, $iat, $exp) {
            $qr = $this->build($sign, 'static', $kid, $gymId, $branch, $iat, $exp, self::newJti());
            return ['qr' => $qr, 'mode' => 'static', 'expires_at' => AttendanceSyncService::iso(Carbon::createFromTimestampUTC($exp)), 'kid' => $kid];
        });
    }

    private function build(callable $sign, string $mode, string $kid, string $gymId, object $branch, int $iat, int $exp, string $jti): string
    {
        $gymId = strtolower($gymId);
        $branchId = strtolower((string) $branch->id);
        $token = strtolower((string) $branch->qr_token);

        return json_encode([
            'type' => 'gym_access',
            'gym_id' => $gymId,
            'branch_id' => $branchId,
            'token' => $token,
            'v' => 2,
            'mode' => $mode,
            'kid' => $kid,
            'iat' => $iat,
            'exp' => $exp,
            'jti' => $jti,
            'sig' => $sign(self::canonical($mode, $kid, $gymId, $branchId, $token, $iat, $exp, $jti)),
        ], JSON_UNESCAPED_SLASHES);
    }

    /* ── verify ─────────────────────────────────────────────────── */

    /**
     * §2 steps 1–6 (server). `$scan` = device_recorded_at.
     *
     * @return array{ok: true, qr: array, branch: object}
     *       | array{ok: false, code: string}   codes: not_v2 | qr_invalid | qr_wrong_gym | qr_expired
     */
    public function verify(?string $raw, string $gymId, CarbonInterface $scan): array
    {
        // 1. v2 detection, then strict parse
        if (! self::isV2($raw)) {
            return ['ok' => false, 'code' => 'not_v2'];
        }
        $q = self::parse($raw);
        if ($q === null) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }

        // 2. gym
        if ($q['gym_id'] !== strtolower($gymId)) {
            return ['ok' => false, 'code' => 'qr_wrong_gym'];
        }

        // 3. key (same rules as the coach QR: gym key, not revoked, grace)
        $pk = $this->keys->verificationKey($q['kid'], $q['gym_id'], $scan);
        if ($pk === null) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }

        // 4. signature
        $sig = MemberPassService::b64urlDecodeStrict($q['sig'], SODIUM_CRYPTO_SIGN_BYTES);
        $msg = self::canonical($q['mode'], $q['kid'], $q['gym_id'], $q['branch_id'], $q['token'], $q['iat'], $q['exp'], $q['jti']);
        if ($sig === null || ! sodium_crypto_sign_verify_detached($sig, $msg, $pk)) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }

        // 5. branch: active, of this gym, token == its CURRENT qr_token
        $branch = DB::table('branches')->where('id', $q['branch_id'])->where('gym_id', $q['gym_id'])
            ->first(['id', 'gym_id', 'name', 'is_active', 'qr_token']);
        if (! $branch || ! $branch->is_active || strtolower((string) $branch->qr_token) !== $q['token']) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }

        // 6. time, judged at the scan
        $t = Carbon::instance($scan)->getTimestamp();
        $skew = (int) config('attendance_offline.future_skew_seconds', 300);
        if ($q['iat'] > $q['exp']) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        // A rotating QR lives 60 s; anything claiming more than 120 s is not
        // a rotating QR this server ever issued (bounds the dormant path).
        if ($q['mode'] === 'rotating' && $q['exp'] - $q['iat'] > self::ROTATING_MAX_LIFETIME) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        $limit = $q['exp'] + ($q['mode'] === 'rotating' ? $this->rotatingGrace() : 0);
        if ($q['iat'] > $t + $skew || $t > $limit) {
            return ['ok' => false, 'code' => 'qr_expired'];
        }

        return ['ok' => true, 'qr' => $q, 'branch' => $branch];
    }

    /**
     * A v2 QR is raw text (as-is, no trimming) that JSON-decodes to an
     * object with type === "gym_access" and v === 2 (integer). Anything
     * else is "not v2" and falls back to v1 handling (online-only).
     */
    public static function isV2(?string $raw): bool
    {
        if (! is_string($raw) || $raw === '') return false;
        $j = json_decode($raw, true, 4, JSON_BIGINT_AS_STRING);
        return is_array($j) && ! array_is_list($j) && ($j['type'] ?? null) === 'gym_access' && ($j['v'] ?? null) === 2;
    }

    /**
     * Strict parse of a v2 QR (same strictness rules as PHASE2
     * amendment §3): ≤ 1024 chars, no BOM, exactly the 11 keys, integers
     * only, lowercase canonical UUIDs, mode static|rotating, kid
     * [A-Za-z0-9_-]{1,32}, jti [A-Za-z0-9_-]{16,32}, canonical unpadded
     * base64url sig of 64 bytes. null → qr_invalid.
     */
    public static function parse(?string $raw): ?array
    {
        if (! is_string($raw) || $raw === '' || strlen($raw) > 1024) return null;
        if (str_starts_with($raw, "\xEF\xBB\xBF")) return null;
        $q = json_decode($raw, true, 4, JSON_BIGINT_AS_STRING);
        if (! is_array($q) || array_is_list($q)) return null;
        $keys = ['type', 'gym_id', 'branch_id', 'token', 'v', 'mode', 'kid', 'iat', 'exp', 'jti', 'sig'];
        if (count($q) !== 11 || array_diff($keys, array_keys($q)) !== []) return null;

        if ($q['type'] !== 'gym_access' || $q['v'] !== 2) return null;
        foreach (['gym_id', 'branch_id', 'token'] as $k) {
            if (! is_string($q[$k]) || ! preg_match(self::UUID, $q[$k])) return null;
        }
        if (! in_array($q['mode'], ['static', 'rotating'], true)) return null;
        if (! is_string($q['kid']) || ! preg_match('/^[A-Za-z0-9_-]{1,32}$/', $q['kid'])) return null;
        if (! is_int($q['iat']) || ! is_int($q['exp'])) return null;
        if (! is_string($q['jti']) || ! preg_match('/^[A-Za-z0-9_-]{16,32}$/', $q['jti'])) return null;
        if (! is_string($q['sig']) || MemberPassService::b64urlDecodeStrict($q['sig'], SODIUM_CRYPTO_SIGN_BYTES) === null) return null;
        return $q;
    }

    public static function canonical(string $mode, string $kid, string $gymId, string $branchId, string $token, int $iat, int $exp, string $jti): string
    {
        return implode('|', ['clby_bq', '2', $mode, $kid, $gymId, $branchId, $token, (string) $iat, (string) $exp, $jti]);
    }

    /** 16 random bytes → 22-char base64url. */
    public static function newJti(): string
    {
        return MemberPassService::b64url(random_bytes(16));
    }
}
