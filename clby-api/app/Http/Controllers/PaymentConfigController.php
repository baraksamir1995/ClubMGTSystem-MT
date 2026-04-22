<?php

namespace App\Http\Controllers;

use App\Services\PaymobService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentConfigController extends Controller
{
    /**
     * Return masked hints for the gym's Paymob credentials (last 4 chars only).
     * Full secret values never leave the server.
     */
    public function credentials(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => null]);
        }

        $result = DB::select('SELECT get_gym_payment_creds(?) AS data', [$gymId]);
        $config = json_decode($result[0]->data ?? '{}', true) ?: [];

        return response()->json([
            'data' => [
                'has_secret_key' => !empty($config['secret_key']),
                'secret_key_hint' => $this->hint(PaymobService::tryDecrypt($config['secret_key'] ?? null)),
                'public_key' => PaymobService::tryDecrypt($config['public_key'] ?? null) ?? '',
                'integration_id' => PaymobService::tryDecrypt($config['integration_id'] ?? null) ?? '',
                'valu_integration_id' => PaymobService::tryDecrypt($config['valu_integration_id'] ?? null) ?? '',
                'applepay_integration_id' => PaymobService::tryDecrypt($config['applepay_integration_id'] ?? null) ?? '',
                'is_active' => (bool) ($config['is_active'] ?? false),
            ],
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

        DB::select('SELECT upsert_gym_payment_config(?, ?, ?, ?, ?, ?, ?) AS data', [
            $gymId,
            $userId,
            PaymobService::encryptCredential($validated['secret_key']),
            PaymobService::encryptCredential($validated['public_key']),
            PaymobService::encryptCredential($validated['integration_id']),
            PaymobService::encryptCredential($validated['valu_integration_id'] ?? null),
            PaymobService::encryptCredential($validated['applepay_integration_id'] ?? null),
        ]);

        return response()->json([
            'data' => ['updated' => true],
        ]);
    }

    private function hint(?string $value): ?string
    {
        if (!$value || strlen($value) < 4) return null;
        return '••••' . substr($value, -4);
    }
}
