<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * GET /analytics/all?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Returns { members, revenue, classes } aggregated data.
     */
    public function all(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['members' => [], 'revenue' => [], 'classes' => []]);
        }

        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $from = $request->query('from', now()->subDays(90)->toDateString());
        $to = $request->query('to', now()->toDateString());

        return response()->json([
            'members' => $this->memberAnalytics($gymId, $from, $to),
            'revenue' => $this->revenueAnalytics($gymId, $from, $to),
            'classes' => $this->classAnalytics($gymId, $from, $to),
        ]);
    }

    /**
     * GET /analytics/dashboard?period=30|90|180|365
     */
    public function dashboard(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => null]);
        }

        $period = (int) $request->query('period', 30);
        $from = now()->subDays($period)->toDateString();
        $to = now()->toDateString();

        $activeMembers = DB::table('gym_members')
            ->where('gym_id', $gymId)->whereNull('deleted_at')->where('status', 'active')->count();

        $newMembers = DB::table('gym_members')
            ->where('gym_id', $gymId)->whereNull('deleted_at')
            ->where('joined_at', '>=', $from)->count();

        $revenue = DB::table('payments')
            ->where('gym_id', $gymId)->where('status', 'paid')
            ->where('created_at', '>=', $from)->sum('amount');

        $currency = DB::table('payments')
            ->where('gym_id', $gymId)->value('currency') ?? 'EGP';

        $checkins = DB::table('attendance_logs')
            ->where('gym_id', $gymId)
            ->where('check_in_at', '>=', $from)->count();

        $sessions = DB::table('class_sessions')
            ->where('gym_id', $gymId)
            ->where('session_date', '>=', $from)
            ->where('session_date', '<=', $to)->count();

        $totalBookings = DB::table('session_bookings')
            ->join('class_sessions', 'class_sessions.id', '=', 'session_bookings.session_id')
            ->where('class_sessions.gym_id', $gymId)
            ->where('session_bookings.created_at', '>=', $from)->count();

        // Timeline: daily aggregation
        $timeline = DB::select("
            SELECT d::date as date,
                COALESCE((SELECT SUM(amount) FROM payments WHERE gym_id = ? AND status = 'paid' AND created_at::date = d::date), 0) as revenue,
                COALESCE((SELECT COUNT(*) FROM attendance_logs WHERE gym_id = ? AND check_in_at::date = d::date), 0) as checkins,
                COALESCE((SELECT COUNT(*) FROM gym_members WHERE gym_id = ? AND joined_at::date = d::date AND deleted_at IS NULL), 0) as new_members
            FROM generate_series(?::date, ?::date, '1 day') d
            ORDER BY d
        ", [$gymId, $gymId, $gymId, $from, $to]);

        return response()->json([
            'period' => "{$period}d",
            'fromDate' => $from,
            'toDate' => $to,
            'kpis' => [
                'activeMembers' => $activeMembers,
                'newMembers' => $newMembers,
                'revenue' => (float) $revenue,
                'currency' => $currency,
                'checkins' => $checkins,
                'sessions' => $sessions,
                'totalBookings' => $totalBookings,
            ],
            'timeline' => array_map(fn ($r) => [
                'date' => $r->date,
                'revenue' => (float) $r->revenue,
                'checkins' => (int) $r->checkins,
                'newMembers' => (int) $r->new_members,
            ], $timeline),
        ]);
    }

    private function memberAnalytics(string $gymId, string $from, string $to): array
    {
        $activeAtStart = DB::table('gym_members')
            ->where('gym_id', $gymId)->whereNull('deleted_at')
            ->where('joined_at', '<', $from)->count();

        $timeline = DB::select("
            SELECT TO_CHAR(d, 'YYYY-MM') as month,
                COALESCE((SELECT COUNT(*) FROM gym_members WHERE gym_id = ? AND joined_at::date >= d::date AND joined_at::date < (d + interval '1 month')::date AND deleted_at IS NULL), 0) as new_members,
                COALESCE((SELECT COUNT(*) FROM gym_members WHERE gym_id = ? AND deleted_at IS NOT NULL AND deleted_at::date >= d::date AND deleted_at::date < (d + interval '1 month')::date), 0) as cancellations
            FROM generate_series(date_trunc('month', ?::date), date_trunc('month', ?::date), '1 month') d
            ORDER BY d
        ", [$gymId, $gymId, $from, $to]);

        $totalNew = array_sum(array_map(fn ($r) => (int) $r->new_members, $timeline));
        $totalChurned = array_sum(array_map(fn ($r) => (int) $r->cancellations, $timeline));
        $churnRate = $activeAtStart > 0 ? round($totalChurned / $activeAtStart * 100, 1) : 0;

        return [
            'timeline' => array_map(fn ($r) => [
                'month' => $r->month,
                'new_members' => (int) $r->new_members,
                'cancellations' => (int) $r->cancellations,
            ], $timeline),
            'totalNew' => $totalNew,
            'totalChurned' => $totalChurned,
            'activeAtStart' => $activeAtStart,
            'churnRate' => $churnRate,
        ];
    }

    private function revenueAnalytics(string $gymId, string $from, string $to): array
    {
        $currency = DB::table('payments')->where('gym_id', $gymId)->value('currency') ?? 'EGP';

        $totalRevenue = (float) DB::table('payments')
            ->where('gym_id', $gymId)->where('status', 'paid')
            ->where('created_at', '>=', $from)->sum('amount');

        $totalOverdue = (float) DB::table('payments')
            ->where('gym_id', $gymId)->where('status', 'overdue')
            ->where('created_at', '>=', $from)->sum('amount');

        $totalPending = (float) DB::table('payments')
            ->where('gym_id', $gymId)->where('status', 'pending')
            ->where('created_at', '>=', $from)->sum('amount');

        $paidCount = DB::table('payments')
            ->where('gym_id', $gymId)->where('status', 'paid')
            ->where('created_at', '>=', $from)->count();

        $overdueCount = DB::table('payments')
            ->where('gym_id', $gymId)->where('status', 'overdue')
            ->where('created_at', '>=', $from)->count();

        $byPlan = DB::table('payments')
            ->where('payments.gym_id', $gymId)->where('payments.status', 'paid')
            ->where('payments.created_at', '>=', $from)
            ->select('payments.service_name as plan', DB::raw('SUM(amount) as revenue'), DB::raw('COUNT(*) as count'))
            ->groupBy('payments.service_name')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($r) => ['plan' => $r->plan ?? 'Other', 'revenue' => (float) $r->revenue, 'count' => (int) $r->count])
            ->toArray();

        $timeline = DB::select("
            SELECT TO_CHAR(d, 'YYYY-MM') as month,
                COALESCE((SELECT SUM(amount) FROM payments WHERE gym_id = ? AND status = 'paid' AND created_at::date >= d::date AND created_at::date < (d + interval '1 month')::date), 0) as revenue
            FROM generate_series(date_trunc('month', ?::date), date_trunc('month', ?::date), '1 month') d
            ORDER BY d
        ", [$gymId, $from, $to]);

        return [
            'totalRevenue' => $totalRevenue,
            'totalOverdue' => $totalOverdue,
            'totalPending' => $totalPending,
            'currency' => $currency,
            'paidCount' => $paidCount,
            'overdueCount' => $overdueCount,
            'byPlan' => $byPlan,
            'timeline' => array_map(fn ($r) => ['month' => $r->month, 'revenue' => (float) $r->revenue], $timeline),
        ];
    }

    private function classAnalytics(string $gymId, string $from, string $to): array
    {
        $byClass = DB::table('class_sessions')
            ->join('classes', 'classes.id', '=', 'class_sessions.class_id')
            ->where('class_sessions.gym_id', $gymId)
            ->where('class_sessions.session_date', '>=', $from)
            ->where('class_sessions.session_date', '<=', $to)
            ->select(
                'classes.name', 'classes.class_type',
                DB::raw('COUNT(*) as sessions'),
                DB::raw('SUM(class_sessions.booked_count) as total_booked'),
                DB::raw('ROUND(AVG(class_sessions.booked_count), 1) as avg_booked'),
                DB::raw('CASE WHEN SUM(class_sessions.capacity) > 0 THEN ROUND(SUM(class_sessions.booked_count)::numeric / SUM(class_sessions.capacity) * 100, 1) ELSE NULL END as booking_rate'),
            )
            ->groupBy('classes.name', 'classes.class_type')
            ->orderByDesc('sessions')
            ->get()
            ->map(fn ($r) => [
                'name' => $r->name, 'class_type' => $r->class_type,
                'sessions' => (int) $r->sessions, 'totalBooked' => (int) $r->total_booked,
                'avgBooked' => (float) $r->avg_booked, 'bookingRate' => $r->booking_rate ? (float) $r->booking_rate : null,
            ])
            ->toArray();

        $totalSessions = DB::table('class_sessions')
            ->where('gym_id', $gymId)
            ->where('session_date', '>=', $from)
            ->where('session_date', '<=', $to)->count();

        $totalBookings = DB::table('session_bookings')
            ->join('class_sessions', 'class_sessions.id', '=', 'session_bookings.session_id')
            ->where('class_sessions.gym_id', $gymId)
            ->where('class_sessions.session_date', '>=', $from)
            ->where('class_sessions.session_date', '<=', $to)
            ->where('session_bookings.status', '!=', 'cancelled')->count();

        // By day of week
        $byDay = DB::select("
            SELECT TO_CHAR(session_date, 'Dy') as day,
                COUNT(*) as sessions,
                SUM(booked_count) as booked,
                ROUND(AVG(booked_count), 1) as avg_booked
            FROM class_sessions
            WHERE gym_id = ? AND session_date >= ? AND session_date <= ?
            GROUP BY EXTRACT(ISODOW FROM session_date), TO_CHAR(session_date, 'Dy')
            ORDER BY EXTRACT(ISODOW FROM session_date)
        ", [$gymId, $from, $to]);

        // By hour
        $byHour = DB::select("
            SELECT TO_CHAR(start_time, 'HH24:00') as hour,
                COUNT(*) as sessions,
                SUM(booked_count) as booked,
                ROUND(AVG(booked_count), 1) as avg_booked
            FROM class_sessions
            WHERE gym_id = ? AND session_date >= ? AND session_date <= ?
            GROUP BY TO_CHAR(start_time, 'HH24:00')
            ORDER BY hour
        ", [$gymId, $from, $to]);

        return [
            'byClass' => $byClass,
            'byDay' => array_map(fn ($r) => ['day' => $r->day, 'sessions' => (int) $r->sessions, 'booked' => (int) $r->booked, 'avgBooked' => (float) $r->avg_booked], $byDay),
            'byHour' => array_map(fn ($r) => ['hour' => $r->hour, 'sessions' => (int) $r->sessions, 'booked' => (int) $r->booked, 'avgBooked' => (float) $r->avg_booked], $byHour),
            'totalSessions' => $totalSessions,
            'totalBookings' => $totalBookings,
        ];
    }
}
