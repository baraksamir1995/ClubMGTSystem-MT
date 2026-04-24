<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OfferController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $offers = DB::table('gym_offers')->where('gym_id', $gymId)->orderBy('created_at', 'desc')->get();

        // Decode jsonb columns
        $offers = $offers->map(fn ($o) => $this->decodeJsonb((array) $o));

        return response()->json(['data' => $offers]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $offer = DB::table('gym_offers')->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $offer) return response()->json(['error' => 'Not found'], 404);
        return response()->json($this->decodeJsonb((array) $offer));
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'short_description' => 'nullable|string|max:500',
            'full_description' => 'nullable|string',
            'offer_price' => 'required|numeric|min:0',
            'original_price' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:active,inactive,draft',
            'hero_image_url' => 'nullable|string|max:500',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'category' => 'nullable|string|max:100',
            'expires_at' => 'nullable|date',
            'session_count' => 'nullable|integer|min:0',
        ]);

        $gymId = $request->user()->gym_id;
        $data = $request->only([
            'title', 'description', 'short_description', 'full_description',
            'offer_price', 'original_price', 'status',
            'hero_image_url', 'storage_path', 'valid_from', 'valid_until',
            'plan_id', 'service_package_id', 'category', 'expires_at', 'terms',
            'tag_label', 'tag_color', 'cta_label', 'session_count',
            'linked_plan_id', 'linked_package_id',
        ]);

        // Encode arrays/objects to JSON for jsonb columns
        if (isset($data['terms']) && is_array($data['terms'])) {
            $data['terms'] = json_encode($data['terms']);
        }

        $data['id'] = Str::uuid()->toString();
        $data['gym_id'] = $gymId;
        $data['expires_at'] = $data['expires_at'] ?? $data['valid_until'] ?? now()->addYear()->toDateString();
        $data['created_at'] = now();
        $data['updated_at'] = now();
        DB::table('gym_offers')->insert($data);
        return response()->json($this->decodeJsonb($data), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $data = $request->only([
            'title', 'description', 'short_description', 'full_description',
            'offer_price', 'original_price', 'status',
            'hero_image_url', 'storage_path', 'valid_from', 'valid_until',
            'plan_id', 'service_package_id', 'category', 'expires_at', 'terms',
            'tag_label', 'tag_color', 'cta_label', 'session_count',
            'linked_plan_id', 'linked_package_id',
        ]);

        if (isset($data['terms']) && is_array($data['terms'])) {
            $data['terms'] = json_encode($data['terms']);
        }

        $data['updated_at'] = now();
        DB::table('gym_offers')->where('id', $id)->where('gym_id', $gymId)->update($data);

        $updated = DB::table('gym_offers')->where('id', $id)->first();
        return response()->json($updated ? $this->decodeJsonb((array) $updated) : ['message' => 'Updated']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        DB::table('gym_offers')->where('id', $id)->where('gym_id', $gymId)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Decode jsonb string columns to PHP arrays.
     */
    private function decodeJsonb(array $row): array
    {
        foreach (['terms'] as $col) {
            if (isset($row[$col]) && is_string($row[$col])) {
                $row[$col] = json_decode($row[$col], true) ?? [];
            } elseif (!isset($row[$col])) {
                $row[$col] = [];
            }
        }
        // Cast numeric string columns to floats for JSON serialization
        foreach (['offer_price', 'original_price'] as $col) {
            if (isset($row[$col])) {
                $row[$col] = (float) $row[$col];
            }
        }
        return $row;
    }
}
