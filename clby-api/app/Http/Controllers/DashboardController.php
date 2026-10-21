<?php

namespace App\Http\Controllers;

use App\Support\Revenue;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json([
                'total_members' => 0,
                'active_staff' => 0,
                'total_revenue' => 0,
                'month_revenue' => 0,
                'recent_payments' => [],
            ]);
        }

        // recent_payments still comes from the PG function. Its revenue
        // figures do not: it bucketed by created_at in the DB session's
        // timezone and dropped refunded / partially refunded rows outright,
        // so a pending invoice paid this month, a back-dated payment, or a
        // small partial refund all skewed "This Month Revenue". Both totals
        // now use the shared rule (same as Payments → Financial Overview).
        $result = DB::select('SELECT get_gym_dashboard_stats(?) AS data', [$gymId]);
        $revenueStats = json_decode($result[0]->data ?? '{}', true) ?? [];

        $tz = Revenue::gymTimezone($gymId);
        $currency = Revenue::gymCurrency($gymId);
        $now = CarbonImmutable::now($tz);
        $monthRevenue = Revenue::between(
            $gymId,
            $now->startOfMonth()->toDateString(),
            $now->endOfMonth()->toDateString(),
            $tz,
            $currency,
        );

        // Get member count
        $memberCount = DB::table('gym_members')
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->count();

        // Get active staff count
        $staffCount = DB::table('staff_members')
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->where('status', 'active')
            ->count();

        return response()->json([
            'total_members' => $memberCount,
            'active_staff' => $staffCount,
            'total_revenue' => Revenue::allTime($gymId, $currency),
            'month_revenue' => $monthRevenue,
            // The dashboard formats both totals with this; it was never
            // returned before, so the page always fell back to EGP.
            'currency' => $currency,
            'recent_payments' => $revenueStats['recent_payments'] ?? [],
        ]);
    }

    public function capacity(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => null]);
        }

        $result = DB::select('SELECT get_gym_capacity(?) AS data', [$gymId]);

        return response()->json(
            json_decode($result[0]->data ?? '{}', true) ?? [],
        );
    }
}
