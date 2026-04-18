<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeadController extends Controller
{
    /**
     * Public endpoint — receives landing page lead submissions.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:30',
            'gymName' => 'required|string|max:255',
            'branches' => 'nullable|integer|min:1',
            'notes' => 'nullable|string|max:2000',
            'source' => 'nullable|string|max:100',
            'userAgent' => 'nullable|string|max:500',
        ]);

        DB::table('landing_leads')->insert([
            'id' => Str::uuid()->toString(),
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'gym_name' => $validated['gymName'],
            'branches' => $validated['branches'] ?? 1,
            'notes' => $validated['notes'] ?? null,
            'source' => $validated['source'] ?? 'landing-hero',
            'user_agent' => $validated['userAgent'] ?? null,
            'contacted' => false,
            'created_at' => now(),
        ]);

        return response()->json(['ok' => true], 201);
    }

    /**
     * Super-admin: list all leads.
     */
    public function index(Request $request): JsonResponse
    {
        $query = DB::table('landing_leads')->orderBy('created_at', 'desc');

        if ($request->query('contacted') !== null) {
            $query->where('contacted', $request->query('contacted') === 'true');
        }
        if ($request->query('search')) {
            $s = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($s) {
                $q->where('name', 'ilike', $s)
                    ->orWhere('phone', 'ilike', $s)
                    ->orWhere('gym_name', 'ilike', $s);
            });
        }

        $leads = $query->get();
        return response()->json(['data' => $leads]);
    }

    /**
     * Super-admin: toggle contacted status.
     */
    public function toggleContacted(string $id): JsonResponse
    {
        $lead = DB::table('landing_leads')->where('id', $id)->first();
        if (!$lead) return response()->json(['error' => 'Not found'], 404);

        DB::table('landing_leads')->where('id', $id)->update([
            'contacted' => !$lead->contacted,
        ]);

        return response()->json(['data' => DB::table('landing_leads')->where('id', $id)->first()]);
    }

    /**
     * Super-admin: delete a lead.
     */
    public function destroy(string $id): JsonResponse
    {
        $lead = DB::table('landing_leads')->where('id', $id)->first();
        if (!$lead) return response()->json(['error' => 'Not found'], 404);

        DB::table('landing_leads')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
