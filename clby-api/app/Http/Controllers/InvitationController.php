<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

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

    /**
     * Member sends a guest invitation.
     * Enforces the per-membership cap (`invitations_remaining`) atomically.
     */
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

        $user = $request->user();
        $gymId = $user->gym_id;
        $isAdmin = in_array($user->role, ['gym_admin', 'staff', 'trainer', 'super_admin']);

        // AuthZ: the gym_member must belong to the authed user (admins exempt).
        $member = DB::table('gym_members')
            ->where('id', $validated['gym_member_id'])
            ->where('gym_id', $gymId)
            ->first();
        if (! $member) {
            return response()->json(['error' => 'Member not found'], 404);
        }
        if (! $isAdmin && $member->user_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        try {
            $invitation = DB::transaction(function () use ($validated, $gymId) {
                // Lock the membership row to prevent concurrent invites from over-drawing the cap.
                $membership = DB::table('member_memberships')
                    ->where('id', $validated['membership_id'])
                    ->where('gym_member_id', $validated['gym_member_id'])
                    ->where('gym_id', $gymId)
                    ->lockForUpdate()
                    ->first();

                if (! $membership) {
                    abort(response()->json(['error' => 'Membership not found for this member'], 404));
                }
                if ($membership->status !== 'active') {
                    abort(response()->json(['error' => 'Membership is not active'], 422));
                }
                if (($membership->invitations_remaining ?? 0) <= 0) {
                    abort(response()->json(['error' => 'No invitations remaining on this plan'], 422));
                }

                $id = Str::uuid()->toString();
                DB::table('member_invitations')->insert([
                    'id' => $id,
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
                ]);

                DB::table('member_memberships')
                    ->where('id', $membership->id)
                    ->update([
                        'invitations_remaining' => DB::raw('invitations_remaining - 1'),
                        'invitations_used' => DB::raw('invitations_used + 1'),
                        'updated_at' => now(),
                    ]);

                return DB::table('member_invitations')->where('id', $id)->first();
            });
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            throw $e;
        }

        return response()->json((array) $invitation, 201);
    }

    /**
     * Guest activates their invitation (typically called during guest registration).
     */
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
            ->orderBy('created_at', 'desc')
            ->first();

        if (! $invitation) {
            return response()->json(['message' => 'No valid invitation found'], 404);
        }

        DB::table('member_invitations')
            ->where('id', $invitation->id)
            ->update([
                'status' => 'active',
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
            ->whereIn('status', ['active', 'pending'])
            ->where('expires_at', '>', now())
            ->orderBy('created_at', 'desc')
            ->first();

        if (! $invitation) {
            return response()->json(null);
        }

        return response()->json((array) $invitation);
    }

    /**
     * Gate-check / redeem: front-desk scans a guest pass to log a visit.
     * Lookup by invitation_token OR (guest_email + guest_phone).
     * Increments visits_used and flips status to 'expired' once max_visits reached.
     */
    public function redeem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'invitation_token' => 'nullable|uuid',
            'guest_email' => 'nullable|email',
            'guest_phone' => 'nullable|string',
        ]);

        if (empty($validated['invitation_token']) && (empty($validated['guest_email']) || empty($validated['guest_phone']))) {
            return response()->json(['error' => 'Provide invitation_token, or both guest_email and guest_phone'], 422);
        }

        $gymId = $request->user()->gym_id;

        return DB::transaction(function () use ($validated, $gymId) {
            $query = DB::table('member_invitations')
                ->where('gym_id', $gymId)
                ->lockForUpdate();

            if (!empty($validated['invitation_token'])) {
                $query->where('invitation_token', $validated['invitation_token']);
            } else {
                $query->where('guest_email', $validated['guest_email'])
                      ->where('guest_phone', $validated['guest_phone']);
            }

            $invitation = $query->orderBy('created_at', 'desc')->first();

            if (! $invitation) {
                return response()->json(['error' => 'Invitation not found'], 404);
            }
            if (! in_array($invitation->status, ['pending', 'active'], true)) {
                return response()->json(['error' => "Invitation is {$invitation->status}"], 422);
            }
            if ($invitation->expires_at && $invitation->expires_at <= now()) {
                return response()->json(['error' => 'Invitation has expired'], 422);
            }
            if ($invitation->pass_expires_at && $invitation->pass_expires_at <= now()) {
                return response()->json(['error' => 'Pass has expired'], 422);
            }
            if (($invitation->visits_used ?? 0) >= ($invitation->max_visits ?? 0)) {
                return response()->json(['error' => 'Pass has no visits remaining'], 422);
            }

            $newVisitsUsed = ($invitation->visits_used ?? 0) + 1;
            $reachedCap = $newVisitsUsed >= ($invitation->max_visits ?? 0);

            $updates = [
                'visits_used' => $newVisitsUsed,
                'status' => $invitation->status === 'pending' ? 'active' : $invitation->status,
            ];
            if ($invitation->status === 'pending' && ! $invitation->activated_at) {
                $updates['activated_at'] = now();
            }
            if ($reachedCap) {
                $updates['status'] = 'expired';
            }

            DB::table('member_invitations')->where('id', $invitation->id)->update($updates);

            return response()->json([
                'data' => [
                    'invitation_id' => $invitation->id,
                    'guest_name' => $invitation->guest_name,
                    'visits_used' => $newVisitsUsed,
                    'max_visits' => $invitation->max_visits,
                    'visits_remaining' => max(0, ($invitation->max_visits ?? 0) - $newVisitsUsed),
                    'status' => $updates['status'],
                ],
            ]);
        });
    }

    /**
     * Admin invalidates an invitation. Refunds the invitation slot back to the
     * membership iff the pass was never used (visits_used = 0).
     */
    public function invalidate(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $userId = $request->user()->id;

        return DB::transaction(function () use ($id, $gymId, $userId) {
            $invitation = DB::table('member_invitations')
                ->where('id', $id)
                ->where('gym_id', $gymId)
                ->lockForUpdate()
                ->first();

            if (! $invitation) {
                return response()->json(['error' => 'Invitation not found'], 404);
            }
            if ($invitation->status === 'invalidated') {
                return response()->json(['error' => 'Already invalidated'], 422);
            }

            DB::table('member_invitations')
                ->where('id', $id)
                ->update([
                    'status' => 'invalidated',
                    'invalidated_at' => now(),
                    'invalidated_by' => $userId,
                ]);

            // Refund only if the guest never redeemed any visit.
            $refunded = false;
            if (($invitation->visits_used ?? 0) === 0 && $invitation->membership_id) {
                $affected = DB::table('member_memberships')
                    ->where('id', $invitation->membership_id)
                    ->update([
                        'invitations_remaining' => DB::raw('invitations_remaining + 1'),
                        'invitations_used' => DB::raw('GREATEST(invitations_used - 1, 0)'),
                        'updated_at' => now(),
                    ]);
                $refunded = $affected > 0;
            }

            return response()->json([
                'message' => 'Invitation invalidated',
                'refunded' => $refunded,
            ]);
        });
    }
}
