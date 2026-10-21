<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Support\Revenue;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Payments → Financial Overview: expense CRUD plus the revenue / expense /
 * net-profit summary over a reporting period.
 *
 * Every query is pinned to the caller's gym_id; ids from the URL are only
 * ever looked up inside that gym, so a foreign id is a 404, not a leak.
 *
 * The reporting period is a pair of gym-local dates (`from`, `to`,
 * inclusive). With neither given it defaults to the current calendar month
 * in the gym's timezone — the summary, the table and the export all
 * resolve it the same way, so they can never disagree.
 */
class ExpenseController extends Controller
{
    private const SORTABLE = ['expense_date', 'amount', 'created_at'];

    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $request->validate([
            'search'   => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string'],
        ]);

        [$from, $to] = $this->period($request, Revenue::gymTimezone($gymId));

        $limit = max(1, min((int) $request->query('limit', 25), 200));
        $page  = max(1, (int) $request->query('page', 1));

        $sort = in_array($request->query('sort'), self::SORTABLE, true) ? $request->query('sort') : 'expense_date';
        $dir  = $request->query('dir') === 'asc' ? 'asc' : 'desc';

        $query = $this->filtered($request, $gymId, $from, $to);
        $total = (clone $query)->count();

        $rows = $query
            ->orderBy($sort, $dir)
            // Stable order inside a day / equal amounts, so paging never
            // shows a row twice or skips one.
            ->orderBy('created_at', 'desc')
            ->orderBy('id')
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get()
            ->map(fn ($r) => $this->present($r));

        return response()->json([
            'data' => $rows,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => (int) max(1, ceil($total / $limit)),
            ],
        ]);
    }

    /**
     * Kept off the paged list on purpose: the totals depend only on the
     * period, so paging / sorting / searching the table doesn't rerun the
     * payments revenue scan.
     */
    public function summary(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $tz = Revenue::gymTimezone($gymId);
        [$from, $to] = $this->period($request, $tz);

        return response()->json(['data' => $this->summarize($gymId, $from, $to, $tz)]);
    }

    /**
     * Every expense in the period, plus the summary. Unpaginated so the CSV
     * is built from the full authoritative set rather than whatever page the
     * table happens to show. Table filters (search / category) are not
     * applied, so the rows add up to the summary's total_expenses.
     */
    public function export(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $tz = Revenue::gymTimezone($gymId);
        [$from, $to] = $this->period($request, $tz);

        $rows = $this->inPeriod($gymId, $from, $to)
            ->orderBy('expense_date')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($r) => $this->present($r));

        return response()->json([
            'data' => $rows,
            'summary' => $this->summarize($gymId, $from, $to, $tz),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $expense = $this->findOwned($gymId, $id);
        if (! $expense) {
            return response()->json(['error' => 'Expense not found'], 404);
        }

        return response()->json(['data' => $expense]);
    }

    public function store(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $validated = $request->validate($this->rules());
        $validated['gym_id'] = $gymId;
        $validated['created_by'] = $request->user()->id;

        $expense = Expense::create($validated);

        return response()->json(['data' => $expense->fresh()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $expense = $this->findOwned($gymId, $id);
        if (! $expense) {
            return response()->json(['error' => 'Expense not found'], 404);
        }

        // gym_id / created_by / created_at are not in the rules, so they
        // can't be rewritten through this endpoint.
        $expense->update($request->validate($this->rules(partial: true)));

        return response()->json(['data' => $expense->fresh()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $expense = $this->findOwned($gymId, $id);
        if (! $expense) {
            return response()->json(['error' => 'Expense not found'], 404);
        }
        $expense->delete();

        return response()->json(['message' => 'Expense deleted']);
    }

    // ─── Internals ───────────────────────────────────────────────────────

    /** Null for a foreign id and for a malformed one (which would otherwise
     *  reach Postgres as an invalid uuid and 500). */
    private function findOwned(string $gymId, string $id): ?Expense
    {
        if (! Str::isUuid($id)) {
            return null;
        }

        return Expense::where('gym_id', $gymId)->where('id', $id)->first();
    }

    private function rules(bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return [
            'title'          => [$req, 'string', 'max:255'],
            // Upper bound matches decimal(12,2).
            'amount'         => [$req, 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'expense_date'   => [$req, 'date_format:Y-m-d'],
            'category'       => [$req, 'string', Rule::in(Expense::CATEGORIES)],
            'vendor'         => ['nullable', 'string', 'max:255'],
            'payment_method' => ['nullable', 'string', Rule::in(Expense::PAYMENT_METHODS)],
            'description'    => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * Resolve the reporting period to inclusive gym-local Y-m-d dates.
     * Either bound may be supplied alone; the missing one falls back to the
     * current month's edge.
     *
     * @return array{0: string, 1: string}
     */
    private function period(Request $request, string $tz): array
    {
        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to'   => ['nullable', 'date_format:Y-m-d'],
        ]);

        $now = CarbonImmutable::now($tz);
        $from = $request->query('from') ?: $now->startOfMonth()->toDateString();
        $to   = $request->query('to')   ?: $now->endOfMonth()->toDateString();

        // Only one bound given and it lands on the wrong side of the
        // defaulted one — reject rather than silently return nothing.
        if ($from > $to) {
            abort(response()->json([
                'message' => 'The start date must not be after the end date.',
                'errors' => ['from' => ['The start date must not be after the end date.']],
            ], 422));
        }

        return [$from, $to];
    }

    private function inPeriod(string $gymId, string $from, string $to): Builder
    {
        return DB::table('expenses')
            ->where('gym_id', $gymId)
            ->whereBetween('expense_date', [$from, $to]);
    }

    private function filtered(Request $request, string $gymId, string $from, string $to): Builder
    {
        $query = $this->inPeriod($gymId, $from, $to);

        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search) . '%';
            $query->where(fn ($q) => $q->where('title', 'ilike', $like)->orWhere('vendor', 'ilike', $like));
        }

        if (($category = $request->query('category')) && in_array($category, Expense::CATEGORIES, true)) {
            $query->where('category', $category);
        }

        return $query;
    }

    /**
     * Revenue / expenses / net over the period. Revenue follows the shared
     * rule in App\Support\Revenue (same number as the dashboard's monthly
     * card); expenses are summed by expense_date.
     *
     * Expense filters (search / category) deliberately do NOT narrow the
     * summary — the cards describe the period, not the current table view.
     */
    private function summarize(string $gymId, string $from, string $to, string $tz): array
    {
        $currency = Revenue::gymCurrency($gymId);
        $revenue = Revenue::between($gymId, $from, $to, $tz, $currency);
        $excluded = Revenue::excludedCurrencies($gymId, $from, $to, $tz, $currency);

        $exp = $this->inPeriod($gymId, $from, $to)
            ->selectRaw('coalesce(sum(amount), 0) AS total, count(*) AS n')
            ->first();
        $expenses = (float) $exp->total;

        $now = CarbonImmutable::now($tz);

        return [
            'from' => $from,
            'to' => $to,
            // Lets the UI label the cards "This Month" vs. a custom range.
            'is_current_month' => $from === $now->startOfMonth()->toDateString()
                && $to === $now->endOfMonth()->toDateString(),
            'timezone' => $tz,
            'currency' => $currency,
            'excluded_currencies' => $excluded,
            'total_revenue' => round($revenue, 2),
            'total_expenses' => round($expenses, 2),
            'net_profit' => round($revenue - $expenses, 2),
            'expense_count' => (int) $exp->n,
        ];
    }

    private function present(object $row): array
    {
        $r = (array) $row;
        $r['amount'] = (float) $r['amount'];
        $r['expense_date'] = substr((string) $r['expense_date'], 0, 10);
        unset($r['gym_id']);

        return $r;
    }
}
