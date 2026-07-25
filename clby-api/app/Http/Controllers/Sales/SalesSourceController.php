<?php

namespace App\Http\Controllers\Sales;

use App\Enums\Sales\LeadScore;
use App\Http\Controllers\Controller;
use App\Models\Sales\SalesLeadSource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SalesSourceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        SalesLeadSource::seedDefaults($request->user()->gym_id);

        $sources = SalesLeadSource::where('gym_id', $request->user()->gym_id)
            ->orderBy('sort')->orderBy('name')->get();

        return response()->json(['data' => $sources]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'gym_admin') {
            return response()->json(['error' => 'Only gym admins manage lead sources.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'default_score' => ['sometimes', Rule::enum(LeadScore::class)],
        ]);

        $exists = SalesLeadSource::where('gym_id', $request->user()->gym_id)
            ->whereRaw('LOWER(name) = ?', [strtolower($validated['name'])])->exists();
        if ($exists) {
            return response()->json(['error' => 'Source already exists.'], 409);
        }

        $source = SalesLeadSource::create([
            'gym_id' => $request->user()->gym_id,
            'name' => $validated['name'],
            'default_score' => $validated['default_score'] ?? 'warm',
            'sort' => 100,
        ]);

        return response()->json(['data' => $source], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($request->user()->role !== 'gym_admin') {
            return response()->json(['error' => 'Only gym admins manage lead sources.'], 403);
        }

        $source = SalesLeadSource::where('gym_id', $request->user()->gym_id)->find($id);
        if (! $source) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'default_score' => ['sometimes', Rule::enum(LeadScore::class)],
            'is_active' => 'sometimes|boolean',
            'sort' => 'sometimes|integer',
        ]);
        $source->update($validated);

        return response()->json(['data' => $source->fresh()]);
    }
}
