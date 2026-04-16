<?php

namespace App\Http\Controllers;

use App\Models\ScheduleSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use \App\Traits\LogsActivity;

class ScheduleController extends Controller
{
    use LogsActivity;
    public function settings(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $settings = ScheduleSetting::where('gym_id', $gymId)->first();

        return response()->json(['data' => $settings]);
    }

    public function publish(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        DB::transaction(function () use ($gymId) {
            // Mark all future non-cancelled sessions as published
            DB::table('class_sessions')
                ->where('gym_id', $gymId)
                ->where('session_date', '>=', now()->toDateString())
                ->where('status', '!=', 'cancelled')
                ->update(['is_published' => true]);

            // Update schedule settings
            DB::table('schedule_settings')->updateOrInsert(
                ['gym_id' => $gymId],
                ['is_published' => true, 'published_at' => now(), 'last_updated_at' => now()],
            );
        });

        return response()->json(['message' => 'Schedule published successfully']);
    }

    public function unpublish(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        DB::table('schedule_settings')->updateOrInsert(
            ['gym_id' => $gymId],
            ['is_published' => false, 'last_updated_at' => now()],
        );

        return response()->json(['message' => 'Schedule unpublished successfully']);
    }
}
