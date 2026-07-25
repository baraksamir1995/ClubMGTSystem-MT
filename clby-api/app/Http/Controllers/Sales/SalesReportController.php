<?php

namespace App\Http\Controllers\Sales;

use App\Enums\Sales\LeadStage;
use App\Http\Controllers\Controller;
use App\Models\Sales\SalesLead;
use App\Services\Sales\SalesAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Sales reporting. Every dataset flows through SalesAccess::scopeLeads so
 * reps only aggregate their own slice and branch-scoped managers only their
 * branches. Aggregation is done with the query builder / plain PHP to stay
 * portable between the sqlite test connection and pgsql prod.
 */
class SalesReportController extends Controller
{
    /** GET /api/sales/context — who am I inside the sales module? */
    public function context(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());

        $branches = DB::table('branches')
            ->where('gym_id', $request->user()->gym_id)
            ->where('is_active', true)
            ->when($access->branchIds !== null, fn ($q) => $q->whereIn('id', $access->branchIds))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($b) => ['id' => $b->id, 'name' => $b->name])
            ->values();

        return response()->json(['data' => [
            'is_admin' => $access->isAdmin,
            'is_manager' => $access->isManager,
            'user_id' => $request->user()->id,
            'branch_ids' => $access->branchIds,
            'branches' => $branches,
        ]]);
    }

    /** GET /api/sales/reports/funnel — monotonic reached-stage funnel. */
    public function funnel(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $query = $this->filteredLeads($request, $access);

        $leadIds = $query->pluck('id')->all();

        // A lead counts toward every stage it ever REACHED (stage history),
        // not just its current stage, so the funnel never inverts.
        $reached = DB::table('sales_lead_stage_history')
            ->whereIn('lead_id', $leadIds)
            ->select('to_stage', DB::raw('COUNT(DISTINCT lead_id) as c'))
            ->groupBy('to_stage')
            ->pluck('c', 'to_stage');

        $pipeline = [...LeadStage::ORDER, LeadStage::Lost];
        $stages = [];
        foreach ($pipeline as $stage) {
            $stages[] = ['stage' => $stage->value, 'count' => (int) ($reached[$stage->value] ?? 0)];
        }

        // Stage-to-stage conversion across the ordered pipeline (lost excluded).
        $conversion = [];
        foreach (LeadStage::ORDER as $i => $stage) {
            if ($i === count(LeadStage::ORDER) - 1) {
                break;
            }
            $next = LeadStage::ORDER[$i + 1];
            $from = (int) ($reached[$stage->value] ?? 0);
            $to = (int) ($reached[$next->value] ?? 0);
            $conversion[] = [
                'from' => $stage->value,
                'to' => $next->value,
                'rate' => $from > 0 ? round($to / $from, 4) : 0.0,
            ];
        }

        $appointments = DB::table('sales_appointments')
            ->whereIn('lead_id', $leadIds)
            ->select('status', DB::raw('COUNT(*) as c'))
            ->groupBy('status')
            ->pluck('c', 'status');

        return response()->json(['data' => [
            'stages' => $stages,
            'conversion' => $conversion,
            'showed_count' => (int) ($appointments['showed'] ?? 0),
            'no_show_count' => (int) ($appointments['no_show'] ?? 0),
        ]]);
    }

    /** GET /api/sales/reports/leaderboard?month=YYYY-MM — managers/admins only. */
    public function leaderboard(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());
        if (! $access->isManager) {
            return response()->json(['error' => 'Managers only.'], 403);
        }

        $month = $request->query('month', now()->format('Y-m'));
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            return response()->json(['errors' => ['month' => ['Expected YYYY-MM.']]], 422);
        }
        $start = Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfDay();
        $end = $start->copy()->addMonth();

        $leads = $access->scopeLeads(SalesLead::query())
            ->whereNotNull('assigned_to')
            ->where('created_at', '>=', $start)
            ->where('created_at', '<', $end)
            ->get(['id', 'assigned_to', 'stage', 'created_at', 'first_contacted_at']);

        // One pass for appointment outcomes on those leads.
        $apptByLead = DB::table('sales_appointments')
            ->whereIn('lead_id', $leads->pluck('id')->all())
            ->whereIn('status', ['showed', 'no_show'])
            ->get(['lead_id', 'status'])
            ->groupBy('lead_id');

        $names = DB::table('profiles')
            ->whereIn('id', $leads->pluck('assigned_to')->unique()->all())
            ->pluck('full_name', 'id');

        $rows = $leads->groupBy('assigned_to')->map(function ($userLeads, $userId) use ($apptByLead, $names) {
            $speeds = $userLeads
                ->filter(fn ($l) => $l->first_contacted_at !== null)
                ->map(fn ($l) => (float) $l->created_at->diffInMinutes($l->first_contacted_at));

            $showed = 0;
            $noShow = 0;
            foreach ($userLeads as $lead) {
                foreach ($apptByLead->get($lead->id, collect()) as $appt) {
                    $appt->status === 'showed' ? $showed++ : $noShow++;
                }
            }

            $total = $userLeads->count();
            $conversions = $userLeads->filter(fn ($l) => $l->stage === LeadStage::Converted)->count();

            return [
                'user_id' => $userId,
                'name' => $names[$userId] ?? 'Unknown',
                'leads' => $total,
                'avg_speed_to_lead_minutes' => $speeds->isNotEmpty() ? round($speeds->avg(), 2) : null,
                'show_rate' => ($showed + $noShow) > 0 ? round($showed / ($showed + $noShow), 4) : null,
                'close_rate' => $total > 0 ? round($conversions / $total, 4) : null,
                'conversions' => $conversions,
            ];
        })->sortByDesc('conversions')->values();

        return response()->json(['data' => $rows]);
    }

    /** GET /api/sales/reports/sources?from=&to= — lead volume + conversion by source. */
    public function sources(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $leads = $this->filteredLeads($request, $access)->get(['id', 'source_id', 'stage']);

        $names = DB::table('sales_lead_sources')
            ->whereIn('id', $leads->pluck('source_id')->filter()->unique()->all())
            ->pluck('name', 'id');

        $rows = $leads->groupBy(fn ($l) => $l->source_id ?? '')->map(function ($group, $sourceId) use ($names) {
            $total = $group->count();
            $converted = $group->filter(fn ($l) => $l->stage === LeadStage::Converted)->count();
            return [
                'source_id' => $sourceId === '' ? null : $sourceId,
                'name' => $sourceId === '' ? 'Unknown' : ($names[$sourceId] ?? 'Unknown'),
                'leads' => $total,
                'converted' => $converted,
                'conversion_rate' => $total > 0 ? round($converted / $total, 4) : 0.0,
            ];
        })->sortByDesc('leads')->values();

        return response()->json(['data' => $rows]);
    }

    /* ── helpers ──────────────────────────────────────────────────── */

    /** Access-scoped leads with the shared from/to/branch/source/rep filters. */
    private function filteredLeads(Request $request, SalesAccess $access): Builder
    {
        $query = $access->scopeLeads(SalesLead::query());

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->query('to'));
        }
        foreach (['branch_id', 'source_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        if ($request->filled('rep_id')) {
            $query->where('assigned_to', $request->query('rep_id'));
        }

        return $query;
    }
}
