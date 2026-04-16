<?php

namespace App\Http\Controllers;

use App\Models\Studio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudioController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $studios = Studio::where('gym_id', $gymId)->with('branch:id,name')->get();
        return response()->json(['data' => $studios]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => 'required|uuid',
            'name' => 'required|string|max:255',
            'capacity' => 'nullable|integer|min:1',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;
        $studio = Studio::create($validated);

        return response()->json(['data' => $studio], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $studio = Studio::where('gym_id', $gymId)->with('branch:id,name')->findOrFail($id);
        return response()->json(['data' => $studio]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $studio = Studio::where('gym_id', $gymId)->findOrFail($id);
        $studio->update($request->only(['name', 'capacity', 'branch_id']));
        return response()->json(['data' => $studio]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        Studio::where('gym_id', $gymId)->findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
