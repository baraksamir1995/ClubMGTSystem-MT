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
        $query = DB::table('gym_saas_invoices as i')
            ->join('gyms as g', 'g.id', '=', 'i.gym_id')
            ->leftJoin('saas_tiers as t', 't.id', '=', 'i.saas_tier_id')
            ->select(
                'i.*',
                'g.name as gym_name',
                't.name as plan_name',
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
        $invoice = DB::table('gym_saas_invoices')->where('id', $id)->first();
        if (!$invoice) return response()->json(['error' => 'Not found'], 404);

        DB::table('gym_saas_invoices')->where('id', $id)->update([
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        return response()->json(['data' => DB::table('gym_saas_invoices')->where('id', $id)->first()]);
    }

    public function deleteInvoice(string $id): JsonResponse
    {
        $invoice = DB::table('gym_saas_invoices')->where('id', $id)->first();
        if (!$invoice) return response()->json(['error' => 'Not found'], 404);

        DB::table('gym_saas_invoices')->where('id', $id)->delete();

        return response()->json(['message' => 'Invoice deleted']);
    }
}
