<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Services\LifecycleException;
use App\Services\RecurringExpenses;
use App\Support\Recurrence;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Payments → Financial Overview: recurring expense schedules.
 *
 * A schedule is a definition; its occurrences are ordinary rows in
 * `expenses` (see ExpenseController and App\Services\RecurringExpenses).
 * Every lookup is pinned to the caller's gym_id, so a foreign id is a 404.
 */
class RecurringExpenseController extends Controller
{
    private const STATUSES = ['active', 'paused', 'ended'];

    public function __construct(private RecurringExpenses $svc)
    {
    }

    /** GET /expenses/recurring?status=&search= */
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $request->validate([
            'status' => ['nullable', Rule::in([...self::STATUSES, 'all'])],
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $q = DB::table('recurring_expenses')->where('gym_id', $gymId);
        if (in_array($request->query('status'), self::STATUSES, true)) {
            $q->where('status', $request->query('status'));
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search) . '%';
            $q->where(fn ($w) => $w->where('title', 'ilike', $like)->orWhere('vendor', 'ilike', $like));
        }

        $rows = $q->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END")
            ->orderBy('title')
            ->limit(500)
            ->get();

        $stats = DB::table('expenses')
            ->whereIn('recurring_expense_id', $rows->pluck('id'))
            ->where('status', 'recorded')
            ->groupBy('recurring_expense_id')
            ->selectRaw('recurring_expense_id, count(*) AS n, coalesce(sum(amount), 0) AS total, max(expense_date) AS last_date')
            ->get()
            ->keyBy('recurring_expense_id');

        $today = $this->svc->gymToday($gymId);

        return response()->json([
            'data' => $rows->map(function ($s) use ($stats, $today) {
                $st = $stats[$s->id] ?? null;

                return $this->present($s, $today) + [
                    'recorded_count' => (int) ($st->n ?? 0),
                    'recorded_total' => round((float) ($st->total ?? 0), 2),
                    'last_recorded_date' => $st?->last_date ? substr((string) $st->last_date, 0, 10) : null,
                ];
            })->values(),
            'today' => $today,
        ]);
    }

    /**
     * GET /expenses/upcoming?days=30 — not-yet-due occurrences of active
     * schedules. Purely informational: these rows do not exist in
     * `expenses` (except edited-ahead ones) and never count in totals.
     */
    public function upcoming(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $request->validate(['days' => ['nullable', 'integer', 'min:1', 'max:366']]);
        $days = (int) $request->query('days', 30);

        $today = $this->svc->gymToday($gymId);
        $until = CarbonImmutable::parse($today)->addDays($days)->toDateString();

        $schedules = DB::table('recurring_expenses')->where('gym_id', $gymId)->where('status', 'active')->get();
        $overrides = DB::table('expenses')
            ->whereIn('recurring_expense_id', $schedules->pluck('id'))
            ->where('status', 'scheduled')
            ->get()
            ->keyBy(fn ($r) => $r->recurring_expense_id . '|' . substr((string) $r->scheduled_date, 0, 10));

        $items = [];
        foreach ($schedules as $s) {
            foreach ($this->svc->upcomingDates($s, $today, $until, 400) as $date) {
                $o = $overrides[$s->id . '|' . $date] ?? null;
                $items[] = [
                    'recurring_expense_id' => $s->id,
                    'expense_id' => $o?->id,
                    'scheduled_date' => $date,
                    'title' => $o->title ?? $s->title,
                    'amount' => round((float) ($o->amount ?? $s->amount), 2),
                    'currency' => $s->currency,
                    'category' => $o->category ?? $s->category,
                    'vendor' => $o ? $o->vendor : $s->vendor,
                    'frequency' => $s->frequency,
                    'interval' => (int) $s->interval,
                    'modified' => $o !== null,
                ];
            }
        }
        usort($items, fn ($a, $b) => [$a['scheduled_date'], $a['title']] <=> [$b['scheduled_date'], $b['title']]);
        $items = array_slice($items, 0, 500);

        // Per currency — never summed across currencies.
        $totals = [];
        foreach ($items as $i) {
            $totals[$i['currency']] = round(($totals[$i['currency']] ?? 0) + $i['amount'], 2);
        }

        return response()->json([
            'data' => $items,
            'from' => $today,
            'to' => $until,
            'totals' => $totals,
        ]);
    }

    /** GET /expenses/recurring/{id} — definition, occurrence history, upcoming dates, audit trail. */
    public function show(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $s = $this->findOwned($gymId, $id);
        if (! $s) {
            return response()->json(['error' => 'Recurring expense not found'], 404);
        }
        $today = $this->svc->gymToday($gymId);

        $occurrences = DB::table('expenses')
            ->where('gym_id', $gymId)
            ->where('recurring_expense_id', $s->id)
            ->orderByDesc('scheduled_date')
            ->limit(500)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'scheduled_date' => substr((string) $r->scheduled_date, 0, 10),
                'expense_date' => substr((string) $r->expense_date, 0, 10),
                'title' => $r->title,
                'amount' => (float) $r->amount,
                'currency' => $r->currency ?? $s->currency,
                'status' => $r->status,
                'recorded_at' => $r->recorded_at,
                'updated_at' => $r->updated_at,
            ]);

        $upcoming = $s->status === 'active'
            ? $this->svc->upcomingDates($s, $today, null, 6)
            : [];

        $events = DB::table('recurring_expense_events')
            ->where('gym_id', $gymId)
            ->where('recurring_expense_id', $s->id)
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($e) => [
                'action' => $e->action,
                'actor_name' => $e->actor_name,
                'actor_id' => $e->actor_id,
                'expense_id' => $e->expense_id,
                'details' => $e->details ? json_decode($e->details, true) : null,
                'created_at' => $e->created_at,
            ]);

        $next = DB::table('recurring_expenses')->where('gym_id', $gymId)->where('previous_id', $s->id)->value('id');
        $profiles = DB::table('profiles')
            ->whereIn('id', array_filter([$s->created_by, $s->updated_by, $s->paused_by, $s->resumed_by, $s->ended_by]))
            ->pluck('full_name', 'id');

        return response()->json(['data' => $this->present($s, $today) + [
            'continued_by' => $next,
            'occurrences' => $occurrences,
            'upcoming' => $upcoming,
            'events' => $events,
            'audit' => [
                'created_by' => $profiles[$s->created_by] ?? null,
                'updated_by' => $profiles[$s->updated_by] ?? null,
                'paused_at' => $s->paused_at, 'paused_by' => $profiles[$s->paused_by] ?? null,
                'resumed_at' => $s->resumed_at, 'resumed_by' => $profiles[$s->resumed_by] ?? null,
                'ended_at' => $s->ended_at, 'ended_by' => $profiles[$s->ended_by] ?? null,
            ],
        ]]);
    }

    /** POST /expenses/recurring */
    public function store(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $today = $this->svc->gymToday($gymId);
        $data = $this->validateDefinition($request, CarbonImmutable::parse($today)->subDays(366)->toDateString());

        $s = $this->svc->create($gymId, $data, $request->user());

        return response()->json(['data' => $this->present($s, $today)], 201);
    }

    /**
     * PUT /expenses/recurring/{id} — "edit this and future occurrences".
     * start_date is the effective date (>= today); earlier recorded
     * occurrences are never rewritten.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $s = $this->findOwned($gymId, $id);
        if (! $s) {
            return response()->json(['error' => 'Recurring expense not found'], 404);
        }
        $today = $this->svc->gymToday($gymId);
        $data = $this->validateDefinition($request, $today);

        return $this->lifecycle(fn () => $this->svc->update($s, $data, $request->user()), $today);
    }

    public function pause(Request $request, string $id): JsonResponse
    {
        return $this->transition($request, $id, 'pause');
    }

    public function resume(Request $request, string $id): JsonResponse
    {
        return $this->transition($request, $id, 'resume');
    }

    public function end(Request $request, string $id): JsonResponse
    {
        return $this->transition($request, $id, 'end');
    }

    /** PUT /expenses/recurring/{id}/occurrences/{date} — edit one upcoming occurrence only. */
    public function editOccurrence(Request $request, string $id, string $date): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $s = $this->findOwned($gymId, $id);
        if (! $s || ! $this->isYmd($date)) {
            return response()->json(['error' => 'Recurring expense not found'], 404);
        }
        $fields = $request->validate([
            'title'          => ['sometimes', 'string', 'max:255'],
            'amount'         => ['sometimes', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'category'       => ['sometimes', 'string', Rule::in(Expense::CATEGORIES)],
            'vendor'         => ['nullable', 'string', 'max:255'],
            'payment_method' => ['nullable', 'string', Rule::in(Expense::PAYMENT_METHODS)],
            'description'    => ['nullable', 'string', 'max:5000'],
        ]);

        try {
            $row = $this->svc->editUpcoming($s, $date, $fields, $request->user());
        } catch (LifecycleException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->presentRow($row)]);
    }

    /** POST /expenses/recurring/{id}/occurrences/{date}/skip — skip one upcoming occurrence. */
    public function skipOccurrence(Request $request, string $id, string $date): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $s = $this->findOwned($gymId, $id);
        if (! $s || ! $this->isYmd($date)) {
            return response()->json(['error' => 'Recurring expense not found'], 404);
        }
        try {
            $row = $this->svc->skipUpcoming($s, $date, $request->user());
        } catch (LifecycleException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->presentRow($row)]);
    }

    // ─── Internals ───────────────────────────────────────────────────────

    private function transition(Request $request, string $id, string $action): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $s = $this->findOwned($gymId, $id);
        if (! $s) {
            return response()->json(['error' => 'Recurring expense not found'], 404);
        }

        return $this->lifecycle(fn () => $this->svc->{$action}($s, $request->user()), $this->svc->gymToday($gymId));
    }

    private function lifecycle(callable $fn, string $today): JsonResponse
    {
        try {
            $s = $fn();
        } catch (LifecycleException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->present($s, $today)]);
    }

    private function unprocessable(LifecycleException $e): JsonResponse
    {
        return response()->json(['error' => $e->getMessage(), 'message' => $e->getMessage()], 422);
    }

    private function findOwned(string $gymId, string $id): ?object
    {
        if (! Str::isUuid($id)) {
            return null;
        }

        return DB::table('recurring_expenses')->where('gym_id', $gymId)->where('id', $id)->first();
    }

    private function isYmd(string $d): bool
    {
        return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) && checkdate((int) substr($d, 5, 2), (int) substr($d, 8, 2), (int) substr($d, 0, 4));
    }

    /**
     * Validate a full schedule definition. $minStart bounds start_date:
     * create allows up to a year back (those dates are recorded at once);
     * an edit applies from today onward.
     *
     * @return array<string, mixed>
     */
    private function validateDefinition(Request $request, string $minStart): array
    {
        $weekly = $request->input('frequency') === 'weekly';
        $data = $request->validate([
            'title'            => ['required', 'string', 'max:255'],
            'amount'           => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'decimal:0,2'],
            'category'         => ['required', 'string', Rule::in(Expense::CATEGORIES)],
            'vendor'           => ['nullable', 'string', 'max:255'],
            'payment_method'   => ['nullable', 'string', Rule::in(Expense::PAYMENT_METHODS)],
            'description'      => ['nullable', 'string', 'max:5000'],
            'frequency'        => ['required', Rule::in(Recurrence::FREQUENCIES)],
            'interval'         => ['nullable', 'integer', 'min:1', 'max:99'],
            'start_date'       => ['required', 'date_format:Y-m-d', 'after_or_equal:' . $minStart],
            'end_date'         => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'recurrence_day'   => ['required', 'integer', 'min:1', $weekly ? 'max:7' : 'max:31'],
            'recurrence_month' => ['nullable', 'required_if:frequency,yearly', 'integer', 'min:1', 'max:12'],
        ], [
            'start_date.after_or_equal' => $minStart === $this->svc->gymToday($request->user()->gym_id)
                ? 'Changes apply from today onward; pick a start date that is today or later.'
                : 'The start date can be at most one year in the past.',
            'recurrence_day.max' => $weekly ? 'Pick a day of the week.' : 'The day of month must be between 1 and 31.',
        ]);
        $data['interval'] = (int) ($data['interval'] ?? 1);

        // A fixed month makes some days impossible (30 Feb); 29 Feb is
        // allowed and falls back to 28 Feb in non-leap years.
        if ($data['frequency'] === 'yearly') {
            $max = [1 => 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(int) $data['recurrence_month']];
            if ((int) $data['recurrence_day'] > $max) {
                throw ValidationException::withMessages(['recurrence_day' => ["That month has at most {$max} days."]]);
            }
        }

        $rec = new Recurrence($data['frequency'], $data['interval'], $data['start_date'], $data['end_date'] ?? null, (int) $data['recurrence_day'], isset($data['recurrence_month']) ? (int) $data['recurrence_month'] : null);
        if ($rec->nextOnOrAfter($data['start_date']) === null) {
            throw ValidationException::withMessages(['end_date' => ['No occurrence falls between the start and end dates.']]);
        }

        return $data;
    }

    private function present(object $s, string $today): array
    {
        $r = (array) $s;
        unset($r['gym_id']);
        $r['amount'] = (float) $r['amount'];
        $r['interval'] = (int) $r['interval'];
        $r['recurrence_day'] = (int) $r['recurrence_day'];
        $r['recurrence_month'] = $r['recurrence_month'] !== null ? (int) $r['recurrence_month'] : null;
        foreach (['start_date', 'end_date', 'generated_through'] as $k) {
            $r[$k] = $r[$k] ? substr((string) $r[$k], 0, 10) : null;
        }
        $r['next_occurrence'] = $this->svc->nextOccurrence($s, $today);

        return $r;
    }

    private function presentRow(object $row): array
    {
        $r = (array) $row;
        unset($r['gym_id']);
        $r['amount'] = (float) $r['amount'];
        $r['expense_date'] = substr((string) $r['expense_date'], 0, 10);
        $r['scheduled_date'] = $r['scheduled_date'] ? substr((string) $r['scheduled_date'], 0, 10) : null;

        return $r;
    }
}
