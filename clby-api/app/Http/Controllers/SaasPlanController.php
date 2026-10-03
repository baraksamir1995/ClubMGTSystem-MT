<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SaasPlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = DB::table('saas_tiers')
            ->orderBy('price_monthly')
            ->get();

        return response()->json(['data' => $plans]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price_monthly' => 'required|numeric|min:0',
            'price_annual' => 'required|numeric|min:0',
        ]);

        $id = Str::uuid()->toString();

        DB::table('saas_tiers')->insert([
            'id' => $id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'price_monthly' => $validated['price_monthly'],
            'price_annual' => $validated['price_annual'],
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $plan = DB::table('saas_tiers')->where('id', $id)->first();

        return response()->json(['data' => $plan], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $plan = DB::table('saas_tiers')->where('id', $id)->first();
        if (!$plan) return response()->json(['error' => 'Not found'], 404);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'price_monthly' => 'sometimes|numeric|min:0',
            'price_annual' => 'sometimes|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        $validated['updated_at'] = now();

        DB::table('saas_tiers')->where('id', $id)->update($validated);

        return response()->json(['data' => DB::table('saas_tiers')->where('id', $id)->first()]);
    }

    public function destroy(string $id): JsonResponse
    {
        $plan = DB::table('saas_tiers')->where('id', $id)->first();
        if (!$plan) return response()->json(['error' => 'Not found'], 404);

        // Check if any invoices reference this plan
        $hasInvoices = DB::table('gym_saas_invoices')->where('saas_tier_id', $id)->exists();
        if ($hasInvoices) {
            return response()->json(['error' => 'Cannot delete plan with existing invoices. Deactivate it instead.'], 422);
        }

        DB::table('saas_tiers')->where('id', $id)->delete();

        return response()->json(['message' => 'Plan deleted']);
    }

    // ── Invoices / Payments ──

    public function invoices(Request $request): JsonResponse
    {
        // At most one pending settlement claim per invoice (partial unique
        // index), so this left join never fans out.
        $query = DB::table('gym_saas_invoices as i')
            ->join('gyms as g', 'g.id', '=', 'i.gym_id')
            ->leftJoin('saas_tiers as t', 't.id', '=', 'i.saas_tier_id')
            ->leftJoin('saas_invoice_settlement_requests as r', function ($j) {
                $j->on('r.invoice_id', '=', 'i.id')->where('r.status', '=', 'pending');
            })
            ->leftJoin('profiles as rp', 'rp.id', '=', 'r.requested_by')
            ->select(
                'i.*',
                'g.name as gym_name',
                't.name as plan_name',
                'r.id as settlement_request_id',
                'r.created_at as settlement_requested_at',
                'rp.full_name as settlement_requested_by',
            )
            ->orderBy('i.created_at', 'desc');

        if ($request->query('gym_id')) {
            $query->where('i.gym_id', $request->query('gym_id'));
        }
        if ($request->query('status')) {
            $query->where('i.status', $request->query('status'));
        }

        $invoices = $query->get();

        return response()->json(['data' => $invoices]);
    }

    public function createInvoice(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_id' => 'required|uuid|exists:gyms,id',
            'saas_tier_id' => 'required|uuid|exists:saas_tiers,id',
            'amount' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'billing_period_start' => 'required|date',
            'billing_period_end' => 'required|date|after:billing_period_start',
            'status' => 'nullable|string|in:pending,paid,overdue',
        ]);

        $id = Str::uuid()->toString();

        DB::table('gym_saas_invoices')->insert([
            'id' => $id,
            'gym_id' => $validated['gym_id'],
            'saas_tier_id' => $validated['saas_tier_id'],
            'amount' => $validated['amount'],
            'currency' => $validated['currency'] ?? 'EGP',
            'billing_period_start' => $validated['billing_period_start'],
            'billing_period_end' => $validated['billing_period_end'],
            'status' => $validated['status'] ?? 'pending',
            'paid_at' => ($validated['status'] ?? 'pending') === 'paid' ? now() : null,
            'created_at' => now(),
        ]);

        $invoice = DB::table('gym_saas_invoices as i')
            ->join('gyms as g', 'g.id', '=', 'i.gym_id')
            ->leftJoin('saas_tiers as t', 't.id', '=', 'i.saas_tier_id')
            ->select('i.*', 'g.name as gym_name', 't.name as plan_name')
            ->where('i.id', $id)
            ->first();

        return response()->json(['data' => $invoice], 201);
    }

    public function markPaid(string $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $invoice = DB::table('gym_saas_invoices')->where('id', $id)->lockForUpdate()->first();
            if (!$invoice) return response()->json(['error' => 'Not found'], 404);

            // Guard against a stale tab or second admin: a cancelled invoice
            // must not come back as paid, and re-marking a paid one would
            // silently rewrite its paid_at.
            if ($invoice->status === 'cancelled') {
                return response()->json(['error' => 'A cancelled invoice cannot be marked as paid.'], 422);
            }
            if ($invoice->status === 'paid') {
                return response()->json(['error' => 'This invoice is already paid.'], 409);
            }

            DB::table('gym_saas_invoices')->where('id', $id)->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);
            // Marking paid directly also settles any open claim, so it
            // doesn't linger as a phantom pending review.
            $this->resolveSettlement($id, 'approved');

            return response()->json(['data' => DB::table('gym_saas_invoices')->where('id', $id)->first()]);
        });
    }

    /** Badge count for the super-admin nav: claims waiting on review. */
    public function awaitingCount(): JsonResponse
    {
        $count = DB::table('gym_saas_invoices')->where('status', 'awaiting_confirmation')->count();

        return response()->json(['data' => ['awaiting' => $count]]);
    }

    /**
     * Confirm a gym's "I have paid" claim: the external payment has been
     * received. Invoice → paid, claim → approved, reminder gone for good.
     */
    public function confirmSettlement(string $id): JsonResponse
    {
        return $this->reviewSettlement($id, approve: true);
    }

    /**
     * Reject a gym's claim: invoice returns to the status it had before
     * the claim (pending/overdue) and the dashboard reminder reappears
     * immediately, even if the gym had snoozed it.
     */
    public function rejectSettlement(string $id): JsonResponse
    {
        return $this->reviewSettlement($id, approve: false);
    }

    public function cancelInvoice(string $id): JsonResponse
    {
        return DB::transaction(function () use ($id) {
            $invoice = DB::table('gym_saas_invoices')->where('id', $id)->lockForUpdate()->first();
            if (!$invoice) return response()->json(['error' => 'Not found'], 404);
            if ($invoice->status === 'paid') {
                return response()->json(['error' => 'A paid invoice cannot be cancelled.'], 422);
            }

            DB::table('gym_saas_invoices')->where('id', $id)->update(['status' => 'cancelled']);
            $this->resolveSettlement($id, 'rejected');

            return response()->json(['data' => DB::table('gym_saas_invoices')->where('id', $id)->first()]);
        });
    }

    private function reviewSettlement(string $id, bool $approve): JsonResponse
    {
        return DB::transaction(function () use ($id, $approve) {
            $invoice = DB::table('gym_saas_invoices')->where('id', $id)->lockForUpdate()->first();
            if (!$invoice) return response()->json(['error' => 'Not found'], 404);

            $claim = DB::table('saas_invoice_settlement_requests')
                ->where('invoice_id', $id)
                ->where('status', 'pending')
                ->first();

            if ($invoice->status !== 'awaiting_confirmation' || !$claim) {
                return response()->json(['error' => 'This payment has no settlement confirmation awaiting review.'], 409);
            }

            DB::table('gym_saas_invoices')->where('id', $id)->update($approve
                ? ['status' => 'paid', 'paid_at' => now(), 'reminder_dismissed_until' => null]
                : ['status' => $claim->previous_status ?: 'pending', 'reminder_dismissed_until' => null]);

            $this->resolveSettlement($id, $approve ? 'approved' : 'rejected');

            return response()->json(['data' => DB::table('gym_saas_invoices')->where('id', $id)->first()]);
        });
    }

    private function resolveSettlement(string $invoiceId, string $outcome): void
    {
        DB::table('saas_invoice_settlement_requests')
            ->where('invoice_id', $invoiceId)
            ->where('status', 'pending')
            ->update([
                'status' => $outcome,
                'reviewed_by' => auth()->id(),
                'reviewed_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function deleteInvoice(string $id): JsonResponse
    {
        $invoice = DB::table('gym_saas_invoices')->where('id', $id)->first();
        if (!$invoice) return response()->json(['error' => 'Not found'], 404);

        DB::table('gym_saas_invoices')->where('id', $id)->delete();

        return response()->json(['message' => 'Invoice deleted']);
    }
}
