<?php

namespace App\Http\Controllers;

use App\Services\PushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    public function __construct(private PushService $push) {}

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

        // Fan out push to all gym members with a registered FCM token.
        // Best-effort: if push isn't configured the service no-ops.
        $recipients = DB::table('profiles')
            ->where('gym_id', $gymId)
            ->where('role', 'member')
            ->whereNotNull('fcm_token')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->pluck('id');

        if ($recipients->isNotEmpty()) {
            $this->push->sendToUsers(
                $recipients,
                $validated['title'],
                $validated['body'],
                ['type' => 'gym_announcement', 'gym_id' => $gymId, 'notification_id' => $data['id']],
            );
        }

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
