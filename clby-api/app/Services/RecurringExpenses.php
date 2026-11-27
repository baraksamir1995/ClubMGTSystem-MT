<?php

namespace App\Services;

use App\Support\Recurrence;
use App\Support\Revenue;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Recurring-expense lifecycle + occurrence generation.
 *
 * Generation model (docs/recurring-expenses.md):
 *   - Occurrences are materialised as `expenses` rows only once their date
 *     has arrived in the gym's timezone (horizon = today). Upcoming dates
 *     are computed on the fly, so a future occurrence can never leak into
 *     actual totals.
 *   - `recurring_expenses.generated_through` is a monotonic cursor: every
 *     schedule date <= it has been processed. A run processes
 *     (generated_through, today], so a missed run is caught up by the next.
 *   - Duplicates are impossible twice over: the schedule row is locked
 *     (SELECT … FOR UPDATE) for the whole run, and the insert is
 *     ON CONFLICT DO NOTHING against the unique
 *     (recurring_expense_id, scheduled_date) index.
 *   - Pause/end first catch the schedule up to today; resume moves the
 *     cursor to yesterday, so the paused gap is never backfilled.
 */
class RecurringExpenses
{
    /** Safety valve: occurrences one run may create for one schedule. */
    public const MAX_PER_RUN = 500;

    /** @var array<string, string> gym_id => timezone */
    private array $tz = [];

    public function gymToday(string $gymId): string
    {
        $this->tz[$gymId] ??= Revenue::gymTimezone($gymId);

        return CarbonImmutable::now($this->tz[$gymId])->toDateString();
    }

    // ─── Generation ──────────────────────────────────────────────────────

    /**
     * Generate due occurrences for every active schedule. One schedule's
     * failure is logged and doesn't stop the rest.
     *
     * @return array{schedules: int, created: int, failed: int}
     */
    public function generateAll(?string $gymId = null): array
    {
        $ids = DB::table('recurring_expenses')
            ->where('status', 'active')
            ->when($gymId, fn ($q) => $q->where('gym_id', $gymId))
            ->orderBy('id')
            ->pluck('id');

        $created = 0;
        $failed = 0;
        foreach ($ids as $id) {
            try {
                $created += $this->generate($id);
            } catch (\Throwable $e) {
                $failed++;
                Log::error('recurring-expenses: generation failed', ['id' => $id, 'error' => $e->getMessage()]);
            }
        }

        return ['schedules' => count($ids), 'created' => $created, 'failed' => $failed];
    }

    /** Generate due occurrences for one schedule. Returns rows created. */
    public function generate(string $id): int
    {
        return DB::transaction(function () use ($id) {
            $s = $this->lock($id);

            return $s ? $this->process($s) : 0;
        });
    }

    /**
     * Core of a run; the caller holds the row lock. Records every schedule
     * date in (generated_through, today], promotes due edited-ahead
     * occurrences, advances the cursor and auto-ends a finished schedule.
     */
    private function process(object $s): int
    {
        if ($s->status !== 'active') {
            return 0;
        }

        $today = $this->gymToday($s->gym_id);
        $from = $s->generated_through
            ? CarbonImmutable::parse($s->generated_through)->addDay()->toDateString()
            : $this->ymd($s->start_date);
        $end = $s->end_date ? $this->ymd($s->end_date) : null;
        $to = $end !== null && $end < $today ? $end : $today;

        $created = 0;
        $through = $s->generated_through ? $this->ymd($s->generated_through) : null;

        if ($from <= $to) {
            $dates = Recurrence::for($s)->between($from, $to, self::MAX_PER_RUN);
            $now = now();
            foreach ($dates as $date) {
                $created += DB::table('expenses')->insertOrIgnore([
                    'id' => (string) Str::uuid(),
                    'gym_id' => $s->gym_id,
                    'recurring_expense_id' => $s->id,
                    'scheduled_date' => $date,
                    'expense_date' => $date,
                    'title' => $s->title,
                    'amount' => $s->amount,
                    'currency' => $s->currency,
                    'category' => $s->category,
                    'vendor' => $s->vendor,
                    'payment_method' => $s->payment_method,
                    'description' => $s->description,
                    'status' => 'recorded',
                    'recorded_at' => $now,
                    // NULL = recorded by the system generator.
                    'created_by' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
            // If the safety valve cut the run short, only advance the
            // cursor as far as we actually got; the next run continues.
            $through = count($dates) >= self::MAX_PER_RUN ? end($dates) : $to;
        }

        // Occurrences edited ahead of time become actual expenses on their
        // date (the insert above skipped them via the unique index).
        DB::table('expenses')
            ->where('recurring_expense_id', $s->id)
            ->where('status', 'scheduled')
            ->where('scheduled_date', '<=', $through ?? '0001-01-01')
            ->update(['status' => 'recorded', 'recorded_at' => now(), 'updated_at' => now()]);

        $update = [];
        if ($through !== null && $through !== ($s->generated_through ? $this->ymd($s->generated_through) : null)) {
            $update['generated_through'] = $through;
        }
        // Auto-end once nothing is left to record: the end date has been
        // processed, or (e.g. the older half of a split) no scheduled date
        // remains between the cursor and the end date.
        if ($end !== null) {
            $remaining = $through === null
                ? Recurrence::for($s)->nextOnOrAfter($this->ymd($s->start_date))
                : ($through >= $end ? null : Recurrence::for($s)->nextOnOrAfter(CarbonImmutable::parse($through)->addDay()->toDateString()));
            if ($remaining === null) {
                $update += ['status' => 'ended', 'ended_at' => now(), 'ended_by' => null];
                $this->event($s, 'auto_ended', null, ['end_date' => $end]);
            }
        }
        if ($update) {
            DB::table('recurring_expenses')->where('id', $s->id)->update($update + ['updated_at' => now()]);
        }

        return $created;
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────

    /**
     * @param array<string, mixed> $data validated definition fields
     */
    public function create(string $gymId, array $data, object $actor): object
    {
        return DB::transaction(function () use ($gymId, $data, $actor) {
            $id = (string) Str::uuid();
            DB::table('recurring_expenses')->insert($this->definition($data) + [
                'id' => $id,
                'gym_id' => $gymId,
                'currency' => Revenue::gymCurrency($gymId),
                'status' => 'active',
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $s = $this->lock($id);
            $this->event($s, 'created', $actor, ['definition' => $this->definition($data)]);
            // A start date in the past (or today) records what's already due.
            $this->process($s);

            return $this->lock($id);
        });
    }

    public function pause(object $s, object $actor): object
    {
        return DB::transaction(function () use ($s, $actor) {
            $s = $this->lock($s->id);
            if ($s->status !== 'active') {
                throw new LifecycleException('Only an active schedule can be paused.');
            }
            // Anything already due is recorded before the pause takes effect.
            $this->process($s);
            DB::table('recurring_expenses')->where('id', $s->id)->update([
                'status' => 'paused', 'paused_at' => now(), 'paused_by' => $actor->id,
                'updated_by' => $actor->id, 'updated_at' => now(),
            ]);
            $this->event($s, 'paused', $actor);

            return $this->lock($s->id);
        });
    }

    public function resume(object $s, object $actor): object
    {
        return DB::transaction(function () use ($s, $actor) {
            $s = $this->lock($s->id);
            if ($s->status !== 'paused') {
                throw new LifecycleException('Only a paused schedule can be resumed.');
            }
            $today = $this->gymToday($s->gym_id);
            $yesterday = CarbonImmutable::parse($today)->subDay()->toDateString();
            $through = $s->generated_through ? $this->ymd($s->generated_through) : null;

            $update = [
                'status' => 'active', 'resumed_at' => now(), 'resumed_by' => $actor->id,
                'updated_by' => $actor->id, 'updated_at' => now(),
            ];
            // No backfill: dates that passed while paused are marked
            // processed. Today's date (if any) is still due.
            $skippedFrom = null;
            if ($this->ymd($s->start_date) <= $yesterday && ($through === null || $through < $yesterday)) {
                $update['generated_through'] = $yesterday;
                $skippedFrom = $through
                    ? CarbonImmutable::parse($through)->addDay()->toDateString()
                    : $this->ymd($s->start_date);
            }
            DB::table('recurring_expenses')->where('id', $s->id)->update($update);

            // Edited-ahead occurrences whose date passed during the pause
            // were never recorded; mark them skipped, not recorded late.
            DB::table('expenses')
                ->where('recurring_expense_id', $s->id)
                ->where('status', 'scheduled')
                ->where('scheduled_date', '<', $today)
                ->update(['status' => 'skipped', 'updated_at' => now()]);

            $this->event($s, 'resumed', $actor, $skippedFrom ? ['not_backfilled' => [$skippedFrom, $yesterday]] : null);
            $this->process($this->lock($s->id));

            return $this->lock($s->id);
        });
    }

    public function end(object $s, object $actor): object
    {
        return DB::transaction(function () use ($s, $actor) {
            $s = $this->lock($s->id);
            if ($s->status === 'ended') {
                throw new LifecycleException('This schedule has already ended.');
            }
            if ($s->status === 'active') {
                $this->process($s);
                $s = $this->lock($s->id);
                if ($s->status === 'ended') { // reached its end date just now
                    return $s;
                }
            }
            $today = $this->gymToday($s->gym_id);
            $end = $s->end_date ? $this->ymd($s->end_date) : null;
            DB::table('recurring_expenses')->where('id', $s->id)->update([
                'status' => 'ended',
                // History stays; only the future is cut off.
                'end_date' => $end !== null && $end < $today ? $end : $today,
                'ended_at' => now(), 'ended_by' => $actor->id,
                'updated_by' => $actor->id, 'updated_at' => now(),
            ]);
            // Future edited-ahead occurrences will never happen now.
            DB::table('expenses')
                ->where('recurring_expense_id', $s->id)
                ->where('status', 'scheduled')
                ->update(['status' => 'cancelled', 'updated_at' => now(), 'updated_by' => $actor->id]);
            $this->event($s, 'ended', $actor, ['previous_end_date' => $end]);

            return $this->lock($s->id);
        });
    }

    /**
     * "Edit this and future occurrences".
     *
     * $data is the full new definition; its start_date is the effective
     * date E (>= today). Recorded occurrences are never touched.
     *   - Nothing recorded yet and E <= start_date → the schedule is
     *     updated in place.
     *   - Otherwise the schedule is split: the old one ends on E-1 and a
     *     new one (previous_id = old) starts on E, inheriting the cursor so
     *     a date the old schedule already processed is not recorded again.
     *
     * @param array<string, mixed> $data
     * @return object the schedule that now governs dates >= E
     */
    public function update(object $s, array $data, object $actor): object
    {
        return DB::transaction(function () use ($s, $data, $actor) {
            $s = $this->lock($s->id);
            if ($s->status === 'ended') {
                throw new LifecycleException('An ended schedule cannot be edited.');
            }
            $this->process($s);
            $s = $this->lock($s->id);
            if ($s->status === 'ended') {
                throw new LifecycleException('This schedule reached its end date and has ended.');
            }

            $def = $this->definition($data);
            $effective = $def['start_date'];
            $before = $this->definition((array) $s);

            $hasRecorded = DB::table('expenses')
                ->where('recurring_expense_id', $s->id)
                ->whereIn('status', ['recorded', 'cancelled'])
                ->exists();

            if (! $hasRecorded && $effective <= $this->ymd($s->start_date)) {
                DB::table('recurring_expenses')->where('id', $s->id)->update($def + [
                    'generated_through' => null,
                    'updated_by' => $actor->id, 'updated_at' => now(),
                ]);
                $fresh = $this->lock($s->id);
                $this->dropStaleMarkers($fresh, $actor);
                $this->event($s, 'updated', $actor, ['before' => $before, 'after' => $def]);
                $this->process($fresh);

                return $this->lock($s->id);
            }

            if ($effective <= $this->ymd($s->start_date)) {
                throw new LifecycleException('The new start date must be after the original start date once occurrences have been recorded.');
            }

            $oldEnd = CarbonImmutable::parse($effective)->subDay()->toDateString();
            $today = $this->gymToday($s->gym_id);
            $oldUpdate = ['end_date' => $oldEnd, 'updated_by' => $actor->id, 'updated_at' => now()];
            if ($oldEnd < $today) {
                $oldUpdate += ['status' => 'ended', 'ended_at' => now(), 'ended_by' => $actor->id];
            }
            DB::table('recurring_expenses')->where('id', $s->id)->update($oldUpdate);
            // If no date is left before the split, the old half ends now
            // (rather than lingering as "active" with nothing upcoming).
            $this->process($this->lock($s->id));

            // Edited-ahead occurrences past the split belonged to the old
            // definition; void them (kept for history, never counted).
            DB::table('expenses')
                ->where('recurring_expense_id', $s->id)
                ->where('status', 'scheduled')
                ->where('scheduled_date', '>=', $effective)
                ->update(['status' => 'cancelled', 'updated_at' => now(), 'updated_by' => $actor->id]);

            $through = $s->generated_through ? $this->ymd($s->generated_through) : null;
            $newId = (string) Str::uuid();
            DB::table('recurring_expenses')->insert($def + [
                'id' => $newId,
                'gym_id' => $s->gym_id,
                'currency' => $s->currency,
                'status' => $s->status, // a paused schedule stays paused
                'generated_through' => $through !== null && $through >= $effective ? $through : null,
                'previous_id' => $s->id,
                'paused_at' => $s->status === 'paused' ? now() : null,
                'paused_by' => $s->status === 'paused' ? $actor->id : null,
                'created_by' => $actor->id,
                'updated_by' => $actor->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $new = $this->lock($newId);

            $this->event($s, 'split', $actor, ['effective_from' => $effective, 'continued_by' => $newId, 'before' => $before, 'after' => $def]);
            $this->event($new, 'created', $actor, ['continues' => $s->id, 'definition' => $def]);
            $this->process($new);

            return $this->lock($newId);
        });
    }

    /**
     * "Edit this occurrence only" for an upcoming date: stored ahead of
     * time as a `scheduled` row that the generator promotes on its date.
     *
     * @param array<string, mixed> $fields title/amount/category/vendor/payment_method/description
     */
    public function editUpcoming(object $s, string $date, array $fields, object $actor): object
    {
        return DB::transaction(function () use ($s, $date, $fields, $actor) {
            $s = $this->lock($s->id);
            $this->assertUpcoming($s, $date);

            $existing = DB::table('expenses')
                ->where('recurring_expense_id', $s->id)->where('scheduled_date', $date)->first();
            if ($existing && ! in_array($existing->status, ['scheduled', 'skipped'], true)) {
                throw new LifecycleException('This occurrence has already been processed.');
            }

            $row = array_intersect_key($fields, array_flip(['title', 'amount', 'category', 'vendor', 'payment_method', 'description']));
            if ($existing) {
                DB::table('expenses')->where('id', $existing->id)->update($row + [
                    'status' => 'scheduled', 'updated_by' => $actor->id, 'updated_at' => now(),
                ]);
                $id = $existing->id;
            } else {
                $id = (string) Str::uuid();
                DB::table('expenses')->insert($row + [
                    'id' => $id,
                    'gym_id' => $s->gym_id,
                    'recurring_expense_id' => $s->id,
                    'scheduled_date' => $date,
                    'expense_date' => $date,
                    'currency' => $s->currency,
                    'status' => 'scheduled',
                    'created_by' => $actor->id,
                    'updated_by' => $actor->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ] + [
                    // Unchanged fields fall back to the definition.
                    'title' => $s->title, 'amount' => $s->amount, 'category' => $s->category,
                    'vendor' => $s->vendor, 'payment_method' => $s->payment_method, 'description' => $s->description,
                ]);
            }
            $this->event($s, 'occurrence_edited', $actor, ['scheduled_date' => $date, 'changes' => $row], $id);

            return DB::table('expenses')->where('id', $id)->first();
        });
    }

    /** Skip one upcoming date (it will never be recorded). */
    public function skipUpcoming(object $s, string $date, object $actor): object
    {
        return DB::transaction(function () use ($s, $date, $actor) {
            $s = $this->lock($s->id);
            $this->assertUpcoming($s, $date);

            $existing = DB::table('expenses')
                ->where('recurring_expense_id', $s->id)->where('scheduled_date', $date)->first();
            if ($existing && $existing->status !== 'scheduled') {
                throw new LifecycleException($existing->status === 'skipped'
                    ? 'This occurrence is already skipped.'
                    : 'This occurrence has already been processed.');
            }
            if ($existing) {
                DB::table('expenses')->where('id', $existing->id)->update(['status' => 'skipped', 'updated_by' => $actor->id, 'updated_at' => now()]);
                $id = $existing->id;
            } else {
                $id = (string) Str::uuid();
                DB::table('expenses')->insert([
                    'id' => $id, 'gym_id' => $s->gym_id, 'recurring_expense_id' => $s->id,
                    'scheduled_date' => $date, 'expense_date' => $date,
                    'title' => $s->title, 'amount' => $s->amount, 'currency' => $s->currency,
                    'category' => $s->category, 'vendor' => $s->vendor,
                    'payment_method' => $s->payment_method, 'description' => $s->description,
                    'status' => 'skipped',
                    'created_by' => $actor->id, 'updated_by' => $actor->id,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $this->event($s, 'occurrence_skipped', $actor, ['scheduled_date' => $date], $id);

            return DB::table('expenses')->where('id', $id)->first();
        });
    }

    /** Void a recorded occurrence — kept for history, no longer counted. */
    public function cancelOccurrence(object $expense, object $actor): void
    {
        DB::transaction(function () use ($expense, $actor) {
            $s = $this->lock($expense->recurring_expense_id);
            DB::table('expenses')->where('id', $expense->id)->update([
                'status' => 'cancelled', 'updated_by' => $actor->id, 'updated_at' => now(),
            ]);
            if ($s) {
                $this->event($s, 'occurrence_cancelled', $actor, [
                    'scheduled_date' => $this->ymd($expense->scheduled_date),
                    'amount' => (float) $expense->amount,
                ], $expense->id);
            }
        });
    }

    // ─── Reads ───────────────────────────────────────────────────────────

    /**
     * Next date this schedule will actually record (skips skipped dates),
     * or null when paused / ended / past its end date.
     */
    public function nextOccurrence(object $s, ?string $today = null): ?string
    {
        if ($s->status !== 'active') {
            return null;
        }
        $dates = $this->upcomingDates($s, $today, null, 1);

        return $dates[0] ?? null;
    }

    /**
     * Upcoming (not yet processed) dates for an active schedule, excluding
     * skipped ones, optionally bounded by $until.
     *
     * @return list<string>
     */
    public function upcomingDates(object $s, ?string $today, ?string $until, int $limit): array
    {
        $today ??= $this->gymToday($s->gym_id);
        $from = $this->firstUnprocessed($s, $today);
        $skipped = DB::table('expenses')
            ->where('recurring_expense_id', $s->id)
            ->where('scheduled_date', '>=', $from)
            ->whereIn('status', ['skipped', 'cancelled'])
            ->pluck('scheduled_date')
            ->map(fn ($d) => $this->ymd($d))
            ->flip();

        $rec = Recurrence::for($s);
        $out = [];
        $cursor = $from;
        // Bounded: each iteration either collects a date or passes a
        // skipped one, and skipped markers are finite.
        while (count($out) < $limit && ($d = $rec->nextOnOrAfter($cursor)) !== null) {
            if ($until !== null && $d > $until) {
                break;
            }
            if (! isset($skipped[$d])) {
                $out[] = $d;
            }
            $cursor = CarbonImmutable::parse($d)->addDay()->toDateString();
        }

        return $out;
    }

    /** First schedule date not yet processed: max(today, cursor + 1, start). */
    public function firstUnprocessed(object $s, string $today): string
    {
        $from = $today;
        if ($s->generated_through) {
            $after = CarbonImmutable::parse($this->ymd($s->generated_through))->addDay()->toDateString();
            $from = max($from, $after);
        }

        return max($from, $this->ymd($s->start_date));
    }

    // ─── Internals ───────────────────────────────────────────────────────

    private function lock(?string $id): ?object
    {
        if (! $id) {
            return null;
        }

        return DB::table('recurring_expenses')->where('id', $id)->lockForUpdate()->first();
    }

    private function assertUpcoming(object $s, string $date): void
    {
        if ($s->status === 'ended') {
            throw new LifecycleException('This schedule has ended.');
        }
        $today = $this->gymToday($s->gym_id);
        if ($date < $this->firstUnprocessed($s, $today)) {
            throw new LifecycleException('Only upcoming occurrences can be changed this way.');
        }
        if (! Recurrence::for($s)->occursOn($date)) {
            throw new LifecycleException('That date is not part of this schedule.');
        }
    }

    /** After an in-place edit, markers on dates the schedule no longer hits are voided. */
    private function dropStaleMarkers(object $s, object $actor): void
    {
        $rec = Recurrence::for($s);
        $markers = DB::table('expenses')
            ->where('recurring_expense_id', $s->id)
            ->whereIn('status', ['scheduled', 'skipped'])
            ->get(['id', 'scheduled_date']);
        foreach ($markers as $m) {
            if (! $rec->occursOn($this->ymd($m->scheduled_date))) {
                DB::table('expenses')->where('id', $m->id)->update(['status' => 'cancelled', 'updated_by' => $actor->id, 'updated_at' => now()]);
            }
        }
    }

    /** @param array<string, mixed> $d */
    private function definition(array $d): array
    {
        $weekly = ($d['frequency'] ?? null) === 'weekly';

        return [
            'title' => $d['title'],
            'amount' => round((float) $d['amount'], 2),
            'category' => $d['category'],
            'payment_method' => $d['payment_method'] ?? null,
            'vendor' => $d['vendor'] ?? null,
            'description' => $d['description'] ?? null,
            'frequency' => $d['frequency'],
            'interval' => (int) ($d['interval'] ?? 1),
            'start_date' => $this->ymd($d['start_date']),
            'end_date' => ! empty($d['end_date']) ? $this->ymd($d['end_date']) : null,
            'recurrence_day' => (int) $d['recurrence_day'],
            'recurrence_month' => ! $weekly && $d['frequency'] === 'yearly' ? (int) $d['recurrence_month'] : null,
        ];
    }

    public function event(object $s, string $action, ?object $actor, ?array $details = null, ?string $expenseId = null): void
    {
        DB::table('recurring_expense_events')->insert([
            'id' => (string) Str::uuid(),
            'gym_id' => $s->gym_id,
            'recurring_expense_id' => $s->id,
            'expense_id' => $expenseId,
            'action' => $action,
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->full_name ?? null,
            'details' => $details !== null ? json_encode($details) : null,
            'created_at' => now(),
        ]);
    }

    private function ymd(mixed $d): string
    {
        return substr((string) $d, 0, 10);
    }
}
