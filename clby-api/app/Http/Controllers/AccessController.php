<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccessController extends Controller
{
    use ResolvesMemberScope;

    public function validateQr(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|uuid',
        ]);

        $result = DB::select('SELECT validate_gym_qr_token(?) AS data', [
            $validated['token'],
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    public function regenerateQr(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => 'required|uuid',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        // The branch must belong to the caller's gym — without this check
        // an admin could regenerate a foreign tenant's QR token.
        $exists = DB::table('branches')
            ->where('id', $validated['branch_id'])
            ->where('gym_id', $gymId)
            ->exists();
        if (! $exists) {
            return response()->json(['error' => 'Branch not found'], 404);
        }

        $result = DB::select('SELECT regenerate_branch_qr_token(?, ?) AS token', [
            $validated['branch_id'],
            $gymId,
        ]);

        return response()->json(['data' => ['token' => $result[0]->token]]);
    }

    public function validateBranch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'required|uuid',
            'branch_id' => 'required|uuid',
        ]);

        // Members must validate access as themselves only. Admins/staff/
        // trainers can validate on behalf of any member in their own
        // gym. Previously the check let any member of gym X validate
        // *every other member of gym X*, which breaks branch-restricted
        // entitlements (sees who can/can't enter where).
        $resolved = $this->scopedMemberId($request, $validated['gym_member_id']);
        if (! $resolved) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Branch must also belong to the caller's gym.
        $branchInGym = DB::table('branches')
            ->where('id', $validated['branch_id'])
            ->where('gym_id', $request->user()->gym_id)
            ->exists();
        if (! $branchInGym) {
            return response()->json(['error' => 'Branch not found'], 404);
        }

        $result = DB::select('SELECT validate_branch_access(?, ?) AS data', [
            $resolved,
            $validated['branch_id'],
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    public function validateStudio(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'studio_id' => 'required|uuid',
            'user_id' => 'required|uuid',
        ]);

        $user = $request->user();
        $isAdmin = $this->callerIsAdmin($request);

        // Members must validate as themselves only — even within their
        // own gym. Admins can validate on behalf of any user, but only
        // within their own gym (target user_id and target studio_id
        // must both resolve to the caller's gym).
        if (! $isAdmin && $validated['user_id'] !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($isAdmin) {
            $targetGymId = DB::table('profiles')
                ->where('id', $validated['user_id'])
                ->value('gym_id');
            if ($targetGymId !== $user->gym_id) {
                return response()->json(['error' => 'User not in this gym'], 403);
            }
        }

        $studioInGym = DB::table('studios')
            ->where('id', $validated['studio_id'])
            ->where('gym_id', $user->gym_id)
            ->exists();
        if (! $studioInGym) {
            return response()->json(['error' => 'Studio not found'], 404);
        }

        $result = DB::select('SELECT validate_studio_access(?, ?) AS data', [
            $validated['studio_id'],
            $validated['user_id'],
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }
}
