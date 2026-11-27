<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Member scans a specialist (coach) QR → one session of that member's pack
 * with that specialist. Extracted from SpecialistScanController::scan (which
 * is now a thin wrapper with unchanged responses, see
 * SpecialistScanRegressionTest) so the offline sync (PHASE3 Amendment 2 §C:
 * kind=service_session, method=member_qr) runs the same rules.
 *
 * The assignment is resolved from (member × trainer) — never chosen by the
 * client. Everything runs inside one transaction with the member's packs
 * row-locked.
 *
 * Online (no `at`): exactly the original behaviour.
 * Sync (`at` = device_recorded_at):
 *  - expiry judged at `at`; the 30-min guard (member × specialist) is
 *    symmetric around `at` and returns the CLASHING log so the caller can
 *    answer duplicate with the original log id;
 *  - D2: if every pack valid at `at` is used up, the session is accepted
 *    with review_flag 'pack_exhausted' and no counter change;
 *  - the log carries delivered_at = `at` and source_event_id.
 */
class SpecialistSessionService
{
    public const SCAN_GUARD_MINUTES = 30;

    /**
     * @param array $trainerInfo  echoed into error extras / data (online contract)
     * @param array{at?: ?Carbon, source_event_id?: ?string} $opts
     * @return array{error: array}|array{data: array, flags: list<string>}
     *   sync guard error carries 'log_id' of the clashing session.
     */
    public function memberScan(string $gymId, string $memberId, string $trainerId, array $trainerInfo = [], array $opts = []): array
    {
        $at = $opts['at'] ?? null;
        $sync = $at !== null;

        return DB::transaction(function () use ($gymId, $memberId, $trainerId, $trainerInfo, $at, $sync, $opts) {
            // All of this member's packs with this specialist, locked so a
            // concurrent scan can't double-decrement the same row.
            $assignments = DB::table('member_service_assignments')
                ->where('gym_id', $gymId)
                ->where('gym_member_id', $memberId)
                ->where('trainer_id', $trainerId)
                ->lockForUpdate()
                ->orderBy('assigned_at', 'asc')
                ->get();

            if ($assignments->isEmpty()) {
                // Never had a package with this specialist → straight to
                // "offer to buy".
                return ['error' => [
                    'code'    => 'no_package',
                    'message' => 'You don\'t have a session package with this specialist yet.',
                    'status'  => 404,
                    'extra'   => $trainerInfo,
                ]];
            }

            return $sync
                ? $this->syncScan($gymId, $memberId, $trainerId, $assignments, Carbon::instance($at), $opts)
                : $this->onlineScan($gymId, $memberId, $trainerId, $assignments, $trainerInfo);
        });
    }

    private function onlineScan(string $gymId, string $memberId, string $trainerId, $assignments, array $trainerInfo): array
    {
        $now = Carbon::now();

        // Pick the best usable pack: active, sessions remaining, not
        // expired. Among usable packs, consume the one expiring
        // soonest (nulls last) so members don't lose sessions to
        // expiry while a later pack sits unused.
        $usable = $assignments->filter(function ($a) use ($now) {
            $remaining = (int) $a->sessions_total - (int) $a->sessions_used;
            $expired   = $a->expires_at && Carbon::parse($a->expires_at)->lt($now);
            return $a->status === 'active' && $remaining > 0 && ! $expired;
        })->sortBy(function ($a) {
            return $a->expires_at ? Carbon::parse($a->expires_at)->getTimestamp() : PHP_INT_MAX;
        })->values();

        if ($usable->isEmpty()) {
            // Has packs but none usable — distinguish exhausted vs
            // expired for a clearer message, but both still offer to
            // buy a fresh package.
            $anyExpired = $assignments->contains(function ($a) use ($now) {
                $remaining = (int) $a->sessions_total - (int) $a->sessions_used;
                return $remaining > 0 && $a->expires_at && Carbon::parse($a->expires_at)->lt($now);
            });
            return ['error' => [
                'code'    => $anyExpired ? 'package_expired' : 'package_exhausted',
                'message' => $anyExpired
                    ? 'Your package with this specialist has expired.'
                    : 'You\'ve used all sessions in your package with this specialist.',
                'status'  => 409,
                'extra'   => $trainerInfo,
            ]];
        }

        $assignment = $usable->first();

        // 30-min guard — scoped to (this member × this specialist),
        // NOT to a single pack. One gym visit is one session with the
        // specialist; without the wider scope a member holding two
        // packs could double-charge by re-scanning, because the
        // second scan would land on the other pack.
        $guardCutoff = $now->copy()->subMinutes(self::SCAN_GUARD_MINUTES);
        $lastLog = DB::table('service_session_logs')
            ->where('gym_member_id', $memberId)
            ->where('trainer_id', $trainerId)
            ->where('delivered_at', '>', $guardCutoff)
            ->orderByDesc('delivered_at')
            ->first();
        if ($lastLog) {
            $secondsAgo  = max(0, $now->getTimestamp() - Carbon::parse($lastLog->delivered_at)->getTimestamp());
            $secondsLeft = (self::SCAN_GUARD_MINUTES * 60) - $secondsAgo;
            $minutesLeft = max(1, (int) ceil($secondsLeft / 60));
            return ['error' => [
                'code'    => 'recently_logged',
                'message' => 'This session was already logged in the last '.self::SCAN_GUARD_MINUTES.' minutes.',
                'status'  => 409,
                'extra'   => array_merge($trainerInfo, [
                    'minutes_left'      => $minutesLeft,
                    'last_delivered_at' => $lastLog->delivered_at,
                ]),
            ]];
        }

        return $this->deliver($gymId, $memberId, $trainerId, $assignment, $now, $trainerInfo, null, false);
    }

    private function syncScan(string $gymId, string $memberId, string $trainerId, $assignments, Carbon $at, array $opts): array
    {
        $expiredAt = fn ($a) => $a->expires_at && Carbon::parse($a->expires_at)->lt($at);
        $spent = fn ($a) => (int) $a->sessions_used >= (int) $a->sessions_total;

        // Packs that were valid at the visit: not expired then, and either
        // active or 'completed' only because they were used up (D2).
        $valid = $assignments->filter(fn ($a) => ! $expiredAt($a)
            && ($a->status === 'active' || ($a->status === 'completed' && $spent($a))));

        if ($valid->isEmpty()) {
            $anyExpired = $assignments->contains(fn ($a) => $expiredAt($a) && in_array($a->status, ['active', 'completed'], true));
            return ['error' => $anyExpired
                ? ['code' => 'package_expired', 'message' => 'Your package with this specialist had expired at the time of the scan.', 'status' => 409]
                : ['code' => 'assignment_not_active', 'message' => 'Your package with this specialist is no longer active.', 'status' => 409]];
        }

        // Symmetric guard around the visit (member × specialist).
        $window = self::SCAN_GUARD_MINUTES * 60;
        $clash = DB::table('service_session_logs')
            ->where('gym_member_id', $memberId)->where('trainer_id', $trainerId)
            ->get(['id', 'delivered_at'])
            ->first(fn ($l) => abs(Carbon::parse($l->delivered_at)->getTimestamp() - $at->getTimestamp()) < $window);
        if ($clash) {
            return ['error' => [
                'code' => 'recently_logged',
                'message' => 'This session was already logged within '.self::SCAN_GUARD_MINUTES.' minutes of this scan.',
                'status' => 409,
                'log_id' => $clash->id,
            ]];
        }

        $byExpiry = fn ($a) => $a->expires_at ? Carbon::parse($a->expires_at)->getTimestamp() : PHP_INT_MAX;
        $usable = $valid->filter(fn ($a) => $a->status === 'active' && ! $spent($a))->sortBy($byExpiry)->values();
        if ($usable->isNotEmpty()) {
            return $this->deliver($gymId, $memberId, $trainerId, $usable->first(), $at, [], $opts['source_event_id'] ?? null, false);
        }

        // D2: used up between the visit and the sync → accept, flag, no counter change.
        return $this->deliver($gymId, $memberId, $trainerId, $valid->sortBy($byExpiry)->first(), $at, [], $opts['source_event_id'] ?? null, true);
    }

    private function deliver(string $gymId, string $memberId, string $trainerId, object $assignment, Carbon $when, array $trainerInfo, ?string $sourceEventId, bool $flagged): array
    {
        $logId  = Str::uuid()->toString();
        $nowIso = Carbon::now()->toIso8601String();
        $deliveredIso = $when->toIso8601String();

        $row = [
            'id'            => $logId,
            'gym_id'        => $gymId,
            'assignment_id' => $assignment->id,
            'trainer_id'    => $trainerId,
            'gym_member_id' => $memberId,
            'delivered_at'  => $deliveredIso,
            // Marks the member-initiated origin in the admin Services
            // Log (the coach flow leaves this null / a coach note).
            'note'          => 'Member self-scan',
            'created_at'    => $nowIso,
            'updated_at'    => $nowIso,
        ];
        if ($sourceEventId) {
            $row['source_event_id'] = $sourceEventId;
            $row['review_flag'] = $flagged ? 'pack_exhausted' : null;
        }
        DB::table('service_session_logs')->insert($row);

        if ($flagged) {
            $newUsed = (int) $assignment->sessions_used;
            $exhausted = true;
        } else {
            $newUsed   = (int) $assignment->sessions_used + 1;
            $exhausted = $newUsed >= (int) $assignment->sessions_total;
            DB::table('member_service_assignments')
                ->where('id', $assignment->id)
                ->update([
                    'sessions_used' => $newUsed,
                    'status'        => $exhausted ? 'completed' : $assignment->status,
                ]);
        }

        return [
            'data' => array_merge($trainerInfo, [
                'log_id'             => $logId,
                'assignment_id'      => $assignment->id,
                'package_name'       => $assignment->package_name,
                'service_type'       => $assignment->service_type,
                'sessions_total'     => (int) $assignment->sessions_total,
                'sessions_used'      => $newUsed,
                'sessions_remaining' => max(0, (int) $assignment->sessions_total - $newUsed),
                'completed'          => $exhausted,
                'delivered_at'       => $deliveredIso,
            ]),
            'flags' => $flagged ? ['pack_exhausted'] : [],
        ];
    }
}
