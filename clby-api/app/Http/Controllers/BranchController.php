<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BranchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $branches = Branch::where('gym_id', $gymId)->orderBy('created_at', 'desc')->get();
        return response()->json(['data' => $branches]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'nullable|string|max:500',
            'image_url' => 'nullable|string',
            'maps_url' => 'nullable|string',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;
        $branch = Branch::create($validated);

        return response()->json(['data' => $branch], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $branch = Branch::where('gym_id', $gymId)->findOrFail($id);
        $branch->update($request->only(['name', 'address', 'is_active', 'image_url', 'maps_url']));
        return response()->json(['data' => $branch]);
    }

    public function getQrToken(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $branch = Branch::where('gym_id', $gymId)->findOrFail($id);
        return response()->json(['data' => ['qr_token' => $branch->qr_token]]);
    }

    public function uploadImage(Request $request, string $id, \App\Services\StorageService $storage): JsonResponse
    {
        $request->validate(['file' => 'required|image|max:5120']);

        $gymId = $request->user()->gym_id;
        $branch = Branch::where('gym_id', $gymId)->findOrFail($id);
        $result = $storage->upload($request->file('file'), 'branches', $gymId);

        $branch->update(['image_url' => $result['url']]);

        return response()->json(['image_url' => $result['url']]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        Branch::where('gym_id', $gymId)->findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
