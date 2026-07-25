<?php

namespace App\Http\Controllers\Sales;

use App\Enums\Sales\LeadScore;
use App\Enums\Sales\LeadStage;
use App\Enums\Sales\LostReason;
use App\Http\Controllers\Controller;
use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesLeadSource;
use App\Models\Sales\SalesLeadStageHistory;
use App\Models\Sales\SalesSetting;
use App\Services\Sales\InvalidTransition;
use App\Services\Sales\LeadPipeline;
use App\Services\Sales\SalesAccess;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SalesLeadController extends Controller
{
    public function __construct(private readonly LeadPipeline $pipeline)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $settings = SalesSetting::forGym($request->user()->gym_id);

        $query = $access->scopeLeads(SalesLead::query())->with(['source:id,name', 'branch:id,name']);

        foreach (['stage', 'score', 'source_id', 'branch_id', 'assigned_to'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        if ($request->boolean('unassigned')) {
            $query->whereNull('assigned_to');
        }
        if ($request->boolean('nurture')) {
            $query->where('stage', LeadStage::Lost->value);
        }
        if ($request->filled('q')) {
            // ILIKE on the bare columns so the pg_trgm GIN indexes
            // (idx_sales_leads_{name,phone,email}_trgm) can serve the
            // leading-wildcard search. `%` and `_` in the term are escaped
            // so they match literally. On sqlite (tests) the grammar maps
            // ilike → case-insensitive like.
            $term = addcslashes($request->query('q'), '%_\\');
            $like = "%{$term}%";
            $query->where(function ($w) use ($like) {
                $w->where('name', 'ilike', $like)
                  ->orWhere('phone', 'ilike', $like)
                  ->orWhere('email', 'ilike', $like);
            });
        }

        $sort = in_array($request->query('sort'), ['created_at', 'updated_at', 'name', 'score'], true)
            ? $request->query('sort') : 'created_at';
        $query->orderBy($sort, $request->query('dir') === 'asc' ? 'asc' : 'desc');

        $page = $query->paginate(min((int) $request->query('per_page', 25), 100));

        $now = now();
        $items = collect($page->items())->map(function (SalesLead $lead) use ($settings, $now) {
            $arr = $lead->toArray();
            $arr['flags'] = [
                'unassigned_sla_breach' => $lead->assigned_to === null
                    && ! $lead->stage->isTerminal()
                    && $lead->created_at->diffInMinutes($now) > $settings->unassigned_sla_minutes,
                'uncontacted' => $lead->first_contacted_at === null
                    && ! $lead->stage->isTerminal()
                    && $lead->created_at->diffInMinutes($now) > $settings->first_contact_minutes,
                'unqualified_sla_breach' => $lead->stage === LeadStage::NewLead
                    && $lead->created_at->diffInHours($now) > $settings->qualify_sla_hours,
            ];
            $arr['speed_to_lead_minutes'] = $lead->first_contacted_at
                ? (int) $lead->created_at->diffInMinutes($lead->first_contacted_at)
                : null;
            return $arr;
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'total' => $page->total(),
                'per_page' => $page->perPage(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:30',
            'email' => 'nullable|email|max:255',
            'source_id' => 'nullable|uuid',
            'branch_id' => 'nullable|uuid',
            'interest' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:5000',
            'utm_source' => 'nullable|string|max:255',
            'utm_medium' => 'nullable|string|max:255',
            'utm_campaign' => 'nullable|string|max:255',
            'assign_to_me' => 'sometimes|boolean',
            'force' => 'sometimes|boolean', // create despite duplicate warning
        ]);

        $phone = Phone::toE164($validated['phone']);
        if (! $phone) {
            return response()->json(['errors' => ['phone' => ['Invalid phone number.']]], 422);
        }

        if ($ref = $this->rejectForeignRefs($user->gym_id, $validated)) {
            return $ref;
        }

        // Duplicate detection: same phone or email in this gym (any stage,
        // soft-deleted excluded). 409 lets the UI offer view/merge.
        if (! ($validated['force'] ?? false)) {
            $dupe = SalesLead::where('gym_id', $user->gym_id)
                ->where(function ($q) use ($phone, $validated) {
                    $q->where('phone', $phone);
                    if (! empty($validated['email'])) {
                        $q->orWhereRaw('LOWER(email) = ?', [strtolower($validated['email'])]);
                    }
                })
                ->first();
            if ($dupe) {
                return response()->json([
                    'error' => 'duplicate',
                    'existing_lead' => $dupe->only(['id', 'name', 'phone', 'email', 'stage', 'assigned_to', 'created_at']),
                ], 409);
            }
        }

        $source = isset($validated['source_id'])
            ? SalesLeadSource::where('gym_id', $user->gym_id)->find($validated['source_id'])
            : null;

        $lead = DB::transaction(function () use ($user, $validated, $phone, $source) {
            $lead = SalesLead::create([
                ...collect($validated)->except(['phone', 'force', 'assign_to_me'])->all(),
                'gym_id' => $user->gym_id,
                'phone' => $phone,
                'stage' => LeadStage::NewLead,
                'score' => $source?->default_score,
                'assigned_to' => ($validated['assign_to_me'] ?? false) ? $user->id : null,
                'claimed_at' => ($validated['assign_to_me'] ?? false) ? now() : null,
                'created_by' => $user->id,
            ]);
            SalesLeadStageHistory::create([
                'lead_id' => $lead->id, 'from_stage' => null,
                'to_stage' => LeadStage::NewLead->value,
                'changed_by' => $user->id, 'reason' => 'created',
                'created_at' => now(),
            ]);
            return $lead;
        });

        return response()->json(['data' => $lead], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $lead = $this->findVisible($request, $id);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $lead->load([
            'source:id,name', 'branch:id,name', 'stageHistory',
            'activities', 'appointments', 'offers', 'objections',
            'tasks' => fn ($q) => $q->orderBy('due_at'),
        ]);

        return response()->json(['data' => $lead]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $lead = $this->findWorkable($request, $id);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:30',
            'email' => 'nullable|email|max:255',
            'source_id' => 'nullable|uuid',
            'branch_id' => 'nullable|uuid',
            'interest' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:5000',
            'score' => ['sometimes', Rule::enum(LeadScore::class)],
            // Qualification checklist
            'interest_level' => 'nullable|string|in:high,medium,low',
            'location_fit' => 'nullable|string|in:good,acceptable,poor',
            'fitness_goal' => 'nullable|string|in:weight_loss,muscle_gain,general_fitness,classes,pt,rehab',
            'budget_range' => 'nullable|string|max:50',
            'join_timeframe' => 'nullable|string|in:immediately,this_month,1_3_months,later',
        ]);

        if (isset($validated['phone'])) {
            $phone = Phone::toE164($validated['phone']);
            if (! $phone) {
                return response()->json(['errors' => ['phone' => ['Invalid phone number.']]], 422);
            }
            $validated['phone'] = $phone;
        }

        if ($ref = $this->rejectForeignRefs($lead->gym_id, $validated)) {
            return $ref;
        }

        $lead->update($validated);
        return response()->json(['data' => $lead->fresh()]);
    }

    /** Rep claims an unassigned lead from the queue (atomic — first claim wins). */
    public function claim(Request $request, string $id): JsonResponse
    {
        $lead = $this->findVisible($request, $id);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $claimed = SalesLead::whereKey($lead->id)->whereNull('assigned_to')
            ->update(['assigned_to' => $request->user()->id, 'claimed_at' => now()]);

        if (! $claimed) {
            return response()->json(['error' => 'Lead is already assigned.'], 409);
        }
        return response()->json(['data' => $lead->fresh()]);
    }

    /** Manager assigns / reassigns a lead to a rep. */
    public function assign(Request $request, string $id): JsonResponse
    {
        $access = new SalesAccess($request->user());
        if (! $access->isManager) {
            return response()->json(['error' => 'Only managers can assign leads.'], 403);
        }

        $lead = $this->findVisible($request, $id);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $validated = $request->validate(['assigned_to' => 'nullable|uuid']);
        // `nullable` doesn't backfill an absent key — omitting assigned_to
        // is the documented "unassign" shape, so default it explicitly.
        $assignedTo = $validated['assigned_to'] ?? null;

        if ($assignedTo !== null) {
            $isStaff = DB::table('staff_members')
                ->where('user_id', $assignedTo)
                ->where('gym_id', $request->user()->gym_id)
                ->where('status', 'active')->whereNull('deleted_at')
                ->exists();
            $isAdmin = DB::table('profiles')
                ->where('id', $assignedTo)
                ->where('gym_id', $request->user()->gym_id)
                ->where('role', 'gym_admin')
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->exists();
            if (! $isStaff && ! $isAdmin) {
                return response()->json(['error' => 'Assignee is not active staff in this gym.'], 422);
            }
        }

        $lead->update([
            'assigned_to' => $assignedTo,
            'claimed_at' => $assignedTo ? now() : null,
        ]);
        return response()->json(['data' => $lead->fresh()]);
    }

    public function transition(Request $request, string $id): JsonResponse
    {
        $lead = $this->findWorkable($request, $id);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $validated = $request->validate([
            'to' => ['required', Rule::enum(LeadStage::class)],
            'reason' => 'nullable|string|max:1000',
        ]);

        try {
            $this->pipeline->advance($lead, LeadStage::from($validated['to']), $request->user(), $validated['reason'] ?? null);
        } catch (InvalidTransition $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
        return response()->json(['data' => $lead->fresh()]);
    }

    public function markLost(Request $request, string $id): JsonResponse
    {
        $lead = $this->findWorkable($request, $id);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $validated = $request->validate([
            'reason' => ['required', Rule::enum(LostReason::class)],
            'notes' => 'nullable|string|max:2000',
            'reengage_at' => 'nullable|date|after:today',
        ]);

        try {
            $this->pipeline->markLost($lead, $validated['reason'], $request->user(), $validated['notes'] ?? null, $validated['reengage_at'] ?? null);
        } catch (InvalidTransition $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
        return response()->json(['data' => $lead->fresh()]);
    }

    public function reopen(Request $request, string $id): JsonResponse
    {
        $lead = $this->findWorkable($request, $id, allowLost: true);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        try {
            $this->pipeline->reopen($lead, $request->user(), $request->input('reason'));
        } catch (InvalidTransition $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
        return response()->json(['data' => $lead->fresh()]);
    }

    public function convert(Request $request, string $id): JsonResponse
    {
        $lead = $this->findWorkable($request, $id);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $validated = $request->validate([
            'offer_id' => 'required|uuid',
            'payment_method' => 'required|string|in:cash,card,instapay,bank_transfer,other',
            'final_price' => 'required|numeric|min:0',
            'start_date' => 'required|date',
            'agreement_ref' => 'nullable|string|max:100',
            'member_id' => 'nullable|uuid', // existing gym_members.id to link
        ]);

        if (! empty($validated['member_id'])) {
            $memberOk = DB::table('gym_members')
                ->where('id', $validated['member_id'])
                ->where('gym_id', $request->user()->gym_id)
                ->exists();
            if (! $memberOk) {
                return response()->json(['error' => 'Member not found in this gym.'], 422);
            }
        }

        try {
            $this->pipeline->convert($lead, $validated, $request->user());
        } catch (InvalidTransition $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
        return response()->json(['data' => $lead->fresh()->load('tasks')]);
    }

    /* ── helpers ──────────────────────────────────────────────────── */

    /**
     * Reject source_id / branch_id that belong to another gym (the uuid
     * validation rule only checks format, and neither column has an FK).
     * Returns a 422 JsonResponse on mismatch, or null when clean.
     */
    private function rejectForeignRefs(string $gymId, array $validated): ?JsonResponse
    {
        $errors = [];
        if (! empty($validated['source_id'])) {
            $ok = SalesLeadSource::where('gym_id', $gymId)->whereKey($validated['source_id'])->exists();
            if (! $ok) {
                $errors['source_id'] = ['Unknown lead source for this gym.'];
            }
        }
        if (! empty($validated['branch_id'])) {
            $ok = DB::table('branches')->where('gym_id', $gymId)->where('id', $validated['branch_id'])->exists();
            if (! $ok) {
                $errors['branch_id'] = ['Unknown branch for this gym.'];
            }
        }
        return $errors ? response()->json(['errors' => $errors], 422) : null;
    }

    private function findVisible(Request $request, string $id): SalesLead|JsonResponse
    {
        $access = new SalesAccess($request->user());
        $lead = $access->scopeLeads(SalesLead::query())->find($id);
        // 404 (not 403) so reps can't probe other reps' lead ids.
        return $lead ?: response()->json(['error' => 'Not found'], 404);
    }

    private function findWorkable(Request $request, string $id, bool $allowLost = false): SalesLead|JsonResponse
    {
        $lead = $this->findVisible($request, $id);
        if ($lead instanceof JsonResponse) {
            return $lead;
        }

        $access = new SalesAccess($request->user());
        if (! $access->canWork($lead)) {
            return response()->json(['error' => 'Claim or get assigned this lead to work it.'], 403);
        }
        if ($lead->stage === LeadStage::Converted) {
            return response()->json(['error' => 'Converted leads are read-only.'], 422);
        }
        if (! $allowLost && $lead->stage === LeadStage::Lost) {
            // Lost leads sit in the nurture pool: reopen before working them.
            return response()->json(['error' => 'Lead is lost — reopen it first.'], 422);
        }
        return $lead;
    }
}
