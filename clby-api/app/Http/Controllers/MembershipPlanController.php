<?php

namespace App\Http\Controllers;

use App\Models\MembershipPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use \App\Traits\LogsActivity;

class MembershipPlanController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $query = MembershipPlan::where('gym_id', $gymId)
            ->whereNull('deleted_at');

        // Public consumers (mobile explore) want only active plans. Admin
        // dashboards may pass include_inactive=true to see all.
        if ($request->query('include_inactive') !== 'true') {
            $query->where('is_active', true);
        }

        if ($planType = $request->query('plan_type')) {
            $query->where('plan_type', $planType);
        }
        if ($request->query('exclude_sessions') === 'true') {
            $query->where('plan_type', '!=', 'sessions');
        }

        $query->orderBy('created_at', 'desc');

        // Opt-in server pagination: if per_page is present, paginate and
        // return meta. Otherwise preserve legacy behaviour (full list).
        $perPage = $request->query('per_page');
        if ($perPage !== null && $perPage !== '') {
            $perPage = max(1, min((int) $perPage, 100));
            $paginated = $query->paginate($perPage);
            return response()->json([
                'data' => $paginated->items(),
                'meta' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ]);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'plan_type' => 'sometimes|string',
            'duration_days' => 'nullable|integer|min:1',
            'max_visits' => 'nullable|integer|min:1',
            'price' => 'required|numeric|min:0',
            'currency' => 'sometimes|string|max:5',
            'session_count' => 'nullable|integer|min:1',
            'session_expiry_days' => 'nullable|integer|min:1',
            'description' => 'nullable|string',
            'billing_cycle' => 'sometimes|string',
            'invitations_enabled' => 'sometimes|boolean',
            'invitations_per_cycle' => 'nullable|integer',
            'invitation_duration_type' => 'nullable|string',
            'invitation_duration_days' => 'nullable|integer',
            'invitation_validity_days' => 'nullable|integer',
            'freeze_enabled' => 'sometimes|boolean',
            'freeze_max_days' => 'nullable|integer',
            'freeze_max_count' => 'nullable|integer',
            'discount_pct' => 'nullable|numeric|min:0',
            'visits_per_week' => 'nullable|integer',
            'visits_per_month' => 'nullable|integer',
            'trainer_type' => 'nullable|string',
            'access_scope' => 'sometimes|string',
            'allowed_branch_ids' => 'nullable|array',
            'facilities' => 'nullable|array',
            'add_ons' => 'nullable|array',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;
        $plan = MembershipPlan::create($validated);

        return response()->json(['data' => $plan], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $plan = MembershipPlan::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'plan_type' => 'sometimes|string',
            'duration_days' => 'nullable|integer|min:1',
            'max_visits' => 'nullable|integer|min:1',
            'price' => 'sometimes|numeric|min:0',
            'currency' => 'sometimes|string|max:5',
            'session_count' => 'nullable|integer',
            'session_expiry_days' => 'nullable|integer|min:1',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
            'billing_cycle' => 'sometimes|string',
            'invitations_enabled' => 'sometimes|boolean',
            'invitations_per_cycle' => 'nullable|integer',
            'invitation_duration_type' => 'nullable|string',
            'invitation_duration_days' => 'nullable|integer',
            'invitation_validity_days' => 'nullable|integer',
            'freeze_enabled' => 'sometimes|boolean',
            'freeze_max_days' => 'nullable|integer',
            'freeze_max_count' => 'nullable|integer',
            'discount_pct' => 'nullable|numeric|min:0',
            'visits_per_week' => 'nullable|integer',
            'visits_per_month' => 'nullable|integer',
            'trainer_type' => 'nullable|string',
            'access_scope' => 'sometimes|string',
            'allowed_branch_ids' => 'nullable|array',
            'facilities' => 'nullable|array',
            'add_ons' => 'nullable|array',
        ]);

        $plan->update($validated);
        return response()->json(['data' => $plan]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $plan = MembershipPlan::where('gym_id', $gymId)->findOrFail($id);
        $plan->update(['deleted_at' => now()]);
        return response()->json(['message' => 'Plan deleted']);
    }
}
