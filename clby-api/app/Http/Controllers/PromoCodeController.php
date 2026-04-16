<?php

namespace App\Http\Controllers;

use App\Models\PromoCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use \App\Traits\LogsActivity;

class PromoCodeController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => []]);
        }

        $promos = PromoCode::where('gym_id', $gymId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $promos]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:50',
            'name' => 'required|string|max:255',
            'discount_type' => 'required|string|in:percentage,fixed',
            'discount_value' => 'required|numeric|min:0',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'max_uses' => 'nullable|integer|min:1',
            'max_uses_per_member' => 'nullable|integer|min:1',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;

        if (!$validated['gym_id']) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $validated['per_member_limit'] = $validated['max_uses_per_member'] ?? 1;
        unset($validated['max_uses_per_member']);

        $promo = PromoCode::create($validated);

        return response()->json(['data' => $promo], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $promo = PromoCode::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'code' => 'sometimes|string|max:50',
            'name' => 'sometimes|string|max:255',
            'discount_type' => 'sometimes|string|in:percentage,fixed',
            'discount_value' => 'sometimes|numeric|min:0',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'max_uses' => 'nullable|integer|min:1',
            'per_member_limit' => 'nullable|integer|min:1',
            'is_active' => 'sometimes|boolean',
        ]);

        $promo->update($validated);

        return response()->json(['data' => $promo]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $promo = PromoCode::where('gym_id', $gymId)->findOrFail($id);
        $promo->delete();

        return response()->json(['message' => 'Promo code deleted successfully']);
    }

    public function validate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string',
            'amount' => 'required|numeric|min:0',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $result = DB::select('SELECT validate_promo_code(?, ?, ?) AS data', [
            $gymId,
            $validated['code'],
            $validated['amount'],
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    public function redemptions(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => []]);
        }

        $results = DB::select('SELECT * FROM get_promo_redemptions(?, ?)', [$id, $gymId]);

        return response()->json(['data' => $results]);
    }
}
