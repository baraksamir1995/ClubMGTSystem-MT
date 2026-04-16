<?php

namespace App\Http\Controllers;

use App\Models\Gym;
use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GymController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $gym = Gym::findOrFail($gymId);
        return response()->json($gym);
    }

    /**
     * Public gym info — used by registration screen before auth.
     * Only returns active, listed gyms (or the specific GYM_ID gym).
     */
    public function showPublic(string $id): JsonResponse
    {
        $gym = Gym::where('id', $id)
            ->where('is_active', true)
            ->first();

        if (! $gym) {
            return response()->json(['error' => 'Gym not found'], 404);
        }

        // Return only public-safe fields
        return response()->json([
            'id' => $gym->id,
            'name' => $gym->name,
            'description' => $gym->description,
            'address' => $gym->address,
            'city' => $gym->city,
            'country' => $gym->country,
            'phone' => $gym->phone,
            'email' => $gym->email,
            'website' => $gym->website,
            'logo_url' => $gym->logo_url,
            'cover_image_url' => $gym->cover_image_url,
            'branding_config' => $gym->branding_config,
            'category' => $gym->category,
            'services' => $gym->services,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $gym = Gym::findOrFail($gymId);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'address' => 'nullable|string|max:500',
            'city' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email',
            'website' => 'nullable|string|max:255',
            'timezone' => 'sometimes|string|max:50',
            'language' => 'sometimes|string|max:10',
            'branding_config' => 'nullable|array',
            'mobile_payments_enabled' => 'sometimes|boolean',
            'operating_hours' => 'nullable|array',
            'capacity_feature_enabled' => 'sometimes|boolean',
            'max_capacity' => 'sometimes|integer|min:1',
            'category' => 'nullable|string|max:50',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'services' => 'nullable|array',
            'is_listed' => 'sometimes|boolean',
        ]);

        $gym->update($validated);

        return response()->json(['data' => $gym]);
    }

    public function uploadLogo(Request $request, StorageService $storage): JsonResponse
    {
        $request->validate(['file' => 'required|image|max:2048']);

        $gymId = $request->user()->gym_id;
        $result = $storage->upload($request->file('file'), 'logos', $gymId);

        Gym::where('id', $gymId)->update(['logo_url' => $result['url']]);

        return response()->json(['data' => $result]);
    }
}
