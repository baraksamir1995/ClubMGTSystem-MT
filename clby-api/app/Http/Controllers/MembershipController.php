<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

use \App\Traits\LogsActivity;

class MembershipController extends Controller
{
    use LogsActivity;
    public function extend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'membership_id' => 'required|uuid',
            'extra_days' => 'required|integer|min:1',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $result = DB::select('SELECT extend_membership(?, ?, ?) AS data', [
            $validated['membership_id'],
            $validated['extra_days'],
            $gymId,
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    public function addSessions(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'membership_id' => 'required|uuid',
            'extra_sessions' => 'required|integer|min:1',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $result = DB::select('SELECT add_sessions(?, ?, ?) AS data', [
            $validated['membership_id'],
            $validated['extra_sessions'],
            $gymId,
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    /**
     * Admin assigns a plan to a member (creates membership + optional payment).
     */
    public function assign(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'required|uuid',
            'plan_id' => 'required|uuid',
            'start_date' => 'nullable|date',
            'amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:5',
            'payment_method' => 'nullable|string|max:50',
            'payment_status' => 'nullable|string|in:paid,pending',
            'original_amount' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'promo_code_id' => 'nullable|uuid',
            'plan_promotion_id' => 'nullable|uuid',
            'branch_id' => 'nullable|uuid',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        // Fetch plan details
        $plan = DB::table('membership_plans')->where('id', $validated['plan_id'])->first();
        if (! $plan) {
            return response()->json(['error' => 'Plan not found'], 404);
        }

        $startDate = $validated['start_date'] ?? now()->toDateString();
        // Calculate end date from duration_days (time-based) or session_expiry_days (session-based)
        $expiryDays = $plan->duration_days ?? $plan->session_expiry_days ?? null;
        $endDate = $expiryDays
            ? date('Y-m-d', strtotime($startDate . " + {$expiryDays} days"))
            : null;

        $amount = $validated['amount'] ?? $plan->price ?? 0;
        $originalAmount = $validated['original_amount'] ?? $amount;
        $discountAmount = $validated['discount_amount'] ?? 0;
        $finalPrice = $amount;

        return DB::transaction(function () use ($validated, $gymId, $plan, $startDate, $endDate, $amount, $originalAmount, $discountAmount, $finalPrice) {
            // Deactivate any existing active memberships for this member
            DB::table('member_memberships')
                ->where('gym_member_id', $validated['gym_member_id'])
                ->where('status', 'active')
                ->update(['status' => 'expired', 'updated_at' => now()]);

            $membershipId = \Illuminate\Support\Str::uuid()->toString();

            DB::table('member_memberships')->insert([
                'id' => $membershipId,
                'gym_member_id' => $validated['gym_member_id'],
                'plan_id' => $validated['plan_id'],
                'gym_id' => $gymId,
                'status' => 'active',
                'payment_status' => 'pending',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'sessions_total' => $plan->session_count,
                'sessions_used' => 0,
                'sessions_remaining' => $plan->session_count,
                'max_visits' => $plan->max_visits,
                'visits_used' => 0,
                'original_price' => $originalAmount,
                'discount_amount' => $discountAmount,
                'final_price' => $finalPrice,
                'promo_code_id' => $validated['promo_code_id'] ?? null,
                'plan_promotion_id' => $validated['plan_promotion_id'] ?? null,
                'branch_id' => $validated['branch_id'] ?? null,
                'invitations_remaining' => $plan->invitations_enabled ? ($plan->invitations_per_cycle ?? 0) : 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Activate the gym member if inactive
            DB::table('gym_members')
                ->where('id', $validated['gym_member_id'])
                ->where('status', '!=', 'active')
                ->update(['status' => 'active', 'updated_at' => now()]);

            // Always create payment record (pending until paid)
            {
                DB::table('payments')->insert([
                    'id' => \Illuminate\Support\Str::uuid()->toString(),
                    'gym_id' => $gymId,
                    'gym_member_id' => $validated['gym_member_id'],
                    'membership_id' => $membershipId,
                    'amount' => $amount,
                    'original_amount' => $originalAmount,
                    'discount_amount' => $discountAmount,
                    'currency' => $validated['currency'] ?? 'EGP',
                    'payment_method' => $validated['payment_method'] ?? 'cash',
                    'status' => 'pending',
                    'paid_at' => null,
                    'source' => 'admin',
                    'service_type' => 'membership',
                    'service_name' => $plan->name,
                    'promo_code_id' => $validated['promo_code_id'] ?? null,
                    'plan_promotion_id' => $validated['plan_promotion_id'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return response()->json(['data' => ['membership_id' => $membershipId]], 201);
        });
    }

    /**
     * Freeze or unfreeze a membership.
     */
    public function unfreeze(Request $request, string $id): JsonResponse
    {
        $request->merge(['action' => 'unfreeze']);

        return $this->freeze($request, $id);
    }

    public function freeze(Request $request, string $id): JsonResponse
    {
        // Default action to 'freeze' if not provided (Flutter freeze calls don't send action)
        if (! $request->has('action')) {
            $request->merge(['action' => 'freeze']);
        }

        $validated = $request->validate([
            'action' => 'required|string|in:freeze,unfreeze',
            'days' => 'nullable|integer|min:1',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $membership = DB::table('member_memberships')
            ->where('id', $id)
            ->where('gym_id', $gymId)
            ->first();

        if (! $membership) {
            return response()->json(['error' => 'Membership not found'], 404);
        }

        if ($validated['action'] === 'freeze') {
            $days = $validated['days'] ?? 7;
            $now = now();
            $frozenUntil = $now->copy()->addDays($days);
            $newEndDate = $membership->end_date
                ? date('Y-m-d', strtotime($membership->end_date . " + {$days} days"))
                : null;

            DB::table('member_memberships')->where('id', $id)->update([
                'freeze_status' => 'frozen',
                'frozen_at' => $now,
                'frozen_until' => $frozenUntil,
                'end_date' => $newEndDate ?? $membership->end_date,
                'freeze_days_used' => ($membership->freeze_days_used ?? 0) + $days,
                'freeze_count' => ($membership->freeze_count ?? 0) + 1,
                'updated_at' => $now,
            ]);

            DB::table('membership_freeze_logs')->insert([
                'id' => \Illuminate\Support\Str::uuid()->toString(),
                'gym_id' => $gymId,
                'membership_id' => $id,
                'gym_member_id' => $membership->gym_member_id,
                'freeze_days' => $days,
                'frozen_at' => $now,
                'frozen_until' => $frozenUntil,
                'created_at' => $now,
            ]);

            return response()->json(['message' => 'Membership frozen']);
        }

        // Unfreeze
        $now = now();
        $originalDays = $membership->frozen_at && $membership->frozen_until
            ? (int) (strtotime($membership->frozen_until) - strtotime($membership->frozen_at)) / 86400
            : 0;
        $actualDays = $membership->frozen_at
            ? max(0, min($originalDays, (int) ((time() - strtotime($membership->frozen_at)) / 86400)))
            : $originalDays;
        $unusedDays = $originalDays - $actualDays;

        $updates = [
            'freeze_status' => null,
            'frozen_at' => null,
            'frozen_until' => null,
            'updated_at' => $now,
        ];

        if ($unusedDays > 0 && $membership->end_date) {
            $updates['end_date'] = date('Y-m-d', strtotime($membership->end_date . " - {$unusedDays} days"));
            $updates['freeze_days_used'] = max(0, ($membership->freeze_days_used ?? 0) - $unusedDays);
        }

        DB::table('member_memberships')->where('id', $id)->update($updates);

        DB::table('membership_freeze_logs')
            ->where('membership_id', $id)
            ->whereNull('resumed_at')
            ->update(['resumed_at' => $now]);

        return response()->json(['message' => 'Membership unfrozen']);
    }

    /**
     * Get freeze logs for a membership.
     */
    public function freezeLogs(string $id): JsonResponse
    {
        $logs = DB::table('membership_freeze_logs')
            ->where('membership_id', $id)
            ->orderBy('frozen_at', 'desc')
            ->get();

        return response()->json(['data' => $logs]);
    }

    /**
     * Update membership fields (PATCH).
     */
    public function updateMembership(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $validated = $request->validate([
            'status' => 'sometimes|string',
            'payment_status' => 'sometimes|string',
            'notes' => 'nullable|string',
        ]);

        DB::table('member_memberships')
            ->where('id', $id)
            ->where('gym_id', $gymId)
            ->update(array_merge($validated, ['updated_at' => now()]));

        return response()->json(['message' => 'Updated']);
    }

    /**
     * Mobile self-purchase — user buys a membership for themselves.
     */
    public function purchase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => 'required|uuid',
            'amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:5',
            'payment_method' => 'nullable|string|max:50',
            'start_date' => 'nullable|date',
            'original_amount' => 'nullable|numeric|min:0',
            'promo_code_id' => 'nullable|uuid',
        ]);

        $user = $request->user();
        $gymId = $user->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        // Find the user's gym_member record
        $gymMember = DB::table('gym_members')
            ->where('user_id', $user->id)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        if (! $gymMember) {
            return response()->json(['error' => 'Not a gym member'], 404);
        }

        $plan = DB::table('membership_plans')->where('id', $validated['plan_id'])->first();
        if (! $plan) {
            return response()->json(['error' => 'Plan not found'], 404);
        }

        $startDate = $validated['start_date'] ?? now()->toDateString();
        $expiryDays = $plan->duration_days ?? $plan->session_expiry_days ?? null;
        $endDate = $expiryDays ? date('Y-m-d', strtotime($startDate . " + {$expiryDays} days")) : null;

        $amount = $validated['amount'] ?? $plan->price ?? 0;
        $originalAmount = $validated['original_amount'] ?? $amount;

        return DB::transaction(function () use ($validated, $gymId, $gymMember, $plan, $startDate, $endDate, $amount, $originalAmount) {
            // Deactivate previous active memberships
            DB::table('member_memberships')
                ->where('gym_member_id', $gymMember->id)
                ->where('status', 'active')
                ->update(['status' => 'expired', 'updated_at' => now()]);

            $membershipId = \Illuminate\Support\Str::uuid()->toString();

            DB::table('member_memberships')->insert([
                'id' => $membershipId,
                'gym_member_id' => $gymMember->id,
                'plan_id' => $validated['plan_id'],
                'gym_id' => $gymId,
                'status' => 'active',
                'payment_status' => 'pending',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'sessions_total' => $plan->session_count,
                'sessions_used' => 0,
                'sessions_remaining' => $plan->session_count,
                'original_price' => $originalAmount,
                'discount_amount' => 0,
                'final_price' => $amount,
                'promo_code_id' => $validated['promo_code_id'] ?? null,
                'invitations_remaining' => $plan->invitations_enabled ? ($plan->invitations_per_cycle ?? 0) : 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Create pending payment
            $paymentId = \Illuminate\Support\Str::uuid()->toString();
            DB::table('payments')->insert([
                'id' => $paymentId,
                'gym_id' => $gymId,
                'gym_member_id' => $gymMember->id,
                'membership_id' => $membershipId,
                'amount' => $amount,
                'original_amount' => $originalAmount,
                'currency' => $validated['currency'] ?? 'EGP',
                'payment_method' => $validated['payment_method'] ?? 'card',
                'status' => 'pending',
                'source' => 'mobile_app',
                'service_type' => 'membership',
                'service_name' => $plan->name,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json(['id' => $paymentId, 'membership_id' => $membershipId], 201);
        });
    }

    public function purchaseServicePackage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'package_id' => 'required|uuid',
            'amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:5',
            'payment_method' => 'nullable|string|max:50',
            'specialist_name' => 'nullable|string|max:255',
            'original_amount' => 'nullable|numeric|min:0',
            'promo_code_id' => 'nullable|uuid',
        ]);

        $user = $request->user();
        $gymId = $user->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $gymMember = DB::table('gym_members')
            ->where('user_id', $user->id)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        if (! $gymMember) {
            return response()->json(['error' => 'Not a gym member'], 404);
        }

        $package = DB::table('service_session_packages')->where('id', $validated['package_id'])->first();
        if (! $package) {
            return response()->json(['error' => 'Package not found'], 404);
        }

        $amount = $validated['amount'] ?? $package->price ?? 0;

        return DB::transaction(function () use ($validated, $gymId, $gymMember, $package, $amount) {
            $paymentId = \Illuminate\Support\Str::uuid()->toString();
            DB::table('payments')->insert([
                'id' => $paymentId,
                'gym_id' => $gymId,
                'gym_member_id' => $gymMember->id,
                'amount' => $amount,
                'original_amount' => $validated['original_amount'] ?? $amount,
                'currency' => $validated['currency'] ?? 'EGP',
                'payment_method' => $validated['payment_method'] ?? 'card',
                'status' => 'pending',
                'source' => 'mobile_app',
                'service_type' => 'service_package',
                'service_name' => $package->name,
                'specialist_name' => $validated['specialist_name'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json(['id' => $paymentId], 201);
        });
    }

    /**
     * Detach plan — remove the active membership from a member.
     * No financial impact: payments remain untouched.
     */
    public function detach(Request $request, string $memberId): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $member = DB::table('gym_members')
            ->where('id', $memberId)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        if (! $member) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        // Find active membership
        $membership = DB::table('member_memberships')
            ->where('gym_member_id', $memberId)
            ->where('status', 'active')
            ->first();

        if (! $membership) {
            return response()->json(['error' => 'Member has no active plan to detach'], 422);
        }

        // Get plan name for logging
        $planName = DB::table('membership_plans')
            ->where('id', $membership->plan_id)
            ->value('name') ?? 'Unknown';

        $memberName = DB::table('profiles')
            ->where('id', $member->user_id)
            ->value('full_name') ?? 'Unknown';

        return DB::transaction(function () use ($member, $memberId, $membership, $gymId, $request, $planName, $memberName) {
            // Cancel the membership
            DB::table('member_memberships')
                ->where('id', $membership->id)
                ->update([
                    'status' => 'cancelled',
                    'cancelled_at' => now(),
                    'cancellation_reason' => 'Plan detached by admin',
                    'updated_at' => now(),
                ]);

            // Set member status to inactive
            DB::table('gym_members')
                ->where('id', $memberId)
                ->update(['status' => 'inactive', 'updated_at' => now()]);

            // Cancel future bookings (bookings table uses member_id = profile UUID, class_id = session UUID)
            $profileId = $member->user_id;
            DB::table('bookings')
                ->where('member_id', $profileId)
                ->where('status', 'confirmed')
                ->whereExists(function ($q) {
                    $q->select(DB::raw(1))
                      ->from('class_sessions')
                      ->whereColumn('class_sessions.id', 'bookings.class_id')
                      ->where('class_sessions.session_date', '>=', now()->toDateString());
                })
                ->update(['status' => 'cancelled']);

            // Log activity
            $this->logActivity(
                $gymId,
                $request->user()->id,
                'detach',
                'members',
                "{$request->user()->full_name} detached {$planName} from {$memberName}",
                'member_memberships',
                $membership->id,
            );

            return response()->json(['message' => 'Plan detached successfully']);
        });
    }

    /**
     * Transfer plan — move the active membership from one member to another.
     * No financial impact: payments remain with the original member.
     */
    public function transfer(Request $request, string $sourceMemberId): JsonResponse
    {
        $validated = $request->validate([
            'destination_member_id' => 'required|uuid',
        ]);

        $gymId = $request->user()->gym_id;
        $destMemberId = $validated['destination_member_id'];

        // Prevent self-transfer
        if ($sourceMemberId === $destMemberId) {
            return response()->json(['error' => 'Cannot transfer to the same member'], 422);
        }

        // Validate both members exist in this gym
        $source = DB::table('gym_members')
            ->where('id', $sourceMemberId)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        $dest = DB::table('gym_members')
            ->where('id', $destMemberId)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        if (! $source) return response()->json(['error' => 'Source member not found'], 404);
        if (! $dest) return response()->json(['error' => 'Destination member not found'], 404);

        // Source must have an active membership
        $membership = DB::table('member_memberships')
            ->where('gym_member_id', $sourceMemberId)
            ->where('status', 'active')
            ->first();

        if (! $membership) {
            return response()->json(['error' => 'Source member has no active plan to transfer'], 422);
        }

        // Check plan hasn't expired
        if ($membership->end_date && $membership->end_date < now()->toDateString()) {
            return response()->json(['error' => 'Cannot transfer an expired plan'], 422);
        }

        // Destination must NOT have an active membership
        $destActive = DB::table('member_memberships')
            ->where('gym_member_id', $destMemberId)
            ->where('status', 'active')
            ->exists();

        if ($destActive) {
            return response()->json(['error' => 'Destination member already has an active plan'], 422);
        }

        // Get names for logging
        $sourceName = DB::table('profiles')->where('id', $source->user_id)->value('full_name') ?? 'Unknown';
        $destName = DB::table('profiles')->where('id', $dest->user_id)->value('full_name') ?? 'Unknown';
        $planName = DB::table('membership_plans')->where('id', $membership->plan_id)->value('name') ?? 'Unknown';

        return DB::transaction(function () use ($sourceMemberId, $destMemberId, $membership, $gymId, $request, $sourceName, $destName, $planName) {
            $newMembershipId = Str::uuid()->toString();

            // Create new membership for destination member (copy remaining plan)
            DB::table('member_memberships')->insert([
                'id' => $newMembershipId,
                'gym_id' => $gymId,
                'gym_member_id' => $destMemberId,
                'plan_id' => $membership->plan_id,
                'status' => 'active',
                'start_date' => now()->toDateString(),
                'end_date' => $membership->end_date,
                'sessions_total' => $membership->sessions_total,
                'sessions_used' => $membership->sessions_used ?? 0,
                'sessions_remaining' => $membership->sessions_remaining,
                'max_visits' => $membership->max_visits ?? null,
                'visits_used' => 0,
                'notes' => "Transferred from {$sourceName}",
                'transferred_from' => $sourceMemberId,
                'branch_id' => $membership->branch_id ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Cancel source membership
            DB::table('member_memberships')
                ->where('id', $membership->id)
                ->update([
                    'status' => 'cancelled',
                    'cancelled_at' => now(),
                    'cancellation_reason' => "Transferred to {$destName}",
                    'transferred_to' => $destMemberId,
                    'updated_at' => now(),
                ]);

            // Set source member inactive, destination active
            DB::table('gym_members')->where('id', $sourceMemberId)
                ->update(['status' => 'inactive', 'updated_at' => now()]);
            DB::table('gym_members')->where('id', $destMemberId)
                ->update(['status' => 'active', 'updated_at' => now()]);

            // Cancel source member's future bookings (bookings uses member_id = profile UUID, class_id)
            $sourceProfileId = $source->user_id;
            DB::table('bookings')
                ->where('member_id', $sourceProfileId)
                ->where('status', 'confirmed')
                ->whereExists(function ($q) {
                    $q->select(DB::raw(1))
                      ->from('class_sessions')
                      ->whereColumn('class_sessions.id', 'bookings.class_id')
                      ->where('class_sessions.session_date', '>=', now()->toDateString());
                })
                ->update(['status' => 'cancelled']);

            // Log activity
            $this->logActivity(
                $gymId,
                $request->user()->id,
                'transfer',
                'members',
                "{$request->user()->full_name} transferred {$planName} from {$sourceName} to {$destName}",
                'member_memberships',
                $newMembershipId,
                ['source_member_id' => $sourceMemberId, 'destination_member_id' => $destMemberId],
            );

            return response()->json([
                'message' => 'Plan transferred successfully',
                'membership_id' => $newMembershipId,
            ]);
        });
    }
}
