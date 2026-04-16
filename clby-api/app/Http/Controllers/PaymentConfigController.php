<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentConfigController extends Controller
{
    public function credentials(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => null]);
        }

        $result = DB::select('SELECT get_gym_payment_creds(?) AS data', [$gymId]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => null]);
        }

        $result = DB::select('SELECT get_gym_payment_status(?) AS data', [$gymId]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    public function upsert(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'secret_key' => 'required|string',
            'public_key' => 'required|string',
            'integration_id' => 'required|string',
            'valu_integration_id' => 'nullable|string',
            'applepay_integration_id' => 'nullable|string',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $userId = $request->user()->id;

        $result = DB::select('SELECT upsert_gym_payment_config(?, ?, ?, ?, ?, ?, ?) AS data', [
            $gymId,
            $userId,
            $validated['secret_key'],
            $validated['public_key'],
            $validated['integration_id'],
            $validated['valu_integration_id'] ?? null,
            $validated['applepay_integration_id'] ?? null,
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }
}
