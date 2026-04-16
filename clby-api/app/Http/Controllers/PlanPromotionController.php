<?php

namespace App\Http\Controllers;

use App\Models\PlanPromotion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanPromotionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $promotions = PlanPromotion::where('gym_id', $gymId)
            ->with('plan:id,name,price,currency')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $promotions]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => 'required|uuid',
            'promo_price' => 'required|numeric|min:0',
            'valid_from' => 'required|date',
            'valid_until' => 'required|date|after:valid_from',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;

        $promotion = PlanPromotion::create($validated);

        return response()->json(['data' => $promotion], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $promotion = PlanPromotion::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'promo_price' => 'sometimes|numeric|min:0',
            'valid_from' => 'sometimes|date',
            'valid_until' => 'sometimes|date',
        ]);

        $promotion->update($validated);

        return response()->json(['data' => $promotion]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $promotion = PlanPromotion::where('gym_id', $gymId)->findOrFail($id);
        $promotion->delete();

        return response()->json(['message' => 'Plan promotion deleted successfully']);
    }
}
