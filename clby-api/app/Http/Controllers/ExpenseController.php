<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Services\RecurringExpenses;
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
 *
 * Recurring expenses (docs/recurring-expenses.md): occurrences of a
 * schedule are rows in this same table with a recurring_expense_id. Only
 * `status = recorded` rows are actual expenses — every one-off row is
 * recorded, and an occurrence row only exists once its date has arrived
 * (or as a skipped / cancelled / edited-ahead marker, which never counts).
 * So the period math below is unchanged apart from that status filter.
 */
class ExpenseController extends Controller
{
    private const SORTABLE = ['expense_date', 'amount', 'created_at'];

    /** Table "type" filter: expense kind, or the parent schedule's status. */
    private const TYPES = ['all', 'one_off', 'recurring', 'active', 'paused', 'ended'];

    public function __construct(private RecurringExpenses $recurring)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $request->validate([
            'search'   => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string'],
            'type'     => ['nullable', Rule::in(self::TYPES)],
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
            ->get();

        return response()->json([
            'data' => $this->presentAll($gymId, $rows),
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
            ->get();

        return response()->json([
            'data' => $this->presentAll($gymId, $rows),
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

        $data = $expense->toArray();
        if ($expense->recurring_expense_id) {
            $data['recurring'] = $this->recurringSummaries($gymId, [$expense->recurring_expense_id])[$expense->recurring_expense_id] ?? null;
        }

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        // One-off only. Recurrence fields are not in the rules, so a
        // stray frequency / start_date in the body is ignored — schedules
        // are created through POST /expenses/recurring.
        $validated = $request->validate($this->rules());
        $validated['gym_id'] = $gymId;
        $validated['created_by'] = $request->user()->id;
        $validated['currency'] = Revenue::gymCurrency($gymId);

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

        // Skipped / cancelled / edited-ahead occurrence rows aren't actual
        // expenses; upcoming ones are edited via the schedule endpoints.
        if ($expense->status !== 'recorded') {
            return response()->json(['error' => 'Only recorded expenses can be edited here.', 'message' => 'Only recorded expenses can be edited here.'], 422);
        }

        // gym_id / created_by / created_at / recurring_expense_id /
        // scheduled_date / status are not in the rules, so they can't be
        // rewritten through this endpoint. For an occurrence this is
        // "edit this occurrence only": the schedule and its other
        // occurrences are untouched.
        $changes = $request->validate($this->rules(partial: true));
        $before = array_intersect_key($expense->only(array_keys($changes)), $changes);
        $expense->update($changes + ['updated_by' => $request->user()->id]);

        if ($expense->recurring_expense_id) {
            $s = DB::table('recurring_expenses')->where('id', $expense->recurring_expense_id)->first();
            if ($s) {
                $this->recurring->event($s, 'occurrence_edited', $request->user(), [
                    'scheduled_date' => substr((string) $expense->scheduled_date, 0, 10),
                    'before' => $before,
                    'changes' => $changes,
                ], $expense->id);
            }
        }

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

        // An occurrence is never hard-deleted: it is cancelled (kept for
        // the schedule's history, excluded from totals), and its row keeps
        // the (schedule, date) slot so the generator can't recreate it.
        if ($expense->recurring_expense_id) {
            if ($expense->status !== 'recorded') {
                return response()->json(['error' => 'This occurrence is not a recorded expense.', 'message' => 'This occurrence is not a recorded expense.'], 422);
            }
            $this->recurring->cancelOccurrence((object) $expense->getAttributes(), $request->user());

            return response()->json(['message' => 'Occurrence cancelled']);
        }

        // One-off: unchanged behaviour.
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

    /** Actual expenses (recorded rows) dated in the period. */
    private function inPeriod(string $gymId, string $from, string $to): Builder
    {
        return DB::table('expenses')
            ->where('gym_id', $gymId)
            ->where('status', 'recorded')
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

        match ($request->query('type')) {
            'one_off' => $query->whereNull('recurring_expense_id'),
            'recurring' => $query->whereNotNull('recurring_expense_id'),
            'active', 'paused', 'ended' => $query->whereIn('recurring_expense_id', DB::table('recurring_expenses')
                ->where('gym_id', $gymId)
                ->where('status', $request->query('type'))
                ->select('id')),
            default => null,
        };

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

        // Only the gym's currency is summed (legacy rows have no currency
        // and are in it by definition); anything else is reported, never
        // mixed in — same rule as revenue.
        $exp = $this->inPeriod($gymId, $from, $to)
            ->where(fn ($q) => $q->whereNull('currency')->orWhere('currency', $currency))
            ->selectRaw('coalesce(sum(amount), 0) AS total, count(*) AS n')
            ->first();
        $expenses = (float) $exp->total;
        $excludedExpenses = $this->inPeriod($gymId, $from, $to)
            ->whereNotNull('currency')
            ->where('currency', '!=', $currency)
            ->distinct()
            ->pluck('currency')
            ->all();

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
            'excluded_expense_currencies' => $excludedExpenses,
            'total_revenue' => round($revenue, 2),
            'total_expenses' => round($expenses, 2),
            'net_profit' => round($revenue - $expenses, 2),
            'expense_count' => (int) $exp->n,
        ];
    }

    /**
     * @param \Illuminate\Support\Collection<int, object> $rows
     * @return list<array<string, mixed>>
     */
    private function presentAll(string $gymId, $rows): array
    {
        $currency = null;
        $schedules = $this->recurringSummaries($gymId, $rows->pluck('recurring_expense_id')->filter()->unique()->values()->all());

        return $rows->map(function ($row) use ($gymId, &$currency, $schedules) {
            $r = (array) $row;
            $r['amount'] = (float) $r['amount'];
            $r['expense_date'] = substr((string) $r['expense_date'], 0, 10);
            $r['scheduled_date'] = $r['scheduled_date'] ? substr((string) $r['scheduled_date'], 0, 10) : null;
            // Legacy rows carry no currency: they are in the gym's.
            $r['currency'] ??= ($currency ??= Revenue::gymCurrency($gymId));
            $r['recurring'] = $r['recurring_expense_id'] ? ($schedules[$r['recurring_expense_id']] ?? null) : null;
            unset($r['gym_id']);

            return $r;
        })->values()->all();
    }

    /**
     * Compact schedule info for occurrence rows (Type / Schedule / next
     * occurrence columns).
     *
     * @param list<string> $ids
     * @return array<string, array<string, mixed>>
     */
    private function recurringSummaries(string $gymId, array $ids): array
    {
        if (! $ids) {
            return [];
        }
        $today = $this->recurring->gymToday($gymId);

        return DB::table('recurring_expenses')
            ->where('gym_id', $gymId)
            ->whereIn('id', $ids)
            ->get()
            ->mapWithKeys(fn ($s) => [$s->id => [
                'id' => $s->id,
                'frequency' => $s->frequency,
                'interval' => (int) $s->interval,
                'recurrence_day' => (int) $s->recurrence_day,
                'recurrence_month' => $s->recurrence_month !== null ? (int) $s->recurrence_month : null,
                'start_date' => substr((string) $s->start_date, 0, 10),
                'end_date' => $s->end_date ? substr((string) $s->end_date, 0, 10) : null,
                'status' => $s->status,
                'next_occurrence' => $this->recurring->nextOccurrence($s, $today),
            ]])
            ->all();
    }
}
