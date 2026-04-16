<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QrTokenController extends Controller
{
    private const TTL_SECONDS = 60;

    /**
     * Generate a signed QR token for gym entrance scanning.
     */
    public function generate(Request $request): JsonResponse
    {
        $secret = config('services.qr_token.secret');
        if (! $secret) {
            return response()->json(['error' => 'QR token secret not configured'], 500);
        }

        $user = $request->user();
        $exp = time() + self::TTL_SECONDS;

        $payloadJson = json_encode([
            'sub' => $user->id,
            'gym' => $user->gym_id ?? '',
            'exp' => $exp,
        ]);

        $payload = rtrim(strtr(base64_encode($payloadJson), '+/', '-_'), '=');
        $signature = rtrim(strtr(base64_encode(hash_hmac('sha256', $payload, $secret, true)), '+/', '-_'), '=');

        return response()->json([
            'data' => [
                'token' => "{$payload}.{$signature}",
                'expires_at' => $exp,
            ],
        ]);
    }

    /**
     * Verify a QR token (used by scanner devices / kiosks).
     */
    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $secret = config('services.qr_token.secret');
        if (! $secret) {
            return response()->json(['error' => 'QR token secret not configured'], 500);
        }

        $parts = explode('.', $validated['token']);
        if (count($parts) !== 2) {
            return response()->json(['error' => 'Invalid token format'], 400);
        }

        [$payload, $receivedSig] = $parts;

        $expectedSig = rtrim(strtr(base64_encode(hash_hmac('sha256', $payload, $secret, true)), '+/', '-_'), '=');

        if (! hash_equals($expectedSig, $receivedSig)) {
            return response()->json(['error' => 'Invalid token signature'], 401);
        }

        $payloadJson = base64_decode(strtr($payload, '-_', '+/'));
        $data = json_decode($payloadJson, true);

        if (! $data || ($data['exp'] ?? 0) < time()) {
            return response()->json(['error' => 'Token expired'], 401);
        }

        return response()->json([
            'data' => [
                'valid' => true,
                'user_id' => $data['sub'],
                'gym_id' => $data['gym'],
                'expires_at' => $data['exp'],
            ],
        ]);
    }
}
