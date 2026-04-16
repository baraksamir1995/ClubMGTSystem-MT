<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ClassTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $types = DB::table('class_types')
            ->where('gym_id', $gymId)
            ->orderBy('name')
            ->get();
        return response()->json(['data' => $types]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
        ]);

        $gymId = $request->user()->gym_id;
        $id = Str::uuid()->toString();

        DB::table('class_types')->insert([
            'id' => $id,
            'gym_id' => $gymId,
            'name' => $validated['name'],
            'created_at' => now(),
        ]);

        return response()->json(['id' => $id, 'name' => $validated['name']], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        DB::table('class_types')->where('id', $id)->where('gym_id', $gymId)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
