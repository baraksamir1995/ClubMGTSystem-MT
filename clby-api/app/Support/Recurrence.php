<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Pure date math for a recurring-expense schedule. No database, no clock:
 * every method takes the dates it works on, so it is trivially testable.
 *
 * Rules (see docs/recurring-expenses.md):
 *   - weekly:    every `interval` weeks on ISO weekday `day` (1 Mon – 7 Sun),
 *                first occurrence = first such weekday on/after start_date.
 *   - monthly:   every `interval` months on day-of-month `day`.
 *   - quarterly: every 3×`interval` months on day-of-month `day`.
 *   - yearly:    every `interval` years on `month`/`day`.
 *   Month-based periods are anchored on start_date's month (yearly: on
 *   start_date's year); a candidate before start_date is dropped, so the
 *   first occurrence is the first period date on/after start_date.
 *
 * Month-end fallback: a day that doesn't exist in a month is clamped to
 * that month's last day (31 → 30 Apr / 28 or 29 Feb; 29 Feb yearly → 28
 * Feb in non-leap years). Each date is computed from the anchor, never
 * from the previous occurrence, so a clamp never drifts the schedule:
 * day 31 gives 31 Jan, 28 Feb, 31 Mar, 30 Apr, …
 */
final class Recurrence
{
    public const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'];

    /** Upper bound on dates returned by one between() call. */
    public const MAX_DATES = 1000;

    private CarbonImmutable $start;
    private ?CarbonImmutable $end;

    public function __construct(
        public readonly string $frequency,
        public readonly int $interval,
        string $startDate,
        ?string $endDate,
        public readonly int $day,
        public readonly ?int $month = null,
    ) {
        if (! in_array($frequency, self::FREQUENCIES, true)) {
            throw new \InvalidArgumentException("Unknown frequency {$frequency}");
        }
        if ($interval < 1) {
            throw new \InvalidArgumentException('Interval must be >= 1');
        }
        $this->start = CarbonImmutable::parse($startDate, 'UTC')->startOfDay();
        $this->end = $endDate ? CarbonImmutable::parse($endDate, 'UTC')->startOfDay() : null;
    }

    /** Build from a recurring_expenses row / model. */
    public static function for(object $s): self
    {
        return new self(
            $s->frequency,
            (int) $s->interval,
            substr((string) $s->start_date, 0, 10),
            $s->end_date ? substr((string) $s->end_date, 0, 10) : null,
            (int) $s->recurrence_day,
            $s->recurrence_month !== null ? (int) $s->recurrence_month : null,
        );
    }

    /**
     * Scheduled dates in [$from, $to] (inclusive Y-m-d), clipped to the
     * schedule's own start/end, ascending.
     *
     * @return list<string>
     */
    public function between(string $from, string $to, int $limit = self::MAX_DATES): array
    {
        $lo = CarbonImmutable::parse($from, 'UTC')->startOfDay();
        $hi = CarbonImmutable::parse($to, 'UTC')->startOfDay();
        if ($lo->lt($this->start)) {
            $lo = $this->start;
        }
        if ($this->end && $hi->gt($this->end)) {
            $hi = $this->end;
        }
        if ($lo->gt($hi)) {
            return [];
        }

        $out = [];
        // Start a period or two before $lo so the scan is O(range), not
        // O(age of schedule); dates before $lo are skipped below.
        for ($k = max(0, $this->periodIndexNear($lo) - 1); count($out) < $limit; $k++) {
            $d = $this->nth($k);
            if ($d->gt($hi)) {
                break;
            }
            if ($d->gte($lo) && $d->gte($this->start)) {
                $out[] = $d->toDateString();
            }
        }

        return $out;
    }

    /** First scheduled date on/after $date, or null when the schedule has ended by then. */
    public function nextOnOrAfter(string $date): ?string
    {
        $lo = CarbonImmutable::parse($date, 'UTC')->startOfDay();
        if ($lo->lt($this->start)) {
            $lo = $this->start;
        }
        for ($k = max(0, $this->periodIndexNear($lo) - 1); ; $k++) {
            $d = $this->nth($k);
            if ($this->end && $d->gt($this->end)) {
                return null;
            }
            if ($d->gte($lo) && $d->gte($this->start)) {
                return $d->toDateString();
            }
        }
    }

    /** Whether $date is one of the schedule's dates. */
    public function occursOn(string $date): bool
    {
        return $this->between($date, $date, 1) === [$date];
    }

    /** Next `$n` scheduled dates on/after $date. @return list<string> */
    public function next(string $date, int $n): array
    {
        $out = [];
        $cursor = $date;
        while (count($out) < $n && ($d = $this->nextOnOrAfter($cursor)) !== null) {
            $out[] = $d;
            $cursor = CarbonImmutable::parse($d, 'UTC')->addDay()->toDateString();
        }

        return $out;
    }

    // ─── Internals ───────────────────────────────────────────────────────

    private function stepMonths(): int
    {
        return match ($this->frequency) {
            'monthly' => $this->interval,
            'quarterly' => 3 * $this->interval,
            'yearly' => 12 * $this->interval,
            default => 0,
        };
    }

    /** The k-th candidate date (k = 0 is the anchor period). May precede start. */
    private function nth(int $k): CarbonImmutable
    {
        if ($this->frequency === 'weekly') {
            // First matching weekday on/after start, then whole weeks.
            $offset = ($this->day - $this->start->dayOfWeekIso + 7) % 7;

            return $this->start->addDays($offset + $k * 7 * $this->interval);
        }

        if ($this->frequency === 'yearly') {
            $monthStart = CarbonImmutable::create($this->start->year + $k * $this->interval, $this->month ?? $this->start->month, 1, 0, 0, 0, 'UTC');
        } else {
            $monthStart = $this->start->startOfMonth()->addMonthsNoOverflow($k * $this->stepMonths());
        }

        return $monthStart->day(min($this->day, $monthStart->daysInMonth));
    }

    /** A period index whose date is at or just before $d (never negative). */
    private function periodIndexNear(CarbonImmutable $d): int
    {
        if ($this->frequency === 'weekly') {
            $days = (int) $this->start->diffInDays($d, false);

            return max(0, intdiv(max(0, $days), 7 * $this->interval));
        }
        $months = ($d->year - $this->start->year) * 12 + ($d->month - $this->start->month);

        return max(0, intdiv(max(0, $months), $this->stepMonths()));
    }
}
