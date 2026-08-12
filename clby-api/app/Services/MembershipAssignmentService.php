<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Single home for the subscription-entitlement rules shared by admin plan
 * assignment (MembershipController::assign) and plan-bearing recorded
 * payments (PaymentController::store): displace existing active
 * subscriptions, insert the member_memberships row, activate the member.
 *
 * Callers validate the plan/member against the gym first and call this
 * inside a DB transaction.
 */
class MembershipAssignmentService
{
    /**
     * Create an active subscription membership and return its id.
     *
     * @param object $plan    membership_plans row (already gym-validated)
     * @param array  $options start_date, payment_status, amount,
     *                        original_amount, discount_amount,
     *                        promo_code_id, plan_promotion_id, branch_id
     */
    public function createSubscription(object $plan, string $gymMemberId, string $gymId, array $options = []): string
    {
        $startDate = $options['start_date'] ?? now()->toDateString();
        // Calculate end date from duration_days (time-based) or session_expiry_days (session-based)
        $expiryDays = $plan->duration_days ?? $plan->session_expiry_days ?? null;
        $endDate = $expiryDays
            ? date('Y-m-d', strtotime($startDate . " + {$expiryDays} days"))
            : null;

        $amount = $options['amount'] ?? $plan->price ?? 0;
        $originalAmount = $options['original_amount'] ?? $amount;
        $discountAmount = $options['discount_amount'] ?? 0;

        // Deactivate any existing active SUBSCRIPTION memberships for
        // this member. Transferred buckets are independent entitlements
        // and must survive a new subscription assignment.
        DB::table('member_memberships')
            ->where('gym_member_id', $gymMemberId)
            ->where('status', 'active')
            ->where('source_type', 'subscription')
            ->update(['status' => 'expired', 'updated_at' => now()]);

        $membershipId = Str::uuid()->toString();

        DB::table('member_memberships')->insert([
            'id' => $membershipId,
            'gym_member_id' => $gymMemberId,
            'plan_id' => $plan->id,
            'gym_id' => $gymId,
            'status' => 'active',
            'payment_status' => $options['payment_status'] ?? 'pending',
            'start_date' => $startDate,
            'end_date' => $endDate,
            'sessions_total' => $plan->session_count,
            'sessions_used' => 0,
            'sessions_remaining' => $plan->session_count,
            'max_visits' => $plan->max_visits,
            'visits_used' => 0,
            'original_price' => $originalAmount,
            'discount_amount' => $discountAmount,
            'final_price' => $amount,
            'promo_code_id' => $options['promo_code_id'] ?? null,
            'plan_promotion_id' => $options['plan_promotion_id'] ?? null,
            'branch_id' => $options['branch_id'] ?? null,
            'invitations_remaining' => $plan->invitations_enabled ? ($plan->invitations_per_cycle ?? 0) : 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Activate the gym member if inactive
        DB::table('gym_members')
            ->where('id', $gymMemberId)
            ->where('status', '!=', 'active')
            ->update(['status' => 'active', 'updated_at' => now()]);

        return $membershipId;
    }
}
