<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Tenant side of the SaaS pending-payment reminder.
 *
 * The gym dashboard shows one yellow banner per outstanding platform
 * invoice. From it the gym owner can claim "I have paid" (which only
 * *requests* confirmation — see SaasPlanController::confirmSettlement) or
 * snooze the banner for 24 hours.
 *
 * Owner-only: these are the gym's bills to the platform, not something
 * staff or trainers should see or act on. Every query is scoped to the
 * caller's own gym_id; another gym's invoice id 404s rather than 403s so
 * existence can't be probed.
 *
 * Responses deliberately carry no amount or currency.
 */
class BillingReminderController extends Controller
{
    /** Invoice statuses that count as "still owed" and raise a reminder. */
    private const OUTSTANDING = ['pending', 'overdue'];

    private const SNOOZE_HOURS = 24;

    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->denyUnlessOwner($request)) return $denied;

        $reminders = DB::table('gym_saas_invoices')
            ->where('gym_id', $request->user()->gym_id)
            ->whereIn('status', self::OUTSTANDING)
            ->where(function ($q) {
                $q->whereNull('reminder_dismissed_until')
                  ->orWhere('reminder_dismissed_until', '<=', now());
            })
            ->orderBy('billing_period_start')
            ->get(['id', 'status', 'billing_period_start', 'billing_period_end'])
            // ISO-8601 so every browser's Date parser accepts it (Safari
            // rejects Postgres's "2026-10-01 00:00:00+03").
            ->map(fn ($r) => [
                'id' => $r->id,
                'status' => $r->status,
                'billing_period_start' => $r->billing_period_start ? Carbon::parse($r->billing_period_start)->toIso8601String() : null,
                'billing_period_end' => $r->billing_period_end ? Carbon::parse($r->billing_period_end)->toIso8601String() : null,
            ]);

        return response()->json(['data' => $reminders]);
    }

    /**
     * "I have paid": open a settlement claim for super-admin review and
     * park the invoice in awaiting_confirmation. Never marks it paid.
     */
    public function settle(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->denyUnlessOwner($request)) return $denied;

        $user = $request->user();

        return DB::transaction(function () use ($user, $id) {
            $invoice = DB::table('gym_saas_invoices')
                ->where('id', $id)
                ->where('gym_id', $user->gym_id)
                ->lockForUpdate()
                ->first();

            if (!$invoice) {
                return response()->json(['error' => 'Not found'], 404);
            }

            // Covers the duplicate case too: once a claim is open the
            // invoice is awaiting_confirmation, not outstanding.
            if (!in_array($invoice->status, self::OUTSTANDING, true)) {
                return response()->json([
                    'error' => $invoice->status === 'awaiting_confirmation'
                        ? 'A settlement confirmation is already awaiting review.'
                        : 'This payment is no longer outstanding.',
                ], 409);
            }

            DB::table('saas_invoice_settlement_requests')->insert([
                'id' => (string) Str::uuid(),
                'invoice_id' => $invoice->id,
                'gym_id' => $invoice->gym_id,
                'requested_by' => $user->id,
                'status' => 'pending',
                'previous_status' => $invoice->status,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('gym_saas_invoices')->where('id', $invoice->id)->update([
                'status' => 'awaiting_confirmation',
            ]);

            return response()->json(['data' => ['id' => $invoice->id, 'status' => 'awaiting_confirmation']]);
        });
    }

    /**
     * Snooze the banner for this one invoice. Status is untouched and the
     * super-admin is not notified. Re-dismissing restarts the window.
     */
    public function dismiss(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->denyUnlessOwner($request)) return $denied;

        $until = now()->addHours(self::SNOOZE_HOURS);

        $updated = DB::table('gym_saas_invoices')
            ->where('id', $id)
            ->where('gym_id', $request->user()->gym_id)
            ->whereIn('status', self::OUTSTANDING)
            ->update(['reminder_dismissed_until' => $until]);

        if (!$updated) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json(['data' => ['id' => $id, 'reminder_dismissed_until' => $until->toIso8601String()]]);
    }

    private function denyUnlessOwner(Request $request): ?JsonResponse
    {
        return $request->user()->role === 'gym_admin'
            ? null
            : response()->json(['error' => 'Forbidden'], 403);
    }
}
