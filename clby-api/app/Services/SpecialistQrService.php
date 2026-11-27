<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Signed coach (specialist) QR v2 — PHASE3-CONTRACT Amendment 2 §C.
 *
 * QR text = strict JSON superset of the coach app's v1 QR, keys in order:
 *   {"type":"specialist_session","gym_id","trainer_id","v":2,"kid","iat","exp","jti","sig"}
 * sig = Ed25519 with the gym's signing key (same key/kid/rotation/revocation
 * as the branch QR) over
 *   clby_sq|2|<kid>|<gym_id>|<trainer_id>|<iat>|<exp>|<jti>
 * Old member apps read only type/gym_id/trainer_id and keep working online
 * (POST /specialists/scan takes trainer_id).
 *
 * One fixed QR per trainer, stored in trainer_qr_posters: same text on every
 * call; reissued only when the stored kid is no longer the gym's active key
 * or the QR is within branch_qr_reissue_before_days of exp. TTL =
 * branch_qr_static_ttl_days (3650).
 */
class SpecialistQrService
{
    public function __construct(private MemberPassService $keys) {}

    /** The trainer's fixed QR: {qr, expires_at, kid}. Concurrent first calls get one text. */
    public function qrFor(string $gymId, string $trainerId): array
    {
        $activeKid = $this->keys->activeKey($gymId)->kid;
        $trainerId = strtolower($trainerId);
        $fresh = function (?object $row) use ($activeKid): bool {
            $minLeft = (int) config('attendance_offline.branch_qr_reissue_before_days', 30) * 86400;
            return $row && $row->kid === $activeKid && ((int) $row->exp - time()) > $minLeft;
        };
        $shape = fn (object $row) => ['qr' => $row->qr,
            'expires_at' => AttendanceSyncService::iso(Carbon::createFromTimestampUTC((int) $row->exp)), 'kid' => $row->kid];

        $row = DB::table('trainer_qr_posters')->where('trainer_id', $trainerId)->first();
        if ($fresh($row)) {
            return $shape($row);
        }

        return DB::transaction(function () use ($gymId, $trainerId, $fresh, $shape) {
            if (DB::getDriverName() === 'pgsql') {
                DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['trainer-qr:' . $trainerId]);
            }
            $row = DB::table('trainer_qr_posters')->where('trainer_id', $trainerId)->lockForUpdate()->first();
            if ($fresh($row)) {
                return $shape($row);
            }
            $qr = $this->issue($gymId, $trainerId);
            $q = json_decode($qr, true);
            $values = ['gym_id' => strtolower($gymId), 'qr' => $qr, 'kid' => $q['kid'], 'iat' => $q['iat'], 'exp' => $q['exp'],
                'updated_at' => Carbon::now('UTC')->toIso8601String()];
            if ($row) {
                DB::table('trainer_qr_posters')->where('trainer_id', $trainerId)->update($values);
            } else {
                DB::table('trainer_qr_posters')->insert($values + ['trainer_id' => $trainerId, 'created_at' => $values['updated_at']]);
            }
            return $shape((object) ($values + ['trainer_id' => $trainerId]));
        });
    }

    /** Sign a new coach QR (not stored — use qrFor()). */
    public function issue(string $gymId, string $trainerId, ?CarbonInterface $at = null): string
    {
        $gymId = strtolower($gymId);
        $trainerId = strtolower($trainerId);
        $iat = ($at ?? Carbon::now('UTC'))->getTimestamp();
        $exp = $iat + max(1, (int) config('attendance_offline.branch_qr_static_ttl_days', 3650)) * 86400;
        $jti = BranchQrService::newJti();

        return $this->keys->withSigner($gymId, fn (string $kid, callable $sign) => json_encode([
            'type' => 'specialist_session',
            'gym_id' => $gymId,
            'trainer_id' => $trainerId,
            'v' => 2,
            'kid' => $kid,
            'iat' => $iat,
            'exp' => $exp,
            'jti' => $jti,
            'sig' => $sign(self::canonical($kid, $gymId, $trainerId, $iat, $exp, $jti)),
        ], JSON_UNESCAPED_SLASHES));
    }

    /**
     * Server verification as of the scan (device_recorded_at):
     * 1 strict parse → 2 gym → 3 key → 4 signature → 5 trainer (active, of
     * this gym) → 6 time (iat > exp → qr_invalid; iat > scan + skew or
     * scan > exp → qr_expired).
     *
     * @return array{ok: true, qr: array, trainer: object}
     *       | array{ok: false, code: string}  not_v2 | qr_invalid | qr_wrong_gym | qr_expired
     */
    public function verify(?string $raw, string $gymId, CarbonInterface $scan): array
    {
        if (! self::isV2($raw)) {
            return ['ok' => false, 'code' => 'not_v2'];
        }
        $q = self::parse($raw);
        if ($q === null) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        if ($q['gym_id'] !== strtolower($gymId)) {
            return ['ok' => false, 'code' => 'qr_wrong_gym'];
        }
        $pk = $this->keys->verificationKey($q['kid'], $q['gym_id'], $scan);
        if ($pk === null) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        $sig = MemberPassService::b64urlDecodeStrict($q['sig'], SODIUM_CRYPTO_SIGN_BYTES);
        $msg = self::canonical($q['kid'], $q['gym_id'], $q['trainer_id'], $q['iat'], $q['exp'], $q['jti']);
        if ($sig === null || ! sodium_crypto_sign_verify_detached($sig, $msg, $pk)) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        $trainer = DB::table('trainer_profiles')->where('id', $q['trainer_id'])->where('gym_id', $q['gym_id'])
            ->first(['id', 'name', 'trainer_type', 'is_active']);
        if (! $trainer || ! $trainer->is_active) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        $t = Carbon::instance($scan)->getTimestamp();
        $skew = (int) config('attendance_offline.future_skew_seconds', 300);
        if ($q['iat'] > $q['exp']) {
            return ['ok' => false, 'code' => 'qr_invalid'];
        }
        if ($q['iat'] > $t + $skew || $t > $q['exp']) {
            return ['ok' => false, 'code' => 'qr_expired'];
        }
        return ['ok' => true, 'qr' => $q, 'trainer' => $trainer];
    }

    /** v2 iff the raw text decodes to an object with type "specialist_session" and v === 2 (integer). */
    public static function isV2(?string $raw): bool
    {
        if (! is_string($raw) || $raw === '') return false;
        $j = json_decode($raw, true, 4, JSON_BIGINT_AS_STRING);
        return is_array($j) && ! array_is_list($j) && ($j['type'] ?? null) === 'specialist_session' && ($j['v'] ?? null) === 2;
    }

    /** Strict parse — same rules as the branch QR / pass (exactly 9 keys, ints, lowercase UUIDs, canonical sig). */
    public static function parse(?string $raw): ?array
    {
        if (! is_string($raw) || $raw === '' || strlen($raw) > 1024) return null;
        if (str_starts_with($raw, "\xEF\xBB\xBF")) return null;
        $q = json_decode($raw, true, 4, JSON_BIGINT_AS_STRING);
        if (! is_array($q) || array_is_list($q)) return null;
        $keys = ['type', 'gym_id', 'trainer_id', 'v', 'kid', 'iat', 'exp', 'jti', 'sig'];
        if (count($q) !== 9 || array_diff($keys, array_keys($q)) !== []) return null;
        if ($q['type'] !== 'specialist_session' || $q['v'] !== 2) return null;
        foreach (['gym_id', 'trainer_id'] as $k) {
            if (! is_string($q[$k]) || ! preg_match(BranchQrService::UUID, $q[$k])) return null;
        }
        if (! is_string($q['kid']) || ! preg_match('/^[A-Za-z0-9_-]{1,32}$/', $q['kid'])) return null;
        if (! is_int($q['iat']) || ! is_int($q['exp'])) return null;
        if (! is_string($q['jti']) || ! preg_match('/^[A-Za-z0-9_-]{16,32}$/', $q['jti'])) return null;
        if (! is_string($q['sig']) || MemberPassService::b64urlDecodeStrict($q['sig'], SODIUM_CRYPTO_SIGN_BYTES) === null) return null;
        return $q;
    }

    public static function canonical(string $kid, string $gymId, string $trainerId, int $iat, int $exp, string $jti): string
    {
        return implode('|', ['clby_sq', '2', $kid, $gymId, $trainerId, (string) $iat, (string) $exp, $jti]);
    }
}
