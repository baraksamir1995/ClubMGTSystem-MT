<?php

namespace App\Http\Controllers;

use App\Services\PushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PushController extends Controller
{
    public function __construct(private PushService $push) {}

    /**
     * Send a test push to a single user. Admin-scoped (super-admin or
     * gym-admin within their own gym).
     */
    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|uuid',
            'title'   => 'required|string|max:200',
            'body'    => 'required|string|max:500',
        ]);

        if (! $this->push->isConfigured()) {
            return response()->json([
                'message' => 'Push service not configured (FIREBASE_CREDENTIALS missing).',
            ], 503);
        }

        $caller = $request->user();
        $target = DB::table('profiles')->where('id', $validated['user_id'])->first();
        if (! $target) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        // Gym admins can only push to users in their own gym; super-admins push anywhere.
        if ($caller->role !== 'super_admin' && $target->gym_id !== $caller->gym_id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! $target->fcm_token) {
            return response()->json([
                'message' => 'Target user has no FCM token (they need to open the app and grant notification permission).',
            ], 422);
        }

        $ok = $this->push->sendToUser(
            $validated['user_id'],
            $validated['title'],
            $validated['body'],
            ['type' => 'test'],
        );

        return response()->json([
            'sent' => $ok,
            'message' => $ok ? 'Push sent.' : 'Push send failed (check Laravel log).',
        ], $ok ? 200 : 500);
    }
}
