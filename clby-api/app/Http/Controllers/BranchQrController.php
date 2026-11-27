<?php

namespace App\Http\Controllers;

use App\Services\BranchQrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Signed branch QR v2 for posters and kiosks (PHASE3-CONTRACT §3).
 * Admin group + permission:attendance,view; branch must be in the caller's gym.
 * Responses carry the public kid only — never key material.
 */
class BranchQrController extends Controller
{
    /** GET /api/branches/{id}/qr?mode=static → {qr, mode, expires_at, kid} */
    public function show(Request $request, BranchQrService $qrs, string $id): JsonResponse
    {
        $request->validate(['mode' => 'nullable|in:static']);
        $branch = $this->branch($request, $id);
        if (! $branch) {
            return response()->json(['error' => 'Branch not found'], 404);
        }
        return response()->json($qrs->issueStatic($request->user()->gym_id, $branch));
    }

    /** GET /api/branches/{id}/qr/rotating-batch?hours=12 (1–24) → {tokens:[{qr,iat,exp}], kid, generated_at} */
    public function rotatingBatch(Request $request, BranchQrService $qrs, string $id): JsonResponse
    {
        $max = (int) config('attendance_offline.rotating_batch_max_hours', 24);
        $request->validate(['hours' => "nullable|integer|min:1|max:{$max}"]);
        $branch = $this->branch($request, $id);
        if (! $branch) {
            return response()->json(['error' => 'Branch not found'], 404);
        }
        return response()->json($qrs->rotatingBatch($request->user()->gym_id, $branch, (int) ($request->query('hours') ?? 12)));
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
