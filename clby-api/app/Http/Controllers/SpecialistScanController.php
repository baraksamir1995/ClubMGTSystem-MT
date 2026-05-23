<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Member-side specialist QR scan.
 *
 * The mirror of CoachController::decrement, but initiated by the MEMBER:
 * the specialist displays a static QR encoding their trainer_profile id
 * (`{type:'specialist_session', gym_id, trainer_id}`), the member scans it
 * in the app, and that member's own session package with that specialist
 * is decremented.
 *
 * Where the coach flow trusts the coach to pick the assignment, here we
 * resolve the assignment from (caller's own gym_member_id × scanned
 * trainer_id) so a hostile client can't decrement someone else's pack or a
 * pack belonging to a different specialist.
 *
 * Guards mirror the coach decrement exactly (active / remaining / not
 * expired / 30-min anti-double-scan, all inside a row lock). On "no usable
 * package" we return a structured error carrying the specialist's
 * trainer_type so the app can deep-link to that specialist's packages and
 * offer to buy.
 */
class SpecialistScanController extends Controller
{
    use ResolvesMemberScope;

    private const SCAN_GUARD_MINUTES = 30;

    public function scan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'trainer_id' => 'required|uuid',
        ]);

        $gymId        = $request->user()->gym_id;
        $trainerId    = $validated['trainer_id'];
        $ownMemberId  = $this->callerOwnMemberId($request);

        if (! $ownMemberId) {
            return response()->json([
                'error' => 'No active membership found for your account.',
                'code'  => 'no_member',
            ], 403);
        }

        // The scanned specialist must belong to the caller's gym. This both
        // keeps tenants apart and lets us return the specialist's name/type
        // for the "offer to buy" path.
        $trainer = DB::table('trainer_profiles')
            ->where('id', $trainerId)
            ->where('gym_id', $gymId)
            ->first(['id', 'name', 'trainer_type', 'is_active']);

        if (! $trainer) {
            return response()->json([
                'error' => 'This specialist code is not valid for your gym.',
                'code'  => 'specialist_not_found',
            ], 404);
        }

        $trainerInfo = [
            'trainer_id'   => $trainer->id,
            'trainer_name' => $trainer->name,
            'trainer_type' => $trainer->trainer_type,
        ];

        try {
            $result = DB::transaction(function () use ($gymId, $trainerId, $ownMemberId, $trainerInfo) {
                // All of this member's packs with this specialist, locked so a
                // concurrent scan can't double-decrement the same row.
                $assignments = DB::table('member_service_assignments')
                    ->where('gym_id', $gymId)
                    ->where('gym_member_id', $ownMemberId)
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
                // second scan would land on the other pack. (The coach flow
                // guards per-assignment because the coach picks the pack; the
                // member never does.)
                $guardCutoff = $now->copy()->subMinutes(self::SCAN_GUARD_MINUTES);
                $lastLog = DB::table('service_session_logs')
                    ->where('gym_member_id', $ownMemberId)
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

                $logId  = Str::uuid()->toString();
                $nowIso = $now->toIso8601String();

                DB::table('service_session_logs')->insert([
                    'id'            => $logId,
                    'gym_id'        => $gymId,
                    'assignment_id' => $assignment->id,
                    'trainer_id'    => $trainerId,
                    'gym_member_id' => $ownMemberId,
                    'delivered_at'  => $nowIso,
                    // Marks the member-initiated origin in the admin Services
                    // Log (the coach flow leaves this null / a coach note).
                    'note'          => 'Member self-scan',
                    'created_at'    => $nowIso,
                    'updated_at'    => $nowIso,
                ]);

                $newUsed   = (int) $assignment->sessions_used + 1;
                $exhausted = $newUsed >= (int) $assignment->sessions_total;
                DB::table('member_service_assignments')
                    ->where('id', $assignment->id)
                    ->update([
                        'sessions_used' => $newUsed,
                        'status'        => $exhausted ? 'completed' : $assignment->status,
                    ]);

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
                        'delivered_at'       => $nowIso,
                    ]),
                ];
            });
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['error' => 'Could not log the session. Try again.'], 500);
        }

        if (isset($result['error'])) {
            $err = $result['error'];
            $payload = ['error' => $err['message'], 'code' => $err['code']];
            if (! empty($err['extra'])) {
                $payload = array_merge($payload, $err['extra']);
            }
            return response()->json($payload, $err['status']);
        }

        return response()->json($result, 201);
    }
}
