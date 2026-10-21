<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Single definition of "revenue" for a gym over a period — used by the
 * dashboard's This Month Revenue card and Payments → Financial Overview, so
 * the two can never disagree.
 *
 * Revenue = money collected in the period minus money refunded in the
 * period.
 *   - Collected: paid / refunded / partially refunded rows (gross `amount`),
 *     bucketed by the gym-local date the money was paid (paid_at, falling
 *     back to created_at for legacy rows). A refunded row still counts as
 *     collected — the refund is subtracted separately.
 *   - Refunded: `refunded_amount`, bucketed by the gym-local refund date,
 *     so a refund lowers the month it happened in and never rewrites an
 *     earlier, already-reported month.
 *   - Pending / overdue / failed rows never count.
 *
 * Caveat: payments keep only a running refunded_amount and the *latest*
 * refunded_at, so a payment refunded in several instalments across months
 * attributes all of it to the latest one. Exact per-refund timing would
 * need a refunds ledger.
 *
 * Only rows in `$currency` are summed — amounts in different currencies
 * can't be added. `excludedCurrencies()` reports anything left out.
 */
class Revenue
{
    private const COLLECTED = ['paid', 'refunded', 'partial_refund'];

    /** @param string $from,$to inclusive gym-local Y-m-d dates */
    public static function between(string $gymId, string $from, string $to, string $tz, string $currency): float
    {
        $row = DB::selectOne(<<<'SQL'
            SELECT
                coalesce(sum(amount) FILTER (
                    WHERE status IN ('paid', 'refunded', 'partial_refund')
                      AND (coalesce(paid_at, created_at) AT TIME ZONE ?)::date BETWEEN ?::date AND ?::date
                ), 0) AS collected,
                coalesce(sum(refunded_amount) FILTER (
                    WHERE status IN ('refunded', 'partial_refund')
                      AND (coalesce(refunded_at, paid_at, created_at) AT TIME ZONE ?)::date BETWEEN ?::date AND ?::date
                ), 0) AS refunded
            FROM payments
            WHERE gym_id = ? AND currency = ?
        SQL, [$tz, $from, $to, $tz, $from, $to, $gymId, $currency]);

        return round((float) $row->collected - (float) $row->refunded, 2);
    }

    /** All-time collected revenue, net of refunds. */
    public static function allTime(string $gymId, string $currency): float
    {
        return round((float) DB::table('payments')
            ->where('gym_id', $gymId)
            ->where('currency', $currency)
            ->whereIn('status', self::COLLECTED)
            ->sum(DB::raw('amount - coalesce(refunded_amount, 0)')), 2);
    }

    /**
     * Other currencies collected in the period, which between() left out.
     *
     * @return list<string>
     */
    public static function excludedCurrencies(string $gymId, string $from, string $to, string $tz, string $currency): array
    {
        return DB::table('payments')
            ->where('gym_id', $gymId)
            ->where('currency', '!=', $currency)
            ->whereIn('status', self::COLLECTED)
            ->whereRaw('(coalesce(paid_at, created_at) AT TIME ZONE ?)::date BETWEEN ?::date AND ?::date', [$tz, $from, $to])
            ->distinct()
            ->pluck('currency')
            ->all();
    }

    /**
     * Gyms have no currency setting of their own; payments carry it per
     * row. Use the gym's most recent payment currency, falling back to the
     * EGP default the rest of the admin assumes.
     */
    public static function gymCurrency(string $gymId): string
    {
        return DB::table('payments')
            ->where('gym_id', $gymId)
            ->orderByDesc('created_at')
            ->value('currency') ?: 'EGP';
    }

    public static function gymTimezone(string $gymId): string
    {
        return DB::table('gyms')->where('id', $gymId)->value('timezone') ?: 'UTC';
    }
}
