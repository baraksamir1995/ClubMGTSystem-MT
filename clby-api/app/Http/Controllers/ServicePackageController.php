<?php

namespace App\Http\Controllers;

use App\Models\ServiceSessionPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServicePackageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $query = ServiceSessionPackage::where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->where('is_active', true);

        if ($trainerType = $request->query('trainer_type')) {
            $query->where('trainer_type', $trainerType);
        }

        $packages = $query->orderBy('created_at', 'desc')->get();
        return response()->json(['data' => $packages]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'trainer_type' => 'nullable|string|max:50',
            'session_count' => 'nullable|integer|min:1',
            'price' => 'nullable|numeric|min:0',
            'currency' => 'sometimes|string|max:5',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;
        $pkg = ServiceSessionPackage::create($validated);

        return response()->json(['data' => $pkg], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $pkg = ServiceSessionPackage::where('gym_id', $gymId)->findOrFail($id);
        $pkg->update($request->only(['name', 'trainer_type', 'session_count', 'price', 'currency', 'description', 'is_active']));
        return response()->json(['data' => $pkg]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        ServiceSessionPackage::where('gym_id', $gymId)->findOrFail($id)->update(['deleted_at' => now()]);
        return response()->json(['message' => 'Deleted']);
    }
}
