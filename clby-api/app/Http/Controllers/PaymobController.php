<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Services\PaymobService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymobController extends Controller
{
    public function __construct(
        private PaymobService $paymob,
    ) {}

    /**
     * Create a payment intention (mobile app initiates payment).
     */
    public function intention(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount_cents' => 'required|integer|min:100',
            'currency' => 'nullable|string|max:5',
            'plan_id' => 'required|uuid',
            'member_id' => 'required|uuid',
            'item_type' => 'nullable|string|max:50',
            'item_name' => 'nullable|string|max:255',
            'payment_method' => 'nullable|string|in:card,valu,apple_pay',
            'user_email' => 'nullable|email',
            'user_phone' => 'nullable|string|max:20',
            'user_name' => 'nullable|string|max:255',
            'specialist_name' => 'nullable|string|max:255',
        ]);

        $gymId = $request->user()->gym_id;

        $creds = $this->paymob->resolveCredentials($gymId);
        if (empty($creds['secret_key'])) {
            return response()->json(['error' => 'Payment gateway not configured for this gym'], 500);
        }

        // Pre-create pending payment record
        $payment = Payment::create([
            'gym_id' => $gymId,
            'gym_member_id' => $validated['member_id'],
            'amount' => $validated['amount_cents'] / 100,
            'currency' => $validated['currency'] ?? 'EGP',
            'payment_method' => ($validated['payment_method'] ?? 'card') === 'valu' ? 'valu' : 'card',
            'status' => 'pending',
            'source' => 'mobile_app',
            'service_type' => $validated['item_type'] ?? null,
            'service_name' => $validated['item_name'] ?? null,
            'specialist_name' => $validated['specialist_name'] ?? null,
        ]);

        try {
            $result = $this->paymob->createIntention($creds, [
                ...$validated,
                'gym_id' => $gymId,
                'payment_id' => $payment->id,
            ]);

            return response()->json([
                'data' => [
                    'payment_token' => $result['client_secret'],
                    'checkout_url' => $result['checkout_url'],
                    'public_key' => $result['public_key'],
                    'client_secret' => $result['client_secret'],
                    'payment_id' => $payment->id,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Paymob intention failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Failed to create payment intention'], 502);
        }
    }

    /**
     * Process a refund (admin-initiated).
     */
    public function refund(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payment_id' => 'required|uuid',
            'paymob_transaction_id' => 'required|string',
            'amount_cents' => 'required|integer|min:1',
            'refund_type' => 'required|string|in:full,partial',
            'reason' => 'required|string|max:500',
        ]);

        $gymId = $request->user()->gym_id;

        $creds = $this->paymob->resolveCredentials($gymId);
        if (empty($creds['secret_key'])) {
            return response()->json(['error' => 'Payment gateway not configured'], 500);
        }

        try {
            $paymobData = $this->paymob->refund(
                $creds['secret_key'],
                $validated['paymob_transaction_id'],
                $validated['amount_cents'],
            );

            if (! ($paymobData['success'] ?? false) && ! ($paymobData['pending'] ?? false)) {
                return response()->json(['error' => 'Paymob refund was not approved'], 502);
            }

            $newStatus = $validated['refund_type'] === 'full' ? 'refunded' : 'partial_refund';
            $notes = "{$validated['refund_type']} refund via Paymob (txn #{$paymobData['id']}): {$validated['reason']}";

            Payment::where('id', $validated['payment_id'])
                ->where('gym_id', $gymId)
                ->update(['status' => $newStatus, 'notes' => $notes]);

            return response()->json([
                'data' => [
                    'status' => $newStatus,
                    'paymob_refund_id' => $paymobData['id'],
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Paymob refund failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Refund processing failed'], 502);
        }
    }

    /**
     * Paymob webhook handler (server-to-server, no auth).
     */
    public function webhook(Request $request): JsonResponse
    {
        $hmac = $request->query('hmac', '');
        $payload = $request->all();

        if (($payload['type'] ?? '') !== 'TRANSACTION') {
            return response()->json(['status' => 'ignored']);
        }

        $obj = $payload['obj'] ?? [];

        // Verify HMAC signature
        if (! $this->paymob->verifyHmac($obj, $hmac)) {
            Log::warning('Paymob webhook HMAC mismatch', ['transaction_id' => $obj['id'] ?? null]);
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // Only process successful, non-refunded transactions
        if (! ($obj['success'] ?? false) || ($obj['is_refunded'] ?? false) || ($obj['is_voided'] ?? false)) {
            return response()->json(['status' => 'skipped']);
        }

        $extras = $obj['payment_key_claims']['extra'] ?? $obj['extra'] ?? [];
        $gymId = $extras['gym_id'] ?? null;

        if (! $gymId) {
            Log::error('Paymob webhook missing gym_id', ['extras' => $extras]);
            return response()->json(['status' => 'ok']);
        }

        $paymentId = $extras['payment_id'] ?? null;
        $memberId = $extras['member_id'] ?? null;
        $transactionId = (string) ($obj['id'] ?? '');

        // Idempotency check
        $existing = Payment::where('paymob_transaction_id', $transactionId)->first();
        if ($existing) {
            return response()->json(['status' => 'already_processed']);
        }

        // Strategy A: exact match by payment_id
        $target = null;
        if ($paymentId) {
            $target = Payment::where('id', $paymentId)
                ->where('gym_id', $gymId)
                ->whereNull('paymob_transaction_id')
                ->first();
        }

        // Strategy B: fallback 2-hour window
        if (! $target) {
            $query = Payment::where('gym_id', $gymId)
                ->whereNull('paymob_transaction_id')
                ->where('created_at', '>=', now()->subHours(2))
                ->orderBy('created_at', 'desc');

            if ($memberId) {
                $query->where('gym_member_id', $memberId);
            }

            $target = $query->first();
        }

        if (! $target) {
            Log::error('Paymob webhook: no matching payment', ['gym_id' => $gymId, 'payment_id' => $paymentId]);
            return response()->json(['status' => 'ok']);
        }

        $updates = ['paymob_transaction_id' => $transactionId];
        if ($target->status === 'pending') {
            $updates['status'] = 'paid';
            $updates['paid_at'] = now();
        }

        $target->update($updates);

        // When paid, assign member_number + update membership payment_status
        if (($updates['status'] ?? '') === 'paid' && $target->gym_member_id) {
            $gymMember = DB::table('gym_members')->where('id', $target->gym_member_id)->first();
            if ($gymMember && $gymMember->member_number === null) {
                $maxNumber = DB::table('gym_members')
                    ->where('gym_id', $gymId)
                    ->whereNotNull('member_number')
                    ->max('member_number') ?? 0;
                DB::table('gym_members')
                    ->where('id', $target->gym_member_id)
                    ->update(['member_number' => $maxNumber + 1]);
            }
            if ($target->membership_id) {
                DB::table('member_memberships')
                    ->where('id', $target->membership_id)
                    ->where('payment_status', 'pending')
                    ->update(['payment_status' => 'paid']);
            }
        }

        Log::info('Paymob webhook processed', [
            'transaction_id' => $transactionId,
            'payment_id' => $target->id,
            'gym_id' => $gymId,
        ]);

        return response()->json(['status' => 'ok']);
    }
}
