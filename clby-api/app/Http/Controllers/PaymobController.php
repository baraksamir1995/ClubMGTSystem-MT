<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Services\PaymobService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymobController extends Controller
{
    public function __construct(
        private PaymobService $paymob,
    ) {}

    /**
     * Resolve the *true* price (in cents) of a purchasable item from the
     * gym's catalog. Returns null if the item doesn't exist, is deleted,
     * is inactive, or belongs to a different gym.
     *
     * The single defence against a hostile client trying to buy a 1000 EGP
     * plan for 1 EGP — never trust client `amount_cents`.
     *
     * @return array{type: string, name: string, price_cents: int, row: object}|null
     */
    private function resolveCatalogPrice(string $gymId, string $itemId): ?array
    {
        $plan = DB::table('membership_plans')
            ->where('id', $itemId)
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();
        if ($plan) {
            return [
                'type' => 'membership',
                'name' => $plan->name,
                'price_cents' => (int) round((float) $plan->price * 100),
                'row' => $plan,
            ];
        }

        $pkg = DB::table('service_session_packages')
            ->where('id', $itemId)
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();
        if ($pkg && $pkg->price !== null) {
            return [
                'type' => 'service_package',
                'name' => $pkg->name,
                'price_cents' => (int) round((float) $pkg->price * 100),
                'row' => $pkg,
            ];
        }

        return null;
    }

    /**
     * Create a payment intention (mobile app initiates payment).
     */
    public function intention(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // amount_cents is no longer trusted — accepted for backward compat
            // (older mobile builds still send it) but the server derives the
            // real price from plan_id and rejects mismatches.
            'amount_cents' => 'nullable|integer|min:100',
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

        $user = $request->user();
        $gymId = $user->gym_id;

        // AuthZ: the member_id must belong to the authenticated user (same gym, same profile).
        // Admins/staff/trainers may pay on behalf of any member in their gym.
        $isAdmin = in_array($user->role, ['gym_admin', 'staff', 'trainer', 'super_admin']);
        $memberOwnership = DB::table('gym_members')
            ->where('id', $validated['member_id'])
            ->where('gym_id', $gymId)
            ->select('user_id')
            ->first();
        if (! $memberOwnership) {
            return response()->json(['error' => 'Member not found'], 404);
        }
        if (! $isAdmin && $memberOwnership->user_id !== $user->id) {
            Log::warning('Paymob intention: cross-member payment attempt', [
                'actor' => $user->id,
                'target_member' => $validated['member_id'],
                'gym_id' => $gymId,
            ]);
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Server-derived price. The client never sets the amount.
        $catalog = $this->resolveCatalogPrice($gymId, $validated['plan_id']);
        if (! $catalog) {
            Log::warning('Paymob intention: plan/package not found in caller gym', [
                'gym_id' => $gymId,
                'plan_id' => $validated['plan_id'],
                'actor' => $user->id,
            ]);
            return response()->json(['error' => 'Item not available for purchase'], 404);
        }
        $amountCents = $catalog['price_cents'];
        if ($amountCents < 100) {
            return response()->json(['error' => 'Item price is below the minimum chargeable amount'], 422);
        }

        // If the client sent an amount, require it to match (rounding accepted).
        // Tampering or stale price → reject so the client refreshes its catalog.
        if (isset($validated['amount_cents']) && (int) $validated['amount_cents'] !== $amountCents) {
            Log::warning('Paymob intention: client amount mismatch', [
                'gym_id' => $gymId,
                'plan_id' => $validated['plan_id'],
                'client_cents' => (int) $validated['amount_cents'],
                'server_cents' => $amountCents,
                'actor' => $user->id,
            ]);
            return response()->json([
                'error' => 'Price has changed. Please refresh and try again.',
                'code' => 'price_mismatch',
            ], 409);
        }

        $creds = $this->paymob->resolveCredentials($gymId);
        if (empty($creds['secret_key'])) {
            return response()->json(['error' => 'Payment gateway not configured for this gym'], 500);
        }

        // Backfill billing data from the authenticated user's profile so we don't send junk to Paymob.
        $profile = DB::table('profiles')->where('id', $user->id)->first();
        $validated['user_email'] = $validated['user_email'] ?? $profile->email ?? null;
        $validated['user_phone'] = $validated['user_phone'] ?? $profile->phone ?? null;
        $validated['user_name'] = $validated['user_name'] ?? $profile->full_name ?? null;

        // Create the pending entitlement *and* the linked payment row in
        // one transaction. Until now intention() created only a payment
        // row with no membership_id / service_assignment_id, so the
        // webhook had nothing to activate even after marking the payment
        // paid. Mobile then made a separate purchase() call which created
        // a second (orphan) entitlement; that flow is now obsolete (see
        // MembershipController::purchase / purchaseServicePackage —
        // both detect the intention's pending row and return its IDs
        // instead of creating duplicates).
        try {
            [$payment, $entitlementId] = DB::transaction(function () use (
                $validated, $gymId, $catalog, $amountCents
            ) {
                $catRow            = $catalog['row'];
                $membershipId      = null;
                $serviceAssignment = null;
                $entitlementId     = null;

                if ($catalog['type'] === 'membership') {
                    $startDate = now()->toDateString();
                    $expiryDays = $catRow->duration_days ?? $catRow->session_expiry_days ?? null;
                    $endDate = $expiryDays
                        ? date('Y-m-d', strtotime($startDate . " + {$expiryDays} days"))
                        : null;

                    $membershipId = Str::uuid()->toString();
                    $entitlementId = $membershipId;
                    DB::table('member_memberships')->insert([
                        'id' => $membershipId,
                        'gym_member_id' => $validated['member_id'],
                        'plan_id' => $catRow->id,
                        'gym_id' => $gymId,
                        'status' => 'pending',
                        'payment_status' => 'pending',
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'sessions_total' => $catRow->session_count,
                        'sessions_used' => 0,
                        'sessions_remaining' => $catRow->session_count,
                        'original_price' => $amountCents / 100,
                        'discount_amount' => 0,
                        'final_price' => $amountCents / 100,
                        'invitations_remaining' => $catRow->invitations_enabled
                            ? ($catRow->invitations_per_cycle ?? 0)
                            : 0,
                        'source_type' => 'subscription',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                } elseif ($catalog['type'] === 'service_package') {
                    $serviceAssignment = Str::uuid()->toString();
                    $entitlementId = $serviceAssignment;
                    DB::table('member_service_assignments')->insert([
                        'id' => $serviceAssignment,
                        'gym_id' => $gymId,
                        'gym_member_id' => $validated['member_id'],
                        'service_package_id' => $catRow->id,
                        'trainer_id' => null,
                        'trainer_name' => $validated['specialist_name'] ?? null,
                        'package_name' => $catRow->name,
                        'service_type' => $catRow->trainer_type,
                        'sessions_total' => $catRow->session_count,
                        'sessions_used' => 0,
                        'status' => 'pending',
                        'notes' => null,
                        'assigned_at' => now(),
                        'created_at' => now(),
                    ]);
                }

                $payment = Payment::create([
                    'gym_id' => $gymId,
                    'gym_member_id' => $validated['member_id'],
                    'membership_id' => $membershipId,
                    'service_assignment_id' => $serviceAssignment,
                    'amount' => number_format($amountCents / 100, 2, '.', ''),
                    'original_amount' => number_format($amountCents / 100, 2, '.', ''),
                    'currency' => $validated['currency'] ?? 'EGP',
                    'payment_method' => ($validated['payment_method'] ?? 'card') === 'valu' ? 'valu' : 'card',
                    'status' => 'pending',
                    'source' => 'mobile_app',
                    'service_type' => $catalog['type'],
                    'service_name' => $catalog['name'],
                    'specialist_name' => $validated['specialist_name'] ?? null,
                ]);

                return [$payment, $entitlementId];
            });

            $result = $this->paymob->createIntention($creds, [
                ...$validated,
                'amount_cents' => $amountCents,
                'gym_id' => $gymId,
                'payment_id' => $payment->id,
            ]);

            return response()->json([
                'data' => [
                    'payment_token'  => $result['client_secret'],
                    'checkout_url'   => $result['checkout_url'],
                    'public_key'     => $result['public_key'],
                    'client_secret'  => $result['client_secret'],
                    'payment_id'     => $payment->id,
                    'entitlement_id' => $entitlementId,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Paymob intention failed', [
                'error' => $e->getMessage(),
                'gym_id' => $gymId,
                'plan_id' => $validated['plan_id'],
            ]);
            return response()->json(['error' => 'Failed to create payment intention'], 502);
        }
    }

    /**
     * Process a refund (admin-initiated).
     *
     * Accepts the UI's payload shape (refundAmount decimal + refundType) OR the
     * normalized snake_case shape (amount_cents int + refund_type). If the payment
     * has a paymob_transaction_id we call Paymob; otherwise it's a book-keeping-only
     * refund (cash/manual payments).
     */
    public function refund(Request $request): JsonResponse
    {
        // Normalize camelCase from admin UI to snake_case.
        $input = [
            'payment_id' => $request->input('payment_id'),
            'reason' => $request->input('reason'),
            'refund_type' => $request->input('refund_type') ?? $request->input('refundType'),
            'refund_amount' => $request->input('refund_amount') ?? $request->input('refundAmount'),
            'amount_cents' => $request->input('amount_cents'),
        ];

        $validated = validator($input, [
            'payment_id' => 'required|uuid',
            'reason' => 'required|string|max:500',
            'refund_type' => 'required|string|in:full,partial',
            'refund_amount' => 'nullable|numeric|min:0.01',
            'amount_cents' => 'nullable|integer|min:1',
        ])->validate();

        if (empty($validated['amount_cents']) && empty($validated['refund_amount'])) {
            return response()->json(['error' => 'refund_amount or amount_cents is required'], 422);
        }
        $requestedCents = isset($validated['amount_cents'])
            ? (int) $validated['amount_cents']
            : (int) round(((float) $validated['refund_amount']) * 100);

        $gymId = $request->user()->gym_id;

        $payment = Payment::where('id', $validated['payment_id'])
            ->where('gym_id', $gymId)
            ->first();
        if (! $payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }
        if (! in_array($payment->status, ['paid', 'partial_refund'], true)) {
            return response()->json(['error' => "Cannot refund a payment in status '{$payment->status}'"], 422);
        }

        // Cap the refund to what's actually left to refund, and cross-check the type.
        $paidCents = (int) round((float) $payment->amount * 100);
        $alreadyRefundedCents = (int) round((float) ($payment->refunded_amount ?? 0) * 100);
        $remainingCents = $paidCents - $alreadyRefundedCents;

        if ($remainingCents <= 0) {
            return response()->json(['error' => 'Payment is already fully refunded'], 422);
        }
        if ($requestedCents > $remainingCents) {
            return response()->json(['error' => 'Refund amount exceeds remaining balance'], 422);
        }
        if ($validated['refund_type'] === 'full' && $requestedCents !== $remainingCents) {
            return response()->json(['error' => "Full refund must equal the remaining balance"], 422);
        }
        if ($validated['refund_type'] === 'partial' && $requestedCents === $remainingCents) {
            // Not a hard error — treat as full.
            $validated['refund_type'] = 'full';
        }

        $isPaymob = !empty($payment->paymob_transaction_id);
        $paymobRefundId = null;
        $wasPending = false;

        if ($isPaymob) {
            $creds = $this->paymob->resolveCredentials($gymId);
            if (empty($creds['secret_key'])) {
                return response()->json(['error' => 'Payment gateway not configured'], 500);
            }
            try {
                $paymobData = $this->paymob->refund(
                    $creds['secret_key'],
                    $payment->paymob_transaction_id,
                    $requestedCents,
                );
                $succeeded = (bool) ($paymobData['success'] ?? false);
                $wasPending = (bool) ($paymobData['pending'] ?? false);
                if (! $succeeded && ! $wasPending) {
                    return response()->json(['error' => 'Paymob refund was not approved'], 502);
                }
                $paymobRefundId = $paymobData['id'] ?? null;
            } catch (\Throwable $e) {
                Log::error('Paymob refund API failed', ['payment_id' => $payment->id, 'error' => $e->getMessage()]);
                return response()->json(['error' => 'Refund processing failed'], 502);
            }
        }

        $newStatus = $validated['refund_type'] === 'full' ? 'refunded' : 'partial_refund';
        $newRefundedCents = $alreadyRefundedCents + $requestedCents;
        $displayAmount = number_format($requestedCents / 100, 2, '.', '');

        $channel = $isPaymob ? 'Paymob' : 'manual';
        $pendingTag = $wasPending ? ' [pending]' : '';
        $txnTag = $paymobRefundId ? " (refund #{$paymobRefundId})" : '';
        $newNote = "[refund {$channel}{$pendingTag} {$displayAmount} {$payment->currency}{$txnTag}] " . $validated['reason'];
        $appendedNotes = trim(($payment->notes ? $payment->notes . "\n" : '') . $newNote);

        DB::transaction(function () use ($payment, $newStatus, $newRefundedCents, $appendedNotes) {
            $payment->update([
                'status' => $newStatus,
                'refunded_amount' => number_format($newRefundedCents / 100, 2, '.', ''),
                'refunded_at' => now(),
                'notes' => $appendedNotes,
            ]);
        });

        return response()->json([
            'data' => [
                'status' => $newStatus,
                'refunded_amount' => number_format($newRefundedCents / 100, 2, '.', ''),
                'channel' => $channel,
                'paymob_refund_id' => $paymobRefundId,
                'pending' => $wasPending,
            ],
        ]);
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

        // Verify HMAC signature (SHA-512) — rejects forged or tampered callbacks.
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
            Log::error('Paymob webhook missing gym_id', ['txn_id' => $obj['id'] ?? null]);
            return response()->json(['status' => 'ok']);
        }

        $paymentId = $extras['payment_id'] ?? null;
        $transactionId = (string) ($obj['id'] ?? '');
        $reportedCents = isset($obj['amount_cents']) ? (int) $obj['amount_cents'] : null;
        $reportedCurrency = strtoupper((string) ($obj['currency'] ?? ''));

        // Idempotency: bail if this transaction was already processed.
        if (Payment::where('paymob_transaction_id', $transactionId)->exists()) {
            return response()->json(['status' => 'already_processed']);
        }

        // Require explicit payment_id from our own `extras` — no fallback matching.
        // This is what we set in PaymobService::createIntention; any legit callback has it.
        if (! $paymentId) {
            Log::warning('Paymob webhook missing payment_id in extras', ['txn_id' => $transactionId, 'gym_id' => $gymId]);
            return response()->json(['status' => 'ok']);
        }

        $target = Payment::where('id', $paymentId)
            ->where('gym_id', $gymId)
            ->whereNull('paymob_transaction_id')
            ->first();

        if (! $target) {
            Log::error('Paymob webhook: no matching payment', ['gym_id' => $gymId, 'payment_id' => $paymentId, 'txn_id' => $transactionId]);
            return response()->json(['status' => 'ok']);
        }

        // Amount tampering guard: the amount Paymob reports must match what we recorded at intention time.
        $expectedCents = (int) round((float) $target->amount * 100);
        if ($reportedCents !== null && $reportedCents !== $expectedCents) {
            Log::critical('Paymob webhook amount mismatch', [
                'payment_id' => $target->id,
                'expected_cents' => $expectedCents,
                'reported_cents' => $reportedCents,
                'txn_id' => $transactionId,
            ]);
            return response()->json(['error' => 'Amount mismatch'], 422);
        }
        if ($reportedCurrency !== '' && strtoupper((string) $target->currency) !== $reportedCurrency) {
            Log::critical('Paymob webhook currency mismatch', [
                'payment_id' => $target->id,
                'expected' => $target->currency,
                'reported' => $reportedCurrency,
                'txn_id' => $transactionId,
            ]);
            return response()->json(['error' => 'Currency mismatch'], 422);
        }

        // Atomically mark paid + activate the linked entitlement
        // (membership and/or service assignment).
        DB::transaction(function () use ($target, $transactionId, $gymId) {
            $updates = ['paymob_transaction_id' => $transactionId];
            $becameP = false;
            if ($target->status === 'pending') {
                $updates['status'] = 'paid';
                $updates['paid_at'] = now();
                $becameP = true;
            }
            $target->update($updates);

            if (! $becameP || ! $target->gym_member_id) return;

            // Assign next member_number on first paid purchase.
            $gymMember = DB::table('gym_members')->where('id', $target->gym_member_id)->lockForUpdate()->first();
            if ($gymMember && $gymMember->member_number === null) {
                DB::select('SELECT pg_advisory_xact_lock(?)', [crc32((string) $gymId)]);
                $maxNumber = DB::table('gym_members')
                    ->where('gym_id', $gymId)
                    ->whereNotNull('member_number')
                    ->max('member_number') ?? 0;
                DB::table('gym_members')
                    ->where('id', $target->gym_member_id)
                    ->update(['member_number' => $maxNumber + 1]);
            }

            // Activate the membership entitlement (if any).
            if ($target->membership_id) {
                $newMembership = DB::table('member_memberships')
                    ->where('id', $target->membership_id)
                    ->first();

                if ($newMembership) {
                    // Displace any other active subscription for this
                    // member — but only at activation time, not at
                    // intent. This prevents an unconfirmed pending
                    // purchase from cancelling a paid membership.
                    DB::table('member_memberships')
                        ->where('gym_member_id', $newMembership->gym_member_id)
                        ->where('status', 'active')
                        ->where('source_type', 'subscription')
                        ->where('id', '!=', $newMembership->id)
                        ->update(['status' => 'expired', 'updated_at' => now()]);

                    DB::table('member_memberships')
                        ->where('id', $target->membership_id)
                        ->update([
                            'status' => 'active',
                            'payment_status' => 'paid',
                            'updated_at' => now(),
                        ]);

                    DB::table('gym_members')
                        ->where('id', $target->gym_member_id)
                        ->where('status', '!=', 'active')
                        ->update(['status' => 'active', 'updated_at' => now()]);
                }
            }

            // Activate the service-package assignment (if any).
            if ($target->service_assignment_id) {
                DB::table('member_service_assignments')
                    ->where('id', $target->service_assignment_id)
                    ->where('status', 'pending')
                    ->update([
                        'status' => 'active',
                    ]);
            }
        });

        Log::info('Paymob webhook processed', [
            'transaction_id' => $transactionId,
            'payment_id' => $target->id,
            'gym_id' => $gymId,
        ]);

        return response()->json(['status' => 'ok']);
    }
}
