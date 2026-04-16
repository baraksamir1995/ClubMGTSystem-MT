<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $notifs = DB::table('gym_notifications')
            ->where('gym_id', $gymId)
            ->orderBy('created_at', 'desc')
            ->get();
        return response()->json(['data' => $notifs]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string',
            'target_audience' => 'nullable|string',
        ]);

        $gymId = $request->user()->gym_id;
        $data = $validated;
        $data['id'] = Str::uuid()->toString();
        $data['gym_id'] = $gymId;
        $data['created_at'] = now();
        $data['updated_at'] = now();

        DB::table('gym_notifications')->insert($data);

        // Return the full row (includes DB defaults like status)
        $row = DB::table('gym_notifications')->where('id', $data['id'])->first();
        return response()->json(['data' => $row], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $data = $request->except(['id', 'gym_id', 'created_at']);
        $data['updated_at'] = now();
        DB::table('gym_notifications')->where('id', $id)->where('gym_id', $gymId)->update($data);
        return response()->json(['message' => 'Updated']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        DB::table('gym_notifications')->where('id', $id)->where('gym_id', $gymId)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
