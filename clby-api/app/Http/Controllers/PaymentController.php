<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use \App\Traits\LogsActivity;

class PaymentController extends Controller
{
    use LogsActivity;
    use ResolvesMemberScope;

    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => []]);
        }

        $isAdmin = $this->callerIsAdmin($request);
        $memberId = $request->query('gym_member_id');

        // Non-admin callers can only ever see their own payments. The
        // client-supplied gym_member_id is ignored.
        if (! $isAdmin) {
            $memberId = $this->callerOwnMemberId($request);
            if (! $memberId) {
                return response()->json(['data' => []]);
            }
        } elseif ($memberId) {
            // Admin filtering by a specific member — verify they're in the gym.
            $exists = DB::table('gym_members')
                ->where('id', $memberId)
                ->where('gym_id', $gymId)
                ->whereNull('deleted_at')
                ->exists();
            if (! $exists) {
                return response()->json(['data' => []]);
            }
        }

        // If we have a memberId (member-self or admin-filtered), use the
        // direct query. Otherwise (admin viewing all gym payments) use the
        // PG function which has additional aggregation.
        if ($memberId) {
            $results = DB::table('payments')
                ->where('gym_id', $gymId)
                ->where('gym_member_id', $memberId)
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn ($r) => (array) $r)
                ->toArray();

            return response()->json(['data' => $results]);
        }

        // Optional pagination passthrough. Defaults match the SQL
        // function's own DEFAULT (5000 / 0) so existing callers + the
        // current admin table (which still aggregates client-side) are
        // unaffected. Clamp to sane bounds.
        $limit  = max(1, min((int) $request->query('limit', 5000), 5000));
        $offset = max(0, (int) $request->query('offset', 0));
        $results = DB::select('SELECT * FROM get_gym_payments(?, ?, ?)', [$gymId, $limit, $offset]);

        // Cast numeric string columns to floats (PG returns decimal as string)
        $numericCols = ['amount', 'original_amount', 'discount_amount', 'refund_amount', 'refunded_amount'];
        $results = array_map(function ($row) use ($numericCols) {
            $row = (array) $row;
            foreach ($numericCols as $col) {
                if (isset($row[$col])) {
                    $row[$col] = (float) $row[$col];
                }
            }
            return $row;
        }, $results);

        // Gym-wide summary computed in SQL so the tiles stay correct even
        // when the row list is truncated by the limit above.
        $summary = (array) DB::table('payments')
            ->where('gym_id', $gymId)
            ->selectRaw("
                count(*) filter (where status = 'paid')    as paid_count,
                count(*) filter (where status = 'pending') as pending_count,
                count(*) filter (where status = 'overdue') as overdue_count,
                coalesce(sum(amount - coalesce(refunded_amount, 0))
                    filter (where status in ('paid', 'refunded', 'partial_refund')), 0) as total_revenue
            ")
            ->first();
        $summary['total_revenue'] = (float) $summary['total_revenue'];

        return response()->json(['data' => $results, 'summary' => $summary]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => null]);
        }

        $payment = Payment::where('id', $id)->where('gym_id', $gymId)->first();
        if (! $payment) return response()->json(['error' => 'Payment not found'], 404);

        // Non-admin callers may only view their own payments.
        if (! $this->callerIsAdmin($request)) {
            $ownMemberId = $this->callerOwnMemberId($request);
            if (! $ownMemberId || $payment->gym_member_id !== $ownMemberId) {
                return response()->json(['error' => 'Forbidden'], 403);
            }
        }

        // Include member info
        $member = null;
        if ($payment->gym_member_id) {
            $member = DB::table('gym_members')
                ->join('profiles', 'profiles.id', '=', 'gym_members.user_id')
                ->where('gym_members.id', $payment->gym_member_id)
                ->select('gym_members.id', 'gym_members.member_number', 'profiles.full_name', 'profiles.email')
                ->first();
        }

        // Include plan info
        $plan = null;
        if ($payment->membership_id) {
            $plan = DB::table('member_memberships')
                ->join('membership_plans', 'membership_plans.id', '=', 'member_memberships.plan_id')
                ->where('member_memberships.id', $payment->membership_id)
                ->select('membership_plans.name as plan_name', 'membership_plans.plan_type')
                ->first();
        }

        $data = $payment->toArray();
        $data['member'] = $member ? (array) $member : null;
        $data['plan'] = $plan ? (array) $plan : null;

        return response()->json($data);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'required|uuid',
            'membership_id' => 'nullable|uuid',
            'amount' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:5',
            'payment_method' => 'nullable|string|max:50',
            'status' => 'nullable|string|in:pending,paid,failed,refunded,partial_refund',
            'notes' => 'nullable|string',
            'paid_at' => 'nullable|date',
            'source' => 'nullable|string|max:50',
            'original_amount' => 'nullable|numeric|min:0',
            'discount_amount' => 'nullable|numeric|min:0',
            'promo_code_id' => 'nullable|uuid',
            'plan_promotion_id' => 'nullable|uuid',
            'service_type' => 'nullable|string|max:50',
            'service_name' => 'nullable|string|max:255',
            'service_id' => 'nullable|uuid',
            'specialist_name' => 'nullable|string|max:255',
            'branch_id' => 'nullable|uuid',
            // When the recorded payment is for a service-session package, the
            // admin form also sends the package + trainer ids so we can spin
            // up the matching assignment row in the same request.
            'service_package_id' => 'nullable|uuid',
            'trainer_id' => 'nullable|uuid',
            // When the recorded payment is for a membership plan, the admin
            // form sends the plan id so the plan is assigned to the member
            // in the same request (via MembershipAssignmentService, shared
            // with MembershipController::assign).
            'plan_id' => 'nullable|uuid',
            'start_date' => 'nullable|date',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        // Resolve session-package + trainer for assignment creation.
        $package = null;
        $trainerName = $validated['specialist_name'] ?? null;
        if (! empty($validated['service_package_id']) && ($validated['service_type'] ?? null) === 'session_package') {
            $package = DB::table('service_session_packages')
                ->where('id', $validated['service_package_id'])
                ->where('gym_id', $gymId)
                ->whereNull('deleted_at')
                ->first();
            if (! $package) {
                return response()->json(['error' => 'Package not found'], 404);
            }
        }
        if (! empty($validated['trainer_id'])) {
            $trainer = DB::table('trainer_profiles')
                ->where('id', $validated['trainer_id'])
                ->where('gym_id', $gymId)
                ->first();
            if (! $trainer) {
                return response()->json(['error' => 'Trainer not found'], 404);
            }
            $trainerName = $trainer->name ?? $trainerName;
        }

        // Resolve membership plan when the payment should also assign it.
        $plan = null;
        if (! empty($validated['plan_id'])) {
            $plan = DB::table('membership_plans')
                ->where('id', $validated['plan_id'])
                ->where('gym_id', $gymId)
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->first();
            if (! $plan) {
                return response()->json(['error' => 'Plan not available'], 404);
            }

            $memberInGym = DB::table('gym_members')
                ->where('id', $validated['gym_member_id'])
                ->where('gym_id', $gymId)
                ->whereNull('deleted_at')
                ->exists();
            if (! $memberInGym) {
                return response()->json(['error' => 'Member not in this gym'], 404);
            }
        }

        $status = $validated['status'] ?? 'pending';

        return DB::transaction(function () use ($validated, $gymId, $status, $package, $trainerName, $plan) {
            $membershipId = $validated['membership_id'] ?? null;

            if ($plan) {
                $membershipId = app(\App\Services\MembershipAssignmentService::class)->createSubscription(
                    $plan,
                    $validated['gym_member_id'],
                    $gymId,
                    [
                        'start_date' => $validated['start_date'] ?? null,
                        'payment_status' => $status === 'paid' ? 'paid' : 'pending',
                        'amount' => $validated['amount'],
                        'original_amount' => $validated['original_amount'] ?? null,
                        'discount_amount' => $validated['discount_amount'] ?? 0,
                        'promo_code_id' => $validated['promo_code_id'] ?? null,
                        'plan_promotion_id' => $validated['plan_promotion_id'] ?? null,
                        'branch_id' => $validated['branch_id'] ?? null,
                    ]
                );

                if ($status === 'paid') {
                    $this->assignMemberNumberIfMissing($validated['gym_member_id'], $gymId);
                }
            }

            $payment = Payment::create([
                'gym_id' => $gymId,
                'gym_member_id' => $validated['gym_member_id'],
                'membership_id' => $membershipId,
                'amount' => $validated['amount'],
                'currency' => $validated['currency'] ?? 'EGP',
                'payment_method' => $validated['payment_method'] ?? 'cash',
                'status' => $status,
                'notes' => $validated['notes'] ?? null,
                'paid_at' => $status === 'paid' ? ($validated['paid_at'] ?? now()) : ($validated['paid_at'] ?? null),
                'source' => $validated['source'] ?? 'admin',
                'original_amount' => $validated['original_amount'] ?? $validated['amount'],
                'discount_amount' => $validated['discount_amount'] ?? 0,
                'promo_code_id' => $validated['promo_code_id'] ?? null,
                'plan_promotion_id' => $validated['plan_promotion_id'] ?? null,
                'service_type' => $validated['service_type'] ?? null,
                'service_name' => $validated['service_name'] ?? null,
                'specialist_name' => $trainerName,
                'branch_id' => $validated['branch_id'] ?? null,
            ]);

            $assignmentId = null;
            if ($package) {
                $assignmentId = \Illuminate\Support\Str::uuid()->toString();
                DB::table('member_service_assignments')->insert([
                    'id' => $assignmentId,
                    'gym_id' => $gymId,
                    'gym_member_id' => $validated['gym_member_id'],
                    'service_package_id' => $package->id,
                    'trainer_id' => $validated['trainer_id'] ?? null,
                    'trainer_name' => $trainerName,
                    'package_name' => $package->name,
                    'service_type' => $package->trainer_type,
                    'sessions_total' => $package->session_count,
                    'sessions_used' => 0,
                    'status' => 'active',
                    'notes' => $validated['notes'] ?? null,
                    'assigned_at' => now(),
                    'created_at' => now(),
                ]);
            }

            return response()->json([
                'data' => [
                    'id' => $payment->id,
                    'assignment_id' => $assignmentId,
                    'membership_id' => $plan ? $membershipId : null,
                ],
            ], 201);
        });
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'nullable|string|in:pending,paid,overdue,failed,refunded,partial_refund',
            'paid_at' => 'nullable|date',
            'notes' => 'nullable|string',
            // Detail fields editable from the confirm-payment modal.
            'payment_method' => 'nullable|string|max:50',
            'amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:5',
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

        $detailCols = ['payment_method', 'amount', 'currency', 'original_amount', 'discount_amount', 'promo_code_id', 'plan_promotion_id', 'branch_id'];
        $details = array_intersect_key($validated, array_flip($detailCols));

        // One transaction around every write so a failure anywhere (bad
        // status, membership unique-index collision, connection blip)
        // leaves the payment's money fields, its status, and the linked
        // membership untouched together — no half-applied confirmations.
        DB::transaction(function () use ($id, $gymId, $validated, $details) {
            // Editable detail fields land on the SAME row; update_payment()
            // below only touches status / paid_at / notes.
            if ($details !== []) {
                DB::table('payments')
                    ->where('id', $id)
                    ->where('gym_id', $gymId)
                    ->update($details + ['updated_at' => now()]);
            }

            DB::select('SELECT update_payment(?, ?, ?, ?, ?)', [
                $id,
                $gymId,
                $validated['status'] ?? null,
                $validated['paid_at'] ?? null,
                $validated['notes'] ?? null,
            ]);

            $payment = Payment::where('id', $id)->where('gym_id', $gymId)->first();
            if (! $payment || ! $payment->gym_member_id) {
                return;
            }

            // Keep the linked membership's pricing in sync whenever the
            // admin adjusted amount/discount — regardless of status, so
            // a pending/overdue save can't leave final_price stale.
            if ($payment->membership_id) {
                $pricing = [];
                if (array_key_exists('amount', $details))          $pricing['final_price']     = $details['amount'];
                if (array_key_exists('original_amount', $details)) $pricing['original_price']  = $details['original_amount'];
                if (array_key_exists('discount_amount', $details)) $pricing['discount_amount'] = $details['discount_amount'];
                if (array_key_exists('promo_code_id', $details))   $pricing['promo_code_id']   = $details['promo_code_id'];
                if (array_key_exists('plan_promotion_id', $details)) $pricing['plan_promotion_id'] = $details['plan_promotion_id'];
                if ($pricing !== []) {
                    DB::table('member_memberships')
                        ->where('id', $payment->membership_id)
                        ->update($pricing + ['updated_at' => now()]);
                }
            }

            if (($validated['status'] ?? '') !== 'paid') {
                return;
            }

            // When payment is marked as paid, assign member_number if not
            // yet assigned and activate/settle the linked membership.
            $this->assignMemberNumberIfMissing($payment->gym_member_id, $gymId);

            if ($payment->membership_id) {
                $membership = DB::table('member_memberships')
                    ->where('id', $payment->membership_id)
                    ->first();
                if (! $membership) {
                    return;
                }

                // Memberships created as pending (e.g. Paymob intentions)
                // activate once the payment is confirmed. A newly-activating
                // subscription displaces other active subscriptions — same
                // rule as the Paymob webhook and MembershipController::assign
                // — which also avoids colliding with the partial unique index
                // idx_one_active_subscription_per_member.
                if ($membership->status === 'pending' && $membership->source_type === 'subscription') {
                    DB::table('member_memberships')
                        ->where('gym_member_id', $membership->gym_member_id)
                        ->where('id', '!=', $membership->id)
                        ->where('status', 'active')
                        ->where('source_type', 'subscription')
                        ->update(['status' => 'expired', 'updated_at' => now()]);

                    DB::table('gym_members')
                        ->where('id', $payment->gym_member_id)
                        ->where('status', '!=', 'active')
                        ->update(['status' => 'active', 'updated_at' => now()]);
                }

                DB::table('member_memberships')
                    ->where('id', $payment->membership_id)
                    ->where('payment_status', 'pending')
                    ->update(['payment_status' => 'paid', 'updated_at' => now()]);

                DB::table('member_memberships')
                    ->where('id', $payment->membership_id)
                    ->where('status', 'pending')
                    ->update(['status' => 'active', 'updated_at' => now()]);
            }
        });

        return response()->json(['message' => 'Payment updated successfully']);
    }

    /**
     * Assign the next sequential member_number if the member doesn't have
     * one yet. Must run inside a transaction (uses row + advisory locks).
     */
    private function assignMemberNumberIfMissing(string $gymMemberId, string $gymId): void
    {
        $gymMember = DB::table('gym_members')
            ->where('id', $gymMemberId)
            ->lockForUpdate()
            ->first();

        if ($gymMember && $gymMember->member_number === null) {
            // Postgres forbids FOR UPDATE with aggregates; use advisory
            // lock keyed on gym_id to serialize member-number allocation.
            DB::select('SELECT pg_advisory_xact_lock(?)', [crc32((string) $gymId)]);
            $maxNumber = DB::table('gym_members')
                ->where('gym_id', $gymId)
                ->whereNotNull('member_number')
                ->max('member_number') ?? 0;

            DB::table('gym_members')
                ->where('id', $gymMemberId)
                ->update(['member_number' => $maxNumber + 1]);
        }
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        DB::select('SELECT delete_payment(?, ?)', [$id, $gymId]);

        return response()->json(['message' => 'Payment deleted successfully']);
    }

    public function stampTransaction(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'transaction_id' => 'required|string',
        ]);

        $gymId = $request->user()->gym_id;
        $payment = Payment::where('id', $id)->where('gym_id', $gymId)->first();
        if (! $payment) {
            return response()->json(['error' => 'Payment not found'], 404);
        }

        DB::select('SELECT stamp_paymob_transaction_id(?, ?)', [
            $id,
            $validated['transaction_id'],
        ]);

        return response()->json(['message' => 'Transaction ID stamped successfully']);
    }
}
