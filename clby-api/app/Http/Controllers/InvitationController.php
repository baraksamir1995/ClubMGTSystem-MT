<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InvitationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $invitations = DB::table('member_invitations')
            ->where('member_invitations.gym_id', $gymId)
            ->leftJoin('gym_members', 'gym_members.id', '=', 'member_invitations.inviter_member_id')
            ->leftJoin('profiles', 'profiles.id', '=', 'gym_members.user_id')
            ->select(
                'member_invitations.*',
                'gym_members.id as gm_id',
                'gym_members.member_number as gm_member_number',
                'profiles.full_name as gm_full_name',
            )
            ->orderBy('member_invitations.created_at', 'desc')
            ->get();

        // Nest gym_members to match frontend expectation:
        // { ...invitation, gym_members: { id, member_number, profiles: { full_name } } }
        $invitations = $invitations->map(function ($inv) {
            $inv = (array) $inv;
            $inv['gym_members'] = $inv['gm_id'] ? [
                'id' => $inv['gm_id'],
                'member_number' => $inv['gm_member_number'],
                'profiles' => ['full_name' => $inv['gm_full_name']],
            ] : null;
            unset($inv['gm_id'], $inv['gm_member_number'], $inv['gm_full_name']);
            return $inv;
        });

        return response()->json(['data' => $invitations]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'required|uuid',
            'membership_id' => 'required|uuid',
            'guest_email' => 'required|email',
            'guest_phone' => 'required|string|max:20',
            'guest_name' => 'nullable|string|max:255',
            'duration_type' => 'required|string|in:per_visit,fixed_days',
            'duration_days' => 'nullable|integer|min:1',
            'max_visits' => 'required|integer|min:1',
            'validity_days' => 'required|integer|min:1',
        ]);

        $gymId = $request->user()->gym_id;

        $id = DB::table('member_invitations')->insertGetId([
            'id' => \Illuminate\Support\Str::uuid()->toString(),
            'gym_id' => $gymId,
            'inviter_member_id' => $validated['gym_member_id'],
            'membership_id' => $validated['membership_id'],
            'guest_email' => $validated['guest_email'],
            'guest_phone' => $validated['guest_phone'],
            'guest_name' => $validated['guest_name'] ?? null,
            'duration_type' => $validated['duration_type'],
            'duration_days' => $validated['duration_days'] ?? null,
            'max_visits' => $validated['max_visits'],
            'expires_at' => now()->addDays($validated['validity_days']),
            'status' => 'pending',
            'created_at' => now(),
        ], 'id');

        $invitation = DB::table('member_invitations')->where('id', $id)->first();

        return response()->json((array) $invitation, 201);
    }

    public function activate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'guest_email' => 'required|email',
            'guest_phone' => 'required|string',
        ]);

        $invitation = DB::table('member_invitations')
            ->where('guest_email', $validated['guest_email'])
            ->where('guest_phone', $validated['guest_phone'])
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->first();

        if (! $invitation) {
            return response()->json(['message' => 'No valid invitation found'], 404);
        }

        DB::table('member_invitations')
            ->where('id', $invitation->id)
            ->update([
                'status' => 'activated',
                'activated_at' => now(),
                'pass_expires_at' => $invitation->duration_type === 'fixed_days' && $invitation->duration_days
                    ? now()->addDays($invitation->duration_days)
                    : null,
            ]);

        return response()->json(['message' => 'Invitation activated']);
    }

    public function myPass(Request $request): JsonResponse
    {
        $user = $request->user();

        $invitation = DB::table('member_invitations')
            ->where('guest_email', $user->email)
            ->whereIn('status', ['activated', 'pending'])
            ->where('expires_at', '>', now())
            ->orderBy('created_at', 'desc')
            ->first();

        if (! $invitation) {
            return response()->json(null);
        }

        return response()->json((array) $invitation);
    }

    public function invalidate(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        DB::table('member_invitations')
            ->where('id', $id)
            ->where('gym_id', $gymId)
            ->update([
                'status' => 'invalidated',
                'invalidated_at' => now(),
            ]);

        return response()->json(['message' => 'Invitation invalidated']);
    }
}
