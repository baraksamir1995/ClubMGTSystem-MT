<?php

namespace App\Http\Controllers;

use App\Services\BranchQrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The branch's one fixed signed QR v2 poster (PHASE3-CONTRACT §3 + amendment:
 * same text on every call; no rotating/kiosk batches).
 * Admin group + permission:attendance,view; branch must be in the caller's gym.
 * Responses carry the public kid only — never key material.
 */
class BranchQrController extends Controller
{
    /** GET /api/branches/{id}/qr?mode=static → {qr, mode, expires_at, kid} — identical on every call. */
    public function show(Request $request, BranchQrService $qrs, string $id): JsonResponse
    {
        $request->validate(['mode' => 'nullable|in:static']);
        $branch = $this->branch($request, $id);
        if (! $branch) {
            return response()->json(['error' => 'Branch not found'], 404);
        }
        return response()->json($qrs->posterFor($request->user()->gym_id, $branch));
    }

    private function branch(Request $request, string $id): ?object
    {
        if (! Str::isUuid($id)) {
            return null;
        }
        return DB::table('branches')
            ->where('id', strtolower($id))->where('gym_id', $request->user()->gym_id)
            ->first(['id', 'gym_id', 'name', 'is_active', 'qr_token']);
    }
}
