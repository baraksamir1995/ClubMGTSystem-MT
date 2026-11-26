<?php

namespace App\Http\Controllers;

use App\Services\MemberPassService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Signed member pass (PHASE2-CONTRACT). Responses are {qr, expires_at, kid};
 * no key material other than the kid ever leaves the server.
 */
class MemberPassController extends Controller
{
    /** GET /api/me/member-pass — the caller's own pass (members; verified email). */
    public function mine(Request $request, MemberPassService $passes): JsonResponse
    {
        $user = $request->user();
        $member = DB::table('gym_members')
            ->where('user_id', $user->id)->where('gym_id', $user->gym_id)->whereNull('deleted_at')
            ->first(['id', 'member_number']);
        if (! $member) {
            return response()->json(['error' => 'No membership in this gym.', 'code' => 'member_not_found'], 404);
        }

        return response()->json($passes->passFor(
            $user->gym_id, $member->id, $member->member_number !== null ? (int) $member->member_number : null
        ));
    }

    /** GET /api/members/{id}/member-pass — admin-class + permission:members,view (e.g. print a card). */
    public function forMember(Request $request, MemberPassService $passes, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $member = Str::isUuid($id)
            ? DB::table('gym_members')->where('id', strtolower($id))->where('gym_id', $gymId)->whereNull('deleted_at')
                ->first(['id', 'member_number'])
            : null;
        if (! $member) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        return response()->json($passes->passFor(
            $gymId, $member->id, $member->member_number !== null ? (int) $member->member_number : null
        ));
    }
}
