<?php

namespace App\Services;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymobService
{
    private const BASE_URL = 'https://accept.paymob.com';

    /**
     * Resolve Paymob credentials for a gym (per-gym config or env fallback).
     * Stored creds are encrypted at rest; we transparently decrypt here.
     */
    public function resolveCredentials(string $gymId): array
    {
        $result = DB::select('SELECT get_gym_payment_creds(?) AS data', [$gymId]);
        $config = json_decode($result[0]->data ?? '{}', true) ?: [];

        $secret = self::tryDecrypt($config['secret_key'] ?? null);
        if ($secret !== null && $secret !== '') {
            return [
                'secret_key' => $secret,
                'public_key' => self::tryDecrypt($config['public_key'] ?? null) ?? '',
                'integration_id' => self::tryDecrypt($config['integration_id'] ?? null) ?? '',
                'valu_integration_id' => self::tryDecrypt($config['valu_integration_id'] ?? null) ?? '',
                'applepay_integration_id' => self::tryDecrypt($config['applepay_integration_id'] ?? null) ?? '',
            ];
        }

        return [
            'secret_key' => config('services.paymob.secret_key', ''),
            'public_key' => config('services.paymob.public_key', ''),
            'integration_id' => config('services.paymob.integration_id', ''),
            'valu_integration_id' => config('services.paymob.valu_integration_id', ''),
            'applepay_integration_id' => config('services.paymob.applepay_integration_id', ''),
        ];
    }

    /**
     * Encrypt a credential value for storage. Empty/null pass through.
     */
    public static function encryptCredential(?string $value): ?string
    {
        if ($value === null || $value === '') return $value;
        return Crypt::encryptString($value);
    }

    /**
     * Decrypt a stored credential. Falls back to the raw value if it was stored
     * unencrypted (legacy rows) so we don't break existing installs.
     */
    public static function tryDecrypt(?string $value): ?string
    {
        if ($value === null || $value === '') return $value;
        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            return $value;
        }
    }

    /**
     * Strip anything resembling an auth token or API key from a logged response body.
     */
    private function redactResponseBody(string $body): string
    {
        $body = preg_replace('/("(?:auth|token|key|secret|api[_-]?key)"\s*:\s*")[^"]*/i', '$1[REDACTED]', $body) ?? $body;
        return mb_substr($body, 0, 500);
    }

    /**
     * Resolve integration ID based on payment method.
     */
    public function resolveIntegrationId(array $creds, string $paymentMethod): int
    {
        return match ($paymentMethod) {
            'valu' => (int) ($creds['valu_integration_id'] ?: $creds['integration_id']),
            'apple_pay' => (int) ($creds['applepay_integration_id'] ?: $creds['integration_id']),
            default => (int) $creds['integration_id'],
        };
    }

    /**
     * Create a Paymob payment intention.
     */
    public function createIntention(array $creds, array $params): array
    {
        $integrationId = $this->resolveIntegrationId($creds, $params['payment_method'] ?? 'card');

        if (! $integrationId) {
            throw new \RuntimeException('Integration ID not configured for method: ' . ($params['payment_method'] ?? 'card'));
        }

        [$firstName, $lastName] = $this->splitName($params['user_name'] ?? 'Gym Member');

        $payload = [
            'amount' => $params['amount_cents'],
            'currency' => $params['currency'] ?? 'EGP',
            'payment_methods' => [$integrationId],
            'items' => [
                [
                    'name' => $params['item_name'] ?? 'Gym Service',
                    'amount' => $params['amount_cents'],
                    'description' => $params['item_type'] ?? 'gym',
                    'quantity' => 1,
                ],
            ],
            'billing_data' => [
                'apartment' => 'NA', 'floor' => 'NA', 'street' => 'NA', 'building' => 'NA',
                'shipping_method' => 'NA', 'postal_code' => 'NA', 'city' => 'NA',
                'country' => 'EG', 'state' => 'NA',
                'first_name' => $firstName, 'last_name' => $lastName,
                'email' => $params['user_email'] ?? 'guest@gymapp.com',
                'phone_number' => $params['user_phone'] ?? '+201000000000',
            ],
            'extras' => [
                'payment_id' => $params['payment_id'],
                'gym_id' => $params['gym_id'],
                'plan_id' => $params['plan_id'] ?? '',
                'member_id' => $params['member_id'] ?? '',
                'item_type' => $params['item_type'] ?? 'unknown',
            ],
            'notification_url' => route('paymob.webhook'),
            'redirection_url' => config('services.paymob.redirect_url', 'https://gymapp.redirect/payment/callback'),
        ];

        $response = Http::withHeaders([
            'Authorization' => "Token {$creds['secret_key']}",
        ])->post(self::BASE_URL . '/v1/intention/', $payload);

        if ($response->failed()) {
            Log::error('Paymob intention error', [
                'status' => $response->status(),
                'body' => $this->redactResponseBody($response->body()),
            ]);
            throw new \RuntimeException('Paymob intention error: ' . $response->status());
        }

        $intention = $response->json();

        return [
            'client_secret' => $intention['client_secret'],
            'checkout_url' => self::BASE_URL . "/unifiedcheckout/?publicKey={$creds['public_key']}&clientSecret={$intention['client_secret']}",
            'public_key' => $creds['public_key'],
        ];
    }

    /**
     * Process a refund via Paymob API.
     */
    public function refund(string $secretKey, string $transactionId, int $amountCents): array
    {
        $response = Http::withHeaders([
            'Authorization' => "Token {$secretKey}",
        ])->post(self::BASE_URL . '/api/acceptance/void_refund/refund', [
            'transaction_id' => (int) $transactionId,
            'amount_cents' => $amountCents,
        ]);

        if ($response->failed()) {
            Log::error('Paymob refund error', [
                'status' => $response->status(),
                'body' => $this->redactResponseBody($response->body()),
            ]);
            throw new \RuntimeException('Paymob refund failed: ' . $response->status());
        }

        return $response->json();
    }

    /**
     * Verify Paymob webhook HMAC signature (SHA-512).
     */
    public function verifyHmac(array $obj, string $receivedHmac): bool
    {
        $hmacSecret = config('services.paymob.hmac_secret');
        if (! $hmacSecret) {
            Log::error('PAYMOB_HMAC_SECRET not configured');
            return false;
        }

        $data = implode('', [
            (string) ($obj['amount_cents'] ?? ''),
            (string) ($obj['created_at'] ?? ''),
            (string) ($obj['currency'] ?? ''),
            (string) ($obj['error_occured'] ?? ''),
            (string) ($obj['has_parent_transaction'] ?? ''),
            (string) ($obj['id'] ?? ''),
            (string) ($obj['integration_id'] ?? ''),
            (string) ($obj['is_3d_secure'] ?? ''),
            (string) ($obj['is_auth'] ?? ''),
            (string) ($obj['is_capture'] ?? ''),
            (string) ($obj['is_refunded'] ?? ''),
            (string) ($obj['is_standalone_payment'] ?? ''),
            (string) ($obj['is_voided'] ?? ''),
            (string) ($obj['order']['id'] ?? ''),
            (string) ($obj['owner'] ?? ''),
            (string) ($obj['pending'] ?? ''),
            (string) ($obj['source_data']['pan'] ?? ''),
            (string) ($obj['source_data']['sub_type'] ?? ''),
            (string) ($obj['source_data']['type'] ?? ''),
            (string) ($obj['success'] ?? ''),
        ]);

        $computed = hash_hmac('sha512', $data, $hmacSecret);

        return hash_equals($computed, $receivedHmac);
    }

    private function splitName(string $name): array
    {
        $parts = explode(' ', $name, 2);
        return [$parts[0], $parts[1] ?? 'Member'];
    }
}
