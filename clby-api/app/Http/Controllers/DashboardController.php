<?php

namespace App\Http\Controllers;

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

        // Get revenue stats from PG function
        $result = DB::select('SELECT get_gym_dashboard_stats(?) AS data', [$gymId]);
        $revenueStats = json_decode($result[0]->data ?? '{}', true) ?? [];

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
            'total_revenue' => $revenueStats['total_revenue'] ?? 0,
            'month_revenue' => $revenueStats['month_revenue'] ?? 0,
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
