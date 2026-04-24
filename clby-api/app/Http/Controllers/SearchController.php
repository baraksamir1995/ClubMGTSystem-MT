<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
    /**
     * Global search across plans, trainers, offers, programs, and classes.
     */
    public function index(Request $request): JsonResponse
    {
        $query = $request->query('q', '');
        if (mb_strlen($query) < 2) {
            return response()->json(['data' => []]);
        }

        $gymId = $request->user()->gym_id;
        $like = '%' . $query . '%';
        $results = [];

        // Search plans
        $plans = DB::table('membership_plans')
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->where('name', 'ilike', $like)
            ->select('id', 'name', DB::raw("'plan' as type"), 'price', 'currency')
            ->limit(5)
            ->get();
        foreach ($plans as $p) {
            $results[] = (array) $p;
        }

        // Search trainers
        $trainers = DB::table('trainer_profiles')
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->where('name', 'ilike', $like)
            ->select('id', 'name', DB::raw("'trainer' as type"), 'photo_url', 'trainer_type')
            ->limit(5)
            ->get();
        foreach ($trainers as $t) {
            $results[] = (array) $t;
        }

        // Search classes
        $classes = DB::table('classes')
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->where('name', 'ilike', $like)
            ->select('id', 'name', DB::raw("'class' as type"), 'class_type', 'instructor')
            ->limit(5)
            ->get();
        foreach ($classes as $c) {
            $results[] = (array) $c;
        }

        // Search offers
        $offers = DB::table('gym_offers')
            ->where('gym_id', $gymId)
            ->where('status', 'active')
            ->where('title', 'ilike', $like)
            ->select('id', 'title as name', DB::raw("'offer' as type"))
            ->limit(5)
            ->get();
        foreach ($offers as $o) {
            $results[] = (array) $o;
        }

        // Search programs
        $programs = DB::table('gym_programs')
            ->where('gym_id', $gymId)
            ->where('status', 'active')
            ->where('title', 'ilike', $like)
            ->select('id', 'title as name', DB::raw("'program' as type"))
            ->limit(5)
            ->get();
        foreach ($programs as $p) {
            $results[] = (array) $p;
        }

        return response()->json(['data' => $results]);
    }
}
