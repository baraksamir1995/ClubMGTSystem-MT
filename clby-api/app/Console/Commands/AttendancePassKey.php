<?php

namespace App\Console\Commands;

use App\Services\MemberPassService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Manage a gym's QR signing keys (gym + coach QR v2; PHASE2 amendment §4).
 *
 *   attendance:pass-key {gym}                    list keys
 *   attendance:pass-key {gym} --rotate           new active key; old → retired (grace = TTL)
 *   attendance:pass-key {gym} --revoke=KID       revoke a retired key (never accepted again)
 *   attendance:pass-key {gym} --rotate --revoke=ACTIVE_KID
 *                                                compromised active key: rotate, then revoke it
 *
 * Only kids, statuses and public keys are printed — never secret material.
 */
class AttendancePassKey extends Command
{
    protected $signature = 'attendance:pass-key
        {gym_id : The gym whose QR signing keys to manage}
        {--rotate : Create a new active key and retire the current one}
        {--revoke= : Revoke this kid (no grace). The active key can only be revoked together with --rotate}';

    protected $description = 'List, rotate or revoke a gym\'s QR signing keys';

    public function handle(MemberPassService $passes): int
    {
        $gymId = strtolower((string) $this->argument('gym_id'));
        if (! Str::isUuid($gymId) || ! DB::table('gyms')->where('id', $gymId)->exists()) {
            $this->error("Unknown gym {$gymId}.");
            return self::FAILURE;
        }
        $revoke = $this->option('revoke');

        // Revoking the active key needs a replacement: refuse unless --rotate.
        if ($revoke !== null) {
            $current = DB::table('gym_signing_keys')
                ->where('gym_id', $gymId)->where('purpose', MemberPassService::PURPOSE)->where('status', 'active')
                ->value('kid');
            if ($revoke === $current && ! $this->option('rotate')) {
                $this->error("Key {$revoke} is the active key. Rotate first: add --rotate to create a replacement, then it is revoked.");
                return self::FAILURE;
            }
        }

        if ($this->option('rotate')) {
            $newKid = $passes->rotate($gymId);
            $this->info("Rotated. New active kid: {$newKid}");
        }

        if ($revoke !== null) {
            if ($err = $passes->revoke($gymId, $revoke)) {
                $this->error($err);
                return self::FAILURE;
            }
            $this->info("Revoked kid: {$revoke}");
        }

        $this->table(['kid', 'status', 'valid_until', 'public_key'], array_map(
            fn ($k) => [$k['kid'], $k['status'], $k['valid_until'] ?? '-', $k['public_key']],
            $passes->passKeys($gymId)
        ));
        return self::SUCCESS;
    }
}
