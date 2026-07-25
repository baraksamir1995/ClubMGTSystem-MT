<?php

namespace App\Http\Controllers\Sales;

use App\Enums\Sales\LeadStage;
use App\Enums\Sales\LostReason;
use App\Http\Controllers\Controller;
use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesObjection;
use App\Models\Sales\SalesOffer;
use App\Services\Sales\InvalidTransition;
use App\Services\Sales\LeadPipeline;
use App\Services\Sales\SalesAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SalesOfferController extends Controller
{
    public function __construct(private readonly LeadPipeline $pipeline)
    {
    }

    public function store(Request $request, string $leadId): JsonResponse
    {
        [$lead, $error] = $this->workableLead($request, $leadId);
        if ($error) {
            return $error;
        }

        $validated = $request->validate([
            'plan_id' => 'nullable|uuid',
            'quoted_price' => 'required|numeric|min:0',
            'discount_type' => 'nullable|string|in:percent,fixed,waived_joining_fee,custom',
            'discount_value' => 'nullable|numeric|min:0',
            'valid_until' => 'nullable|date|after_or_equal:today',
            'incentive_notes' => 'nullable|string|max:2000',
        ]);

        if (! empty($validated['plan_id'])) {
            $planOk = DB::table('membership_plans')
                ->where('id', $validated['plan_id'])
                ->where('gym_id', $request->user()->gym_id)
                ->exists();
            if (! $planOk) {
                return response()->json(['error' => 'Plan not found in this gym.'], 422);
            }
        }

        $offer = SalesOffer::create([
            ...$validated,
            'gym_id' => $lead->gym_id,
            'lead_id' => $lead->id,
            'created_by' => $request->user()->id,
        ]);

        // Presenting the first offer moves tour_booked → offer_presented.
        if ($lead->stage === LeadStage::TourBooked) {
            try {
                $this->pipeline->advance($lead, LeadStage::OfferPresented, $request->user(), 'offer presented');
            } catch (InvalidTransition) {
                // keep the offer either way
            }
        }

        return response()->json(['data' => $offer, 'lead_stage' => $lead->fresh()->stage], 201);
    }

    public function updateStatus(Request $request, string $leadId, string $offerId): JsonResponse
    {
        [$lead, $error] = $this->workableLead($request, $leadId);
        if ($error) {
            return $error;
        }

        $offer = SalesOffer::where('lead_id', $lead->id)->find($offerId);
        if (! $offer) {
            return response()->json(['error' => 'Not found'], 404);
        }

        // Acceptance happens exclusively through the convert action.
        $validated = $request->validate([
            'status' => 'required|string|in:open,declined',
        ]);
        $offer->update($validated);

        return response()->json(['data' => $offer->fresh()]);
    }

    public function storeObjection(Request $request, string $leadId): JsonResponse
    {
        [$lead, $error] = $this->workableLead($request, $leadId);
        if ($error) {
            return $error;
        }

        $validated = $request->validate([
            'reason' => ['required', Rule::in(LostReason::objectionValues())],
            'notes' => 'nullable|string|max:2000',
            'offer_id' => 'nullable|uuid',
        ]);

        $objection = SalesObjection::create([
            ...$validated,
            'gym_id' => $lead->gym_id,
            'lead_id' => $lead->id,
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        return response()->json(['data' => $objection], 201);
    }

    /** @return array{0: ?SalesLead, 1: ?JsonResponse} */
    private function workableLead(Request $request, string $leadId): array
    {
        $access = new SalesAccess($request->user());
        $lead = $access->scopeLeads(SalesLead::query())->find($leadId);
        if (! $lead) {
            return [null, response()->json(['error' => 'Not found'], 404)];
        }
        if (! $access->canWork($lead)) {
            return [null, response()->json(['error' => 'Claim or get assigned this lead to work it.'], 403)];
        }
        if ($lead->stage->isTerminal()) {
            return [null, response()->json(['error' => 'Lead is closed.'], 422)];
        }
        return [$lead, null];
    }
}
