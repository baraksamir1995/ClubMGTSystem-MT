<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
use App\Models\GymContractTerms;
use App\Models\Payment;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gym-specific Contract Terms & Conditions.
 *
 * Tenant isolation rule for every endpoint here: the gym_id is derived
 * on the server — from the authenticated user, or from the invoice row
 * being asked about — and is NEVER read from client input. There is
 * deliberately no "?gym_id=" parameter anywhere in this controller, so
 * there is nothing for a hostile client to manipulate.
 */
class ContractTermsController extends Controller
{
    use LogsActivity;
    use ResolvesMemberScope;

    /**
     * Current terms for the authenticated user's gym.
     *
     * Serves both the admin Settings screen and the mobile Profile
     * entry point. Returns 200 with terms=null when the gym has never
     * published any, so the clients can render an empty state rather
     * than treating "not configured" as an error.
     */
    public function show(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => $this->present(GymContractTerms::currentFor($gymId))]);
    }

    /**
     * Publish a new version of the current gym's terms.
     *
     * Append-only: each save inserts the next per-gym version rather than
     * overwriting, so invoices pinned to an older version are untouched.
     */
    public function update(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['error' => 'No gym association found.'], 403);
        }

        $validated = $request->validate([
            'contract_terms_conditions' => 'required|string|max:200000',
        ]);

        $body = trim($validated['contract_terms_conditions']);
        if ($body === '') {
            return response()->json(['error' => 'Terms content cannot be empty.'], 422);
        }

        $userId = $request->user()->id;

        $terms = DB::transaction(function () use ($gymId, $body, $userId) {
            // Serialize concurrent saves for this gym by locking the gym
            // row itself — Postgres rejects FOR UPDATE alongside an
            // aggregate, so we can't lock via max() directly. The unique
            // index on (gym_id, terms_version) is the final backstop.
            DB::table('gyms')->where('id', $gymId)->lockForUpdate()->value('id');

            $currentVersion = (int) DB::table('gym_contract_terms')
                ->where('gym_id', $gymId)
                ->max('terms_version');

            return GymContractTerms::create([
                'gym_id' => $gymId,
                'contract_terms_conditions' => $body,
                'terms_version' => $currentVersion + 1,
                'updated_by' => $userId,
            ]);
        });

        $this->logActivity(
            $gymId,
            $userId,
            'update',
            'settings',
            "Published contract terms v{$terms->terms_version}",
            'contract_terms',
            $terms->id,
            ['terms_version' => $terms->terms_version],
        );

        return response()->json(['data' => $this->present($terms)]);
    }

    /**
     * Full version history for the current gym (admin only).
     */
    public function history(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['data' => []]);
        }

        $rows = DB::table('gym_contract_terms as t')
            ->leftJoin('profiles as p', 'p.id', '=', 't.updated_by')
            ->where('t.gym_id', $gymId)
            ->orderByDesc('t.terms_version')
            ->select('t.id', 't.terms_version', 't.updated_at', 'p.full_name as updated_by_name')
            ->get();

        return response()->json(['data' => $rows]);
    }

    /**
     * Terms applicable to a specific invoice (payment).
     *
     * Scoped to the INVOICE's gym, not the caller's — an invoice always
     * shows the terms of the gym that issued it. Access control is the
     * same rule the invoice detail endpoint uses: admins may read any
     * payment in their own gym; members may only read their own.
     *
     * Where the payment was pinned to a terms version at creation time
     * that exact version is returned, so a historical invoice never
     * shows a contract published after it was issued.
     */
    public function forInvoice(Request $request, string $paymentId): JsonResponse
    {
        $payment = Payment::find($paymentId);
        if (! $payment) {
            return response()->json(['error' => 'Invoice not found'], 404);
        }

        // Tenant gate: the caller must belong to the gym that issued the
        // invoice. Cross-tenant reads are indistinguishable from a
        // missing invoice on purpose (no existence oracle).
        if (! $payment->gym_id || $payment->gym_id !== $request->user()->gym_id) {
            return response()->json(['error' => 'Invoice not found'], 404);
        }

        // Ownership gate: members may only read their own invoices.
        if (! $this->callerIsAdmin($request)) {
            $ownMemberId = $this->callerOwnMemberId($request);
            if (! $ownMemberId || $payment->gym_member_id !== $ownMemberId) {
                return response()->json(['error' => 'Invoice not found'], 404);
            }
        }

        // Pinned version when present, else the gym's current terms.
        $pinned = $payment->contract_terms_id
            ? GymContractTerms::where('id', $payment->contract_terms_id)
                ->where('gym_id', $payment->gym_id)
                ->first()
            : null;

        $terms = $pinned ?? GymContractTerms::currentFor($payment->gym_id);

        return response()->json([
            'data' => $this->present($terms),
            // Tells the client whether it's looking at the exact contract
            // the invoice was issued under, or the gym's latest.
            //
            // Keyed on the resolved row, not on `contract_terms_id` being
            // set: a pinned id that no longer resolves (deleted terms, or a
            // row belonging to another gym) falls back to current terms, and
            // claiming "pinned" there would label newer text as the contract
            // the member actually signed.
            'is_pinned_version' => $pinned !== null,
        ]);
    }

    /**
     * Shared response shape. null → the gym has no terms configured.
     */
    private function present(?GymContractTerms $terms): ?array
    {
        if (! $terms) return null;

        return [
            'id' => $terms->id,
            'gym_id' => $terms->gym_id,
            'contract_terms_conditions' => $terms->contract_terms_conditions,
            'terms_version' => $terms->terms_version,
            'updated_at' => $terms->updated_at?->toIso8601String(),
        ];
    }
}
