<?php

namespace App\Http\Controllers\Sales;

use App\Enums\Sales\ActivityOutcome;
use App\Enums\Sales\ActivityType;
use App\Http\Controllers\Controller;
use App\Models\Sales\SalesActivity;
use App\Models\Sales\SalesLead;
use App\Enums\Sales\LeadStage;
use App\Services\Sales\FollowUpCadence;
use App\Services\Sales\SalesAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SalesActivityController extends Controller
{
    public function __construct(private readonly FollowUpCadence $cadence)
    {
    }

    public function store(Request $request, string $leadId): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $lead = $access->scopeLeads(SalesLead::query())->find($leadId);
        if (! $lead) {
            return response()->json(['error' => 'Not found'], 404);
        }
        if (! $access->canWork($lead)) {
            return response()->json(['error' => 'Claim or get assigned this lead to work it.'], 403);
        }
        if ($lead->stage === LeadStage::Converted) {
            return response()->json(['error' => 'Converted leads are read-only.'], 422);
        }
        // Lost leads sit in the nurture pool with no open tasks; logging a
        // no-answer here would let FollowUpCadence recreate the follow-ups
        // markLost cancelled. Reopen the lead before working it.
        if ($lead->stage === LeadStage::Lost) {
            return response()->json(['error' => 'Lead is lost — reopen it first.'], 422);
        }

        $validated = $request->validate([
            'type' => ['required', Rule::enum(ActivityType::class)],
            'outcome' => ['nullable', Rule::enum(ActivityOutcome::class)],
            'notes' => 'nullable|string|max:5000',
        ]);

        $activity = SalesActivity::create([
            'gym_id' => $lead->gym_id,
            'lead_id' => $lead->id,
            'user_id' => $request->user()->id,
            'type' => $validated['type'],
            'outcome' => $validated['outcome'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'created_at' => now(),
        ]);

        $cadence = $this->cadence->apply($lead, $activity, $request->user());

        return response()->json([
            'data' => $activity,
            'lead' => $lead->fresh()->only([
                'id', 'stage', 'contact_attempts', 'first_contacted_at',
            ]),
            'prompt_lost' => $cadence['prompt_lost'],
            'follow_up_tasks_created' => $cadence['tasks_created'],
        ], 201);
    }
}
