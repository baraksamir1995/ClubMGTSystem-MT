<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SessionTransferController extends Controller
{
    /**
     * Lookup a member in the same gym by phone number.
     * Returns minimal public info only (full_name, photo_url).
     */
    public function lookup(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string|max:20',
        ]);

        $user = $request->user();
        $gymId = $user->gym_id;

        $row = DB::table('profiles as p')
            ->join('gym_members as gm', 'gm.user_id', '=', 'p.id')
            ->where('p.phone', $validated['phone'])
            ->where('gm.gym_id', $gymId)
            ->whereNull('gm.deleted_at')
            ->select('p.full_name', 'p.photo_url', 'gm.id as gym_member_id', 'p.id as user_id')
            ->first();

        if (! $row || $row->user_id === $user->id) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        return response()->json([
            'data' => [
                'gym_member_id' => $row->gym_member_id,
                'full_name' => $row->full_name,
                'photo_url' => $row->photo_url,
            ],
        ]);
    }

    /**
     * Transfer N sessions from caller's active session-capable membership
     * to a recipient identified by phone. Atomic via PG function.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string|max:20',
            'count' => 'required|integer|min:1',
        ]);

        $user = $request->user();

        Log::info('session_transfer.attempt', [
            'sender_user_id'  => $user->id,
            'sender_email'    => $user->email,
            'gym_id'          => $user->gym_id,
            'recipient_phone' => $validated['phone'],
            'count'           => $validated['count'],
        ]);

        try {
            $result = DB::select(
                'SELECT transfer_sessions(?, ?, ?, ?) AS data',
                [$user->id, $user->gym_id, $validated['phone'], $validated['count']]
            );
        } catch (\Throwable $e) {
            Log::error('session_transfer.exception', [
                'sender_user_id' => $user->id,
                'message'        => $e->getMessage(),
                'sql_state'      => method_exists($e, 'getCode') ? $e->getCode() : null,
            ]);
            return response()->json([
                'message' => 'transfer_internal_error',
                'error'   => 'transfer_internal_error',
                'detail'  => $e->getMessage(),
            ], 500);
        }

        $payload = json_decode($result[0]->data, true);

        if (($payload['status'] ?? '') !== 'ok') {
            $reason = $payload['reason'] ?? 'transfer_failed';
            Log::warning('session_transfer.failed', [
                'sender_user_id' => $user->id,
                'reason'         => $reason,
                'payload'        => $payload,
            ]);
            // Mirror reason into `message` so mobile clients (which read
            // body.message in api_service._parse) can map it to a friendly
            // error string. Keep `error` for any callers that still rely on
            // it.
            return response()->json([
                'message' => $reason,
                'error'   => $reason,
                'details' => $payload,
            ], 422);
        }

        Log::info('session_transfer.ok', [
            'sender_user_id' => $user->id,
            'transfer_id'    => $payload['transfer_id'] ?? null,
            'count'          => $payload['count'] ?? null,
            'receiver'       => $payload['receiver_full_name'] ?? null,
        ]);

        return response()->json(['data' => $payload], 201);
    }

    /**
     * List the caller's own transfer history (sent + received).
     */
    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();

        $gymMember = DB::table('gym_members')
            ->where('user_id', $user->id)
            ->where('gym_id', $user->gym_id)
            ->first();

        if (! $gymMember) {
            return response()->json(['data' => ['sent' => [], 'received' => []]]);
        }

        $sent = DB::table('session_transfers as st')
            ->join('gym_members as gm', 'gm.id', '=', 'st.receiver_gym_member_id')
            ->join('profiles as p', 'p.id', '=', 'gm.user_id')
            ->where('st.sender_gym_member_id', $gymMember->id)
            ->orderByDesc('st.created_at')
            ->select('st.id', 'st.count', 'st.created_at', 'p.full_name as other_name', 'p.photo_url as other_photo')
            ->get();

        $received = DB::table('session_transfers as st')
            ->join('gym_members as gm', 'gm.id', '=', 'st.sender_gym_member_id')
            ->join('profiles as p', 'p.id', '=', 'gm.user_id')
            ->where('st.receiver_gym_member_id', $gymMember->id)
            ->orderByDesc('st.created_at')
            ->select('st.id', 'st.count', 'st.created_at', 'p.full_name as other_name', 'p.photo_url as other_photo')
            ->get();

        return response()->json(['data' => ['sent' => $sent, 'received' => $received]]);
    }

    /**
     * Admin: list a specific member's transfer history (sent + received).
     */
    public function forMember(Request $request, string $gymMemberId): JsonResponse
    {
        $user = $request->user();

        $member = DB::table('gym_members')->where('id', $gymMemberId)->first();
        if (! $member || $member->gym_id !== $user->gym_id) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        $sent = DB::table('session_transfers as st')
            ->join('gym_members as gm', 'gm.id', '=', 'st.receiver_gym_member_id')
            ->join('profiles as p', 'p.id', '=', 'gm.user_id')
            ->where('st.sender_gym_member_id', $gymMemberId)
            ->orderByDesc('st.created_at')
            ->select('st.id', 'st.count', 'st.created_at', 'st.receiver_gym_member_id as other_gym_member_id', 'p.full_name as other_name', 'p.photo_url as other_photo')
            ->get();

        $received = DB::table('session_transfers as st')
            ->join('gym_members as gm', 'gm.id', '=', 'st.sender_gym_member_id')
            ->join('profiles as p', 'p.id', '=', 'gm.user_id')
            ->where('st.receiver_gym_member_id', $gymMemberId)
            ->orderByDesc('st.created_at')
            ->select('st.id', 'st.count', 'st.created_at', 'st.sender_gym_member_id as other_gym_member_id', 'p.full_name as other_name', 'p.photo_url as other_photo')
            ->get();

        return response()->json(['data' => ['sent' => $sent, 'received' => $received]]);
    }
}
