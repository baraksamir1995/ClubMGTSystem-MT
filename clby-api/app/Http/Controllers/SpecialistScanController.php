<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
use App\Services\SpecialistSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
 * expired / 30-min anti-double-scan, all inside a row lock). The rules live
 * in SpecialistSessionService, shared with the offline sync; responses here
 * are unchanged. On "no usable
 * package" we return a structured error carrying the specialist's
 * trainer_type so the app can deep-link to that specialist's packages and
 * offer to buy.
 */
class SpecialistScanController extends Controller
{
    use ResolvesMemberScope;

    public function scan(Request $request, SpecialistSessionService $sessions): JsonResponse
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
            $result = $sessions->memberScan($gymId, $ownMemberId, $trainerId, $trainerInfo);
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

        return response()->json(['data' => $result['data']], 201);
    }
}
