<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccessController extends Controller
{
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

        // Verify the gym_member belongs to the authenticated user's gym or is the user themselves
        $gymMember = DB::table('gym_members')->where('id', $validated['gym_member_id'])->first();
        $user = $request->user();
        if (! $gymMember || ($gymMember->user_id !== $user->id && $gymMember->gym_id !== $user->gym_id)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $result = DB::select('SELECT validate_branch_access(?, ?) AS data', [
            $validated['gym_member_id'],
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

        // Verify the user_id belongs to the authenticated user or same gym
        $user = $request->user();
        if ($validated['user_id'] !== $user->id && $user->role === 'member') {
            return response()->json(['error' => 'Unauthorized'], 403);
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
