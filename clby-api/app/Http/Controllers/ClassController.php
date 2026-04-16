<?php

namespace App\Http\Controllers;

use App\Models\ClassModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

use \App\Traits\LogsActivity;

class ClassController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $classes = ClassModel::where('gym_id', $gymId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $classes]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'class_type' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'instructor' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:20',
            'capacity' => 'nullable|integer|min:1',
            'image_url' => 'nullable|string',
            'branch_id' => 'nullable|uuid',
            'trainer_id' => 'nullable|uuid',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;

        $class = ClassModel::create($validated);

        return response()->json(['data' => $class], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $class = ClassModel::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'class_type' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'instructor' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:20',
            'capacity' => 'nullable|integer|min:1',
            'image_url' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
            'branch_id' => 'nullable|uuid',
            'trainer_id' => 'nullable|uuid',
        ]);

        $class->update($validated);

        return response()->json(['data' => $class]);
    }

    public function uploadImage(Request $request, \App\Services\StorageService $storage): JsonResponse
    {
        $request->validate(['file' => 'required|image|max:5120']);

        $gymId = $request->user()->gym_id;
        $result = $storage->upload($request->file('file'), 'classes', $gymId);

        return response()->json(['url' => $result['url']]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $class = ClassModel::where('gym_id', $gymId)->findOrFail($id);
        $class->update(['is_cancelled' => true, 'is_active' => false, 'cancelled_at' => now()]);

        return response()->json(['message' => 'Class deleted successfully']);
    }
}
