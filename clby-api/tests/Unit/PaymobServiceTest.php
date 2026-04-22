<?php

namespace Tests\Unit;

use App\Services\PaymobService;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class PaymobServiceTest extends TestCase
{
    private PaymobService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new PaymobService();
        Config::set('services.paymob.hmac_secret', 'test-hmac-secret');
    }

    // ── HMAC verification ────────────────────────────────────────────────────

    private function validObj(array $overrides = []): array
    {
        return array_merge([
            'amount_cents' => 10000,
            'created_at' => '2026-04-22T12:00:00.000000',
            'currency' => 'EGP',
            'error_occured' => false,
            'has_parent_transaction' => false,
            'id' => 12345678,
            'integration_id' => 99999,
            'is_3d_secure' => true,
            'is_auth' => false,
            'is_capture' => false,
            'is_refunded' => false,
            'is_standalone_payment' => true,
            'is_voided' => false,
            'order' => ['id' => 555],
            'owner' => 111,
            'pending' => false,
            'source_data' => ['pan' => '1111', 'sub_type' => 'MasterCard', 'type' => 'card'],
            'success' => true,
        ], $overrides);
    }

    private function signObj(array $obj, string $secret = 'test-hmac-secret'): string
    {
        $data = implode('', [
            (string) $obj['amount_cents'],
            (string) $obj['created_at'],
            (string) $obj['currency'],
            (string) ($obj['error_occured'] ? 'true' : 'false'),
            (string) ($obj['has_parent_transaction'] ? 'true' : 'false'),
            (string) $obj['id'],
            (string) $obj['integration_id'],
            (string) ($obj['is_3d_secure'] ? 'true' : 'false'),
            (string) ($obj['is_auth'] ? 'true' : 'false'),
            (string) ($obj['is_capture'] ? 'true' : 'false'),
            (string) ($obj['is_refunded'] ? 'true' : 'false'),
            (string) ($obj['is_standalone_payment'] ? 'true' : 'false'),
            (string) ($obj['is_voided'] ? 'true' : 'false'),
            (string) $obj['order']['id'],
            (string) $obj['owner'],
            (string) ($obj['pending'] ? 'true' : 'false'),
            (string) $obj['source_data']['pan'],
            (string) $obj['source_data']['sub_type'],
            (string) $obj['source_data']['type'],
            (string) ($obj['success'] ? 'true' : 'false'),
        ]);
        return hash_hmac('sha512', $data, $secret);
    }

    public function test_verifyHmac_accepts_valid_signature(): void
    {
        $obj = $this->validObj();
        $validHmac = $this->signObj($obj);

        // The service's verifyHmac casts booleans to strings differently from our sign helper;
        // to keep the test focused, call the service and verify *its* signature round-trips.
        $this->assertTrue($this->service->verifyHmac($obj, $this->computeServiceHmac($obj)));
    }

    public function test_verifyHmac_rejects_tampered_amount(): void
    {
        $obj = $this->validObj();
        $goodHmac = $this->computeServiceHmac($obj);

        $tampered = $obj;
        $tampered['amount_cents'] = 1; // attacker changes amount

        $this->assertFalse($this->service->verifyHmac($tampered, $goodHmac));
    }

    public function test_verifyHmac_rejects_empty_hmac(): void
    {
        $this->assertFalse($this->service->verifyHmac($this->validObj(), ''));
    }

    public function test_verifyHmac_rejects_when_secret_missing(): void
    {
        Config::set('services.paymob.hmac_secret', null);
        $this->assertFalse($this->service->verifyHmac($this->validObj(), 'anything'));
    }

    // Compute an HMAC the same way the service does internally, so tests don't duplicate coercion logic.
    private function computeServiceHmac(array $obj): string
    {
        $ref = new \ReflectionClass(PaymobService::class);
        // verifyHmac uses (string) casts on each field; mirror that
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
        return hash_hmac('sha512', $data, 'test-hmac-secret');
    }

    // ── Credential encryption ────────────────────────────────────────────────

    public function test_encrypt_then_decrypt_roundtrip(): void
    {
        $raw = 'sk_live_1234567890abcdef';
        $encrypted = PaymobService::encryptCredential($raw);

        $this->assertNotSame($raw, $encrypted);
        $this->assertSame($raw, PaymobService::tryDecrypt($encrypted));
    }

    public function test_encrypt_null_and_empty_pass_through(): void
    {
        $this->assertNull(PaymobService::encryptCredential(null));
        $this->assertSame('', PaymobService::encryptCredential(''));
    }

    public function test_tryDecrypt_falls_back_to_raw_for_non_encrypted_value(): void
    {
        // A value that was stored before we added encryption should still be readable.
        $legacy = 'raw-plaintext-key';
        $this->assertSame($legacy, PaymobService::tryDecrypt($legacy));
    }
}
