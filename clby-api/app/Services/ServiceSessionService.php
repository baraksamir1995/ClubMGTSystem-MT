<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Coach-delivered PT/physio session: 30-min-guarded decrement of a
 * member_service_assignments pack + one service_session_logs row.
 *
 * Extracted from CoachController::decrement (which is now a thin wrapper
 * with unchanged responses, see CoachDecrementRegressionTest) so the
 * offline sync (kind=service_session, D5) runs the same rules.
 *
 * Online (no `at`):
 *  - The assignment row is lockForUpdate-locked inside a txn so a second
 *    concurrent decrement waits for ours to commit.
 *  - The 30-minute window is re-checked INSIDE the txn, after the lock.
 *  - On the boundary case (this scan brings used to total) the
 *    assignment's `status` flips to 'completed'.
 *
 * Sync (`at` = device_recorded_at):
 *  - delivered_at = `at`; expiry is judged against `at`.
 *  - 30-min guard is symmetric around `at` (an offline session may sync
 *    after a later online one): any delivery within ±30 min blocks it.
 *  - D2: if the pack is used up by the time the event syncs (used >= total,
 *    usually with status already flipped to 'completed'), the session is
 *    still ACCEPTED: the log row is written with review_flag
 *    'pack_exhausted' and the counter is NOT incremented, so sessions_used
 *    never exceeds sessions_total. Staff review flagged rows.
 */
class ServiceSessionService
{
    public const SCAN_GUARD_MINUTES = 30;

    /**
     * @param array{at?: ?CarbonInterface, source_event_id?: ?string} $opts
     * @return array{error: array{code: string, message: string, status: int, extra?: array}}
     *       |array{data: array, flags: list<string>}
     */
    public function deliver(string $coachId, string $gymId, string $assignmentId, ?string $note, array $opts = []): array
    {
        $at = $opts['at'] ?? null;
        $sync = $at !== null;

        return DB::transaction(function () use ($coachId, $gymId, $assignmentId, $note, $at, $sync, $opts) {
            $assignment = DB::table('member_service_assignments')
                ->where('id', $assignmentId)
                ->where('gym_id', $gymId)
                ->lockForUpdate()
                ->first();

            if (! $assignment) {
                return ['error' => ['code' => 'not_found', 'message' => 'Assignment not found', 'status' => 404]];
            }
            if ($assignment->trainer_id !== $coachId) {
                return ['error' => ['code' => 'forbidden', 'message' => 'This assignment belongs to a different coach.', 'status' => 403]];
            }

            $spent = $assignment->sessions_used >= $assignment->sessions_total;
            // Sync: a pack that is 'completed' only because it was used up
            // is the D2 case below, not "inactive".
            $inactive = $sync
                ? ! ($assignment->status === 'active' || ($assignment->status === 'completed' && $spent))
                : $assignment->status !== 'active';
            if ($inactive) {
                return ['error' => ['code' => 'not_active', 'message' => 'Assignment is no longer active.', 'status' => 409]];
            }
            if ($spent && ! $sync) {
                return ['error' => ['code' => 'exhausted', 'message' => 'No sessions remaining on this package.', 'status' => 409]];
            }
            $reference = $sync ? Carbon::instance($at) : Carbon::now();
            if ($assignment->expires_at && Carbon::parse($assignment->expires_at)->lt($reference)) {
                return ['error' => ['code' => 'expired', 'message' => 'Package expired.', 'status' => 409]];
            }

            // 30-min guard — checked inside the lock, after fetching
            // the assignment, so a concurrent decrement can't sneak
            // in between the check and our insert.
            if ($sync) {
                $guardError = $this->syncGuard($assignment->id, $reference);
                if ($guardError) {
                    return $guardError;
                }
            } else {
                $guardCutoff = Carbon::now()->subMinutes(self::SCAN_GUARD_MINUTES);
                $lastLog = DB::table('service_session_logs')
                    ->where('assignment_id', $assignment->id)
                    ->where('delivered_at', '>', $guardCutoff)
                    ->orderByDesc('delivered_at')
                    ->first();
                if ($lastLog) {
                    // Use unix timestamps so a stray timezone on either
                    // side of the comparison can't drift the result by
                    // whole hours (Carbon's `diffInSeconds` was returning
                    // ~1740 with mixed-TZ inputs).
                    $secondsAgo = max(
                        0,
                        Carbon::now()->getTimestamp() - Carbon::parse($lastLog->delivered_at)->getTimestamp()
                    );
                    $secondsLeft = (self::SCAN_GUARD_MINUTES * 60) - $secondsAgo;
                    $minutesLeft = max(1, (int) ceil($secondsLeft / 60));
                    return ['error' => [
                        'code'    => 'recently_logged',
                        'message' => "This member was already logged in the last ".self::SCAN_GUARD_MINUTES." minutes.",
                        'status'  => 409,
                        'extra'   => [
                            'minutes_left'      => $minutesLeft,
                            'last_delivered_at' => $lastLog->delivered_at,
                        ],
                    ]];
                }
            }

            $logId = Str::uuid()->toString();
            $now   = Carbon::now();
            // Postgres `timestamp with time zone` interprets naive
            // strings using the session TZ (Africa/Cairo here), while
            // Laravel's `app.timezone` is UTC. Pass an ISO-8601 string
            // with explicit offset so the stored instant is correct
            // regardless of either side's TZ setting.
            $nowIso = $now->toIso8601String();
            $deliveredIso = $sync ? $reference->toIso8601String() : $nowIso;
            $flagged = $sync && $spent;

            $row = [
                'id'             => $logId,
                'gym_id'         => $gymId,
                'assignment_id'  => $assignment->id,
                'trainer_id'     => $coachId,
                'gym_member_id'  => $assignment->gym_member_id,
                'delivered_at'   => $deliveredIso,
                'note'           => $note,
                'created_at'     => $nowIso,
                'updated_at'     => $nowIso,
            ];
            if (! empty($opts['source_event_id'])) {
                $row['source_event_id'] = $opts['source_event_id'];
                $row['review_flag'] = $flagged ? 'pack_exhausted' : null;
            }
            DB::table('service_session_logs')->insert($row);

            if ($flagged) {
                // D2: accepted for review, counters untouched.
                $newUsed = (int) $assignment->sessions_used;
                $exhausted = true;
            } else {
                $newUsed   = $assignment->sessions_used + 1;
                $exhausted = $newUsed >= $assignment->sessions_total;
                DB::table('member_service_assignments')
                    ->where('id', $assignment->id)
                    ->update([
                        'sessions_used' => $newUsed,
                        'status'        => $exhausted ? 'completed' : $assignment->status,
                    ]);
            }

            return [
                'data' => [
                    'log_id'        => $logId,
                    'assignment_id' => $assignment->id,
                    'sessions_used' => $newUsed,
                    'sessions_remaining' => max(0, $assignment->sessions_total - $newUsed),
                    'completed'     => $exhausted,
                    'delivered_at'  => $sync ? $deliveredIso : $now->toIso8601String(),
                ],
                'flags' => $flagged ? ['pack_exhausted'] : [],
                'gym_member_id' => $assignment->gym_member_id,
            ];
        });
    }

    /**
     * Symmetric ±30-min guard around an offline delivery time. Compared in
     * PHP on unix timestamps (packs are small) so mixed timestamp formats /
     * session time zones can't skew it.
     */
    private function syncGuard(string $assignmentId, Carbon $at): ?array
    {
        $window = self::SCAN_GUARD_MINUTES * 60;
        $atTs = $at->getTimestamp();

        $clash = DB::table('service_session_logs')
            ->where('assignment_id', $assignmentId)
            ->pluck('delivered_at')
            ->first(fn ($d) => abs(Carbon::parse($d)->getTimestamp() - $atTs) < $window);

        if ($clash === null) {
            return null;
        }

        return ['error' => [
            'code'    => 'recently_logged',
            'message' => "This member was already logged within ".self::SCAN_GUARD_MINUTES." minutes of this session.",
            'status'  => 409,
            'extra'   => ['last_delivered_at' => $clash],
        ]];
    }
}
