<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

use \App\Traits\LogsActivity;

class MembershipController extends Controller
{
    use LogsActivity;
    use ResolvesMemberScope;

    /**
     * Aggregated list of all member memberships for the admin's gym.
     * Powers the "Memberships" sub-tab under Members → operational view
     * for follow-ups, retention, and renewals.
     *
     * Filters (all optional):
     *   search          — member name or member_number
     *   status          — active | expired | expiring_soon (derived)
     *   plan_type       — sessions | duration | duration_session
     *   start_from / start_to — start_date range (yyyy-mm-dd)
     *   end_from / end_to     — end_date range (yyyy-mm-dd)
     *   expiring_days   — threshold for "expiring soon" (default 7)
     *   page, limit     — pagination
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => 'nullable|string|max:120',
            'status' => 'nullable|string|in:all,active,expired,expiring_soon',
            'plan_type' => 'nullable|string|max:30',
            'source_type' => 'nullable|string|in:all,subscription,transfer',
            'start_from' => 'nullable|date',
            'start_to' => 'nullable|date',
            'end_from' => 'nullable|date',
            'end_to' => 'nullable|date',
            'expiring_days' => 'nullable|integer|min:1|max:90',
            'page' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:200',
        ]);

        $gymId = $request->user()->gym_id;
        if (! $gymId) {
            return response()->json(['data' => [], 'pagination' => ['page' => 1, 'pages' => 1, 'total' => 0, 'limit' => 0], 'summary' => ['active' => 0, 'expiring_soon' => 0, 'expired' => 0]]);
        }

        $threshold = $validated['expiring_days'] ?? 7;
        $page  = $validated['page'] ?? 1;
        $limit = $validated['limit'] ?? 25;

        // Derived display status — the rule depends on the plan_type so a
        // sessions-only plan doesn't get marked expired just because its
        // end_date drifted past, and a duration plan doesn't get marked
        // expired just because the (irrelevant) sessions counter is zero.
        //   • sessions (finite count)  → expired when sessions_remaining = 0
        //   • duration / duration_session → expired when end_date < now()
        //   • unlimited sessions (sessions_total IS NULL) → expired on end_date
        // The end_date column is independent — it can be stored alongside
        // any plan but only drives the rule for time-bound plan types.
        $displayStatusSql = "CASE
            WHEN mm.status <> 'active' OR mm.payment_status <> 'paid' THEN 'expired'
            WHEN COALESCE(mp.plan_type, 'duration') = 'sessions'
              AND mm.sessions_total IS NOT NULL THEN
              -- Finite session bucket (including 0). NULL means unlimited
              -- and falls through to the time-based branch below.
              CASE
                WHEN COALESCE(mm.sessions_remaining, mm.sessions_total - mm.sessions_used) <= 0 THEN 'expired'
                ELSE 'active'
              END
            WHEN mm.end_date IS NULL THEN 'active'
            WHEN mm.end_date < NOW() THEN 'expired'
            WHEN mm.end_date <= NOW() + (? || ' days')::interval THEN 'expiring_soon'
            ELSE 'active'
          END";

        $base = DB::table('member_memberships as mm')
            ->join('gym_members as gm', 'gm.id', '=', 'mm.gym_member_id')
            ->join('profiles as p', 'p.id', '=', 'gm.user_id')
            ->leftJoin('membership_plans as mp', 'mp.id', '=', 'mm.plan_id')
            ->where('mm.gym_id', $gymId)
            ->whereNull('gm.deleted_at');

        if ($search = trim($validated['search'] ?? '')) {
            $like = "%{$search}%";
            $base->where(function ($q) use ($like) {
                $q->where('p.full_name', 'ilike', $like)
                  ->orWhere('gm.member_number', 'ilike', $like)
                  ->orWhere('p.email', 'ilike', $like);
            });
        }

        if (($pt = $validated['plan_type'] ?? null) && $pt !== 'all') {
            $base->where('mp.plan_type', $pt);
        }

        if (($src = $validated['source_type'] ?? null) && $src !== 'all') {
            $base->where('mm.source_type', $src);
        }

        if ($validated['start_from'] ?? null) $base->where('mm.start_date', '>=', $validated['start_from']);
        if ($validated['start_to']   ?? null) $base->where('mm.start_date', '<=', $validated['start_to'] . ' 23:59:59');
        if ($validated['end_from']   ?? null) $base->where('mm.end_date',   '>=', $validated['end_from']);
        if ($validated['end_to']     ?? null) $base->where('mm.end_date',   '<=', $validated['end_to']   . ' 23:59:59');

        // Apply derived-status filter via a HAVING-equivalent: wrap in a CTE
        // would be ideal, but the simpler approach is to filter on the raw
        // conditions inline.
        $statusFilter = $validated['status'] ?? 'all';
        if ($statusFilter !== 'all') {
            $base->whereRaw("$displayStatusSql = ?", [$threshold, $statusFilter]);
        }

        $countQuery = (clone $base);
        $total = $countQuery->count();

        // last_check_in_at via LATERAL with LIMIT 1 over the (gym_member_id,
        // check_in_at DESC) index. Avoids a per-row correlated subquery
        // that would re-scan attendance_logs for every membership row.
        $rows = (clone $base)
            ->leftJoin(
                DB::raw(<<<'SQL'
                    LATERAL (
                        SELECT al.check_in_at
                        FROM attendance_logs al
                        WHERE al.gym_member_id = mm.gym_member_id
                        ORDER BY al.check_in_at DESC
                        LIMIT 1
                    ) last_attend
                SQL),
                DB::raw('true'), '=', DB::raw('true')
            )
            ->select([
                'mm.id',
                'mm.gym_member_id',
                'gm.member_number',
                'p.full_name as member_name',
                'p.email as member_email',
                'p.photo_url as member_photo_url',
                'mm.plan_id',
                DB::raw('COALESCE(mp.name, mm.notes) as plan_name'),
                'mp.plan_type',
                'mm.status',
                'mm.payment_status',
                'mm.source_type',
                'mm.start_date',
                'mm.end_date',
                'mm.sessions_total',
                'mm.sessions_used',
                'mm.sessions_remaining',
                DB::raw("EXTRACT(DAY FROM (mm.end_date - NOW()))::int as days_remaining"),
                DB::raw("$displayStatusSql as display_status"),
                DB::raw('last_attend.check_in_at as last_check_in_at'),
            ])
            ->addBinding($threshold, 'select')        // for the display_status CASE
            ->orderByRaw("CASE
                WHEN mm.end_date IS NULL THEN 1
                ELSE 0
              END")
            ->orderBy('mm.end_date', 'asc')
            ->orderBy('mm.start_date', 'desc')
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get();

        // Summary counts across the whole filtered set (ignoring pagination
        // and the status filter so the cards reflect the full picture).
        $summaryBase = DB::table('member_memberships as mm')
            ->join('gym_members as gm', 'gm.id', '=', 'mm.gym_member_id')
            ->join('profiles as p', 'p.id', '=', 'gm.user_id')
            ->leftJoin('membership_plans as mp', 'mp.id', '=', 'mm.plan_id')
            ->where('mm.gym_id', $gymId)
            ->whereNull('gm.deleted_at');
        if ($search = trim($validated['search'] ?? '')) {
            $like = "%{$search}%";
            $summaryBase->where(function ($q) use ($like) {
                $q->where('p.full_name', 'ilike', $like)
                  ->orWhere('gm.member_number', 'ilike', $like)
                  ->orWhere('p.email', 'ilike', $like);
            });
        }
        if (($pt = $validated['plan_type'] ?? null) && $pt !== 'all') {
            $summaryBase->where('mp.plan_type', $pt);
        }
        if (($src = $validated['source_type'] ?? null) && $src !== 'all') {
            $summaryBase->where('mm.source_type', $src);
        }
        if ($validated['start_from'] ?? null) $summaryBase->where('mm.start_date', '>=', $validated['start_from']);
        if ($validated['start_to']   ?? null) $summaryBase->where('mm.start_date', '<=', $validated['start_to'] . ' 23:59:59');
        if ($validated['end_from']   ?? null) $summaryBase->where('mm.end_date',   '>=', $validated['end_from']);
        if ($validated['end_to']     ?? null) $summaryBase->where('mm.end_date',   '<=', $validated['end_to']   . ' 23:59:59');

        $summary = $summaryBase
            ->select([
                DB::raw("COUNT(*) FILTER (WHERE $displayStatusSql = 'active') as active"),
                DB::raw("COUNT(*) FILTER (WHERE $displayStatusSql = 'expiring_soon') as expiring_soon"),
                DB::raw("COUNT(*) FILTER (WHERE $displayStatusSql = 'expired') as expired"),
            ])
            ->addBinding($threshold, 'select')
            ->addBinding($threshold, 'select')
            ->addBinding($threshold, 'select')
            ->first();

        return response()->json([
            'data' => $rows,
            'pagination' => [
                'page' => (int) $page,
                'pages' => max(1, (int) ceil($total / $limit)),
                'total' => $total,
                'limit' => (int) $limit,
            ],
            'summary' => [
                'active' => (int) ($summary->active ?? 0),
                'expiring_soon' => (int) ($summary->expiring_soon ?? 0),
                'expired' => (int) ($summary->expired ?? 0),
            ],
        ]);
    }

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

        // Plan must be in caller's gym, active, and not soft-deleted.
        // Without these filters an admin could assign a foreign tenant's
        // plan, an archived plan, or a deleted plan — all of which would
        // fail the catalog rules but write a real entitlement row.
        $plan = DB::table('membership_plans')
            ->where('id', $validated['plan_id'])
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();
        if (! $plan) {
            return response()->json(['error' => 'Plan not available'], 404);
        }

        // Target member must be in caller's gym and not soft-deleted.
        $memberInGym = DB::table('gym_members')
            ->where('id', $validated['gym_member_id'])
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->exists();
        if (! $memberInGym) {
            return response()->json(['error' => 'Member not in this gym'], 404);
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
            // Deactivate any existing active SUBSCRIPTION memberships for
            // this member. Transferred buckets are independent entitlements
            // and must survive a new subscription assignment.
            DB::table('member_memberships')
                ->where('gym_member_id', $validated['gym_member_id'])
                ->where('status', 'active')
                ->where('source_type', 'subscription')
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

        // Non-admin callers can only freeze/unfreeze their own membership.
        // Without this any logged-in member could freeze someone else's
        // entitlement by guessing the membership UUID.
        if (! $this->callerIsAdmin($request)) {
            $ownMemberId = $this->callerOwnMemberId($request);
            if (! $ownMemberId || $membership->gym_member_id !== $ownMemberId) {
                return response()->json(['error' => 'Forbidden'], 403);
            }
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
    public function freezeLogs(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $membership = DB::table('member_memberships')
            ->where('id', $id)
            ->where('gym_id', $gymId)
            ->first();
        if (! $membership) {
            return response()->json(['error' => 'Membership not found'], 404);
        }

        // Non-admin callers can only read their own freeze history.
        if (! $this->callerIsAdmin($request)) {
            $ownMemberId = $this->callerOwnMemberId($request);
            if (! $ownMemberId || $membership->gym_member_id !== $ownMemberId) {
                return response()->json(['error' => 'Forbidden'], 403);
            }
        }

        $logs = DB::table('membership_freeze_logs')
            ->where('membership_id', $id)
            ->where('gym_id', $gymId)
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
            'action' => 'sometimes|string|in:log',
            'status' => 'sometimes|string|in:active,expired,cancelled,frozen',
            'payment_status' => 'sometimes|string|in:paid,unpaid,pending,partial,refunded',
            'notes' => 'nullable|string',
        ]);

        // Action: log a session (admin-triggered manual consumption).
        // Atomically increments sessions_used / decrements sessions_remaining.
        if (($validated['action'] ?? null) === 'log') {
            return DB::transaction(function () use ($id, $gymId) {
                $membership = DB::table('member_memberships')
                    ->where('id', $id)
                    ->where('gym_id', $gymId)
                    ->lockForUpdate()
                    ->first();

                if (! $membership) {
                    return response()->json(['error' => 'Membership not found'], 404);
                }
                if ($membership->status !== 'active') {
                    return response()->json(['error' => 'Membership is not active'], 422);
                }
                $used = (int) ($membership->sessions_used ?? 0);
                // NULL sessions_total = unlimited for the plan's time window.
                $isUnlimited = $membership->sessions_total === null;
                $total = $isUnlimited ? null : (int) $membership->sessions_total;
                $remaining = $isUnlimited
                    ? null
                    : (int) ($membership->sessions_remaining ?? max(0, ($total ?? 0) - $used));

                if (! $isUnlimited && $remaining !== null && $remaining <= 0) {
                    return response()->json(['error' => 'No sessions remaining'], 422);
                }

                $newUsed = $used + 1;
                $newRemaining = $isUnlimited ? null : max(0, ($total ?? 0) - $newUsed);

                DB::table('member_memberships')
                    ->where('id', $id)
                    ->update([
                        'sessions_used' => $newUsed,
                        'sessions_remaining' => $newRemaining,
                        'updated_at' => now(),
                    ]);

                return response()->json([
                    'sessionCount' => $total,
                    'sessionsUsed' => $newUsed,
                    'sessionsRemaining' => $newRemaining,
                    'unlimited' => $isUnlimited,
                ]);
            });
        }

        // Plain field update.
        $update = array_diff_key($validated, ['action' => true]);
        if (!empty($update)) {
            DB::table('member_memberships')
                ->where('id', $id)
                ->where('gym_id', $gymId)
                ->update(array_merge($update, ['updated_at' => now()]));
        }

        return response()->json(['message' => 'Updated']);
    }

    /**
     * Mobile self-purchase — user buys a membership for themselves.
     *
     * Price is *always* derived from the plan row in the caller's gym;
     * client-supplied `amount` is no longer trusted. The plan must be
     * active, not soft-deleted, and belong to the caller's gym.
     */
    public function purchase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => 'required|uuid',
            'currency' => 'nullable|string|max:5',
            'payment_method' => 'nullable|string|max:50',
            'start_date' => 'nullable|date',
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

        $plan = DB::table('membership_plans')
            ->where('id', $validated['plan_id'])
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();
        if (! $plan) {
            return response()->json(['error' => 'Plan not available for purchase'], 404);
        }

        $startDate = $validated['start_date'] ?? now()->toDateString();
        $expiryDays = $plan->duration_days ?? $plan->session_expiry_days ?? null;
        $endDate = $expiryDays ? date('Y-m-d', strtotime($startDate . " + {$expiryDays} days")) : null;

        // Server-derived price. Promo discounts are validated against the
        // promo_codes table and applied here, not by the client.
        $originalAmount = (float) ($plan->price ?? 0);
        $amount = $originalAmount;
        if (! empty($validated['promo_code_id'])) {
            $promo = DB::table('promo_codes')
                ->where('id', $validated['promo_code_id'])
                ->where('gym_id', $gymId)
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->first();
            if ($promo) {
                if ($promo->discount_type === 'percent') {
                    $amount = round($originalAmount * (1 - ((float) $promo->discount_value / 100)), 2);
                } elseif ($promo->discount_type === 'fixed') {
                    $amount = max(0, round($originalAmount - (float) $promo->discount_value, 2));
                }
            }
        }

        return DB::transaction(function () use ($validated, $gymId, $gymMember, $plan, $startDate, $endDate, $amount, $originalAmount) {
            // Self-purchase creates a *pending* membership. The Paymob
            // webhook flips it to 'active' on payment confirmation. Until
            // now this row was created as 'active' immediately, which let
            // a hostile client call this endpoint and walk straight into
            // the gym without paying.
            //
            // Existing active subscriptions are NOT yet expired here —
            // we only displace them when the new purchase is confirmed
            // paid (in the webhook). This avoids cancelling a paid
            // membership for a payment that never completes.
            $membershipId = \Illuminate\Support\Str::uuid()->toString();

            DB::table('member_memberships')->insert([
                'id' => $membershipId,
                'gym_member_id' => $gymMember->id,
                'plan_id' => $validated['plan_id'],
                'gym_id' => $gymId,
                'status' => 'pending',
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
                'source_type' => 'subscription',
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
            'currency' => 'nullable|string|max:5',
            'payment_method' => 'nullable|string|max:50',
            'specialist_name' => 'nullable|string|max:255',
            'trainer_id' => 'nullable|uuid',
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

        $package = DB::table('service_session_packages')
            ->where('id', $validated['package_id'])
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();
        if (! $package || $package->price === null) {
            return response()->json(['error' => 'Package not available for purchase'], 404);
        }

        $trainerName = $validated['specialist_name'] ?? null;
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

        // Server-derived price.
        $originalAmount = (float) $package->price;
        $amount = $originalAmount;
        if (! empty($validated['promo_code_id'])) {
            $promo = DB::table('promo_codes')
                ->where('id', $validated['promo_code_id'])
                ->where('gym_id', $gymId)
                ->where('is_active', true)
                ->whereNull('deleted_at')
                ->first();
            if ($promo) {
                if ($promo->discount_type === 'percent') {
                    $amount = round($originalAmount * (1 - ((float) $promo->discount_value / 100)), 2);
                } elseif ($promo->discount_type === 'fixed') {
                    $amount = max(0, round($originalAmount - (float) $promo->discount_value, 2));
                }
            }
        }

        return DB::transaction(function () use ($validated, $gymId, $gymMember, $package, $amount, $originalAmount, $trainerName) {
            // Create the assignment as 'pending' so the member doesn't
            // get free PT/Physio/Nutrition sessions before Paymob confirms.
            // The assignment_id is stashed on the payment so the webhook
            // can flip it to 'active' atomically with marking paid.
            $assignmentId = \Illuminate\Support\Str::uuid()->toString();
            DB::table('member_service_assignments')->insert([
                'id' => $assignmentId,
                'gym_id' => $gymId,
                'gym_member_id' => $gymMember->id,
                'service_package_id' => $package->id,
                'trainer_id' => $validated['trainer_id'] ?? null,
                'trainer_name' => $trainerName,
                'package_name' => $package->name,
                'service_type' => $package->trainer_type,
                'sessions_total' => $package->session_count,
                'sessions_used' => 0,
                'status' => 'pending',
                'notes' => null,
                'assigned_at' => now(),
                'created_at' => now(),
            ]);

            $paymentId = \Illuminate\Support\Str::uuid()->toString();
            DB::table('payments')->insert([
                'id' => $paymentId,
                'gym_id' => $gymId,
                'gym_member_id' => $gymMember->id,
                'service_assignment_id' => $assignmentId,
                'amount' => $amount,
                'original_amount' => $originalAmount,
                'currency' => $validated['currency'] ?? 'EGP',
                'payment_method' => $validated['payment_method'] ?? 'card',
                'status' => 'pending',
                'source' => 'mobile_app',
                'service_type' => 'service_package',
                'service_name' => $package->name,
                'specialist_name' => $trainerName,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'id' => $paymentId,
                'assignment_id' => $assignmentId,
            ], 201);
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

        // Detach only targets the active subscription. Transferred-session
        // buckets are independent entitlements and must survive — they were
        // gifted by another member and shouldn't disappear when admin
        // detaches a paid plan.
        $membership = DB::table('member_memberships')
            ->where('gym_member_id', $memberId)
            ->where('status', 'active')
            ->where('source_type', 'subscription')
            ->first();

        if (! $membership) {
            return response()->json(['error' => 'Member has no active subscription plan to detach'], 422);
        }

        // Get plan name for logging
        $planName = DB::table('membership_plans')
            ->where('id', $membership->plan_id)
            ->value('name') ?? 'Unknown';

        $memberName = DB::table('profiles')
            ->where('id', $member->user_id)
            ->value('full_name') ?? 'Unknown';

        return DB::transaction(function () use ($memberId, $membership, $gymId, $request, $planName, $memberName) {
            // Cancel the membership
            DB::table('member_memberships')
                ->where('id', $membership->id)
                ->update([
                    'status' => 'cancelled',
                    'cancelled_at' => now(),
                    'cancellation_reason' => 'Plan detached by admin',
                    'updated_at' => now(),
                ]);

            // Cancel future confirmed session bookings (the live booking table is session_bookings).
            $cancelledBookings = DB::table('session_bookings')
                ->where('gym_member_id', $memberId)
                ->where('status', 'confirmed')
                ->whereIn('session_id', function ($q) {
                    $q->select('id')
                      ->from('class_sessions')
                      ->where('session_date', '>=', now()->toDateString());
                })
                ->update(['status' => 'cancelled', 'updated_at' => now()]);

            // Only mark member inactive if they have no other active memberships.
            $hasOtherActive = DB::table('member_memberships')
                ->where('gym_member_id', $memberId)
                ->where('status', 'active')
                ->exists();
            if (! $hasOtherActive) {
                DB::table('gym_members')
                    ->where('id', $memberId)
                    ->update(['status' => 'inactive', 'updated_at' => now()]);
            }

            $this->logActivity(
                $gymId,
                $request->user()->id,
                'detach',
                'members',
                "{$request->user()->full_name} detached {$planName} from {$memberName}",
                'member_memberships',
                $membership->id,
            );

            return response()->json([
                'message' => 'Plan detached successfully',
                'cancelled_bookings' => $cancelledBookings,
            ]);
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

        // Get names for logging (outside the txn).
        $sourceName = DB::table('profiles')->where('id', $source->user_id)->value('full_name') ?? 'Unknown';
        $destName = DB::table('profiles')->where('id', $dest->user_id)->value('full_name') ?? 'Unknown';

        return DB::transaction(function () use ($sourceMemberId, $destMemberId, $gymId, $request, $sourceName, $destName) {
            // Membership transfer only moves the source's active subscription
            // — transferred-session buckets are independent gifts that stay
            // with the receiver they were sent to.
            $membership = DB::table('member_memberships')
                ->where('gym_member_id', $sourceMemberId)
                ->where('status', 'active')
                ->where('source_type', 'subscription')
                ->lockForUpdate()
                ->first();

            if (! $membership) {
                return response()->json(['error' => 'Source member has no active subscription plan to transfer'], 422);
            }
            if ($membership->end_date && $membership->end_date < now()->toDateString()) {
                return response()->json(['error' => 'Cannot transfer an expired plan'], 422);
            }

            // Destination is only blocked if they already have an active
            // subscription — having transferred-session buckets shouldn't
            // prevent them from receiving a subscription transfer.
            $destActive = DB::table('member_memberships')
                ->where('gym_member_id', $destMemberId)
                ->where('status', 'active')
                ->where('source_type', 'subscription')
                ->lockForUpdate()
                ->exists();
            if ($destActive) {
                return response()->json(['error' => 'Destination member already has an active subscription plan'], 422);
            }

            $planName = DB::table('membership_plans')->where('id', $membership->plan_id)->value('name') ?? 'Unknown';
            $newMembershipId = Str::uuid()->toString();

            // Copy the full plan context to the destination (preserve freeze state,
            // branch allowlist, purchase context, invitations). Start date is kept
            // so purchase history stays intact; end_date already governs expiry.
            DB::table('member_memberships')->insert([
                'id' => $newMembershipId,
                'gym_id' => $gymId,
                'gym_member_id' => $destMemberId,
                'plan_id' => $membership->plan_id,
                'status' => $membership->status,
                'payment_status' => $membership->payment_status,
                'start_date' => $membership->start_date,
                'end_date' => $membership->end_date,
                'sessions_total' => $membership->sessions_total,
                'sessions_used' => $membership->sessions_used ?? 0,
                'sessions_remaining' => $membership->sessions_remaining,
                'max_visits' => $membership->max_visits,
                'visits_used' => $membership->visits_used ?? 0,
                'invitations_remaining' => $membership->invitations_remaining ?? 0,
                'invitations_used' => $membership->invitations_used ?? 0,
                'freeze_status' => $membership->freeze_status,
                'freeze_days_used' => $membership->freeze_days_used ?? 0,
                'freeze_count' => $membership->freeze_count ?? 0,
                'frozen_at' => $membership->frozen_at,
                'frozen_until' => $membership->frozen_until,
                'branch_id' => $membership->branch_id,
                'allowed_branch_ids' => $membership->allowed_branch_ids,
                'original_price' => $membership->original_price,
                'discount_amount' => $membership->discount_amount,
                'final_price' => $membership->final_price,
                'promo_code_id' => $membership->promo_code_id,
                'plan_promotion_id' => $membership->plan_promotion_id,
                'notes' => "Transferred from {$sourceName}",
                'transferred_from' => $sourceMemberId,
                'source_type' => 'subscription',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Cancel source membership.
            DB::table('member_memberships')
                ->where('id', $membership->id)
                ->update([
                    'status' => 'cancelled',
                    'cancelled_at' => now(),
                    'cancellation_reason' => "Transferred to {$destName}",
                    'transferred_to' => $destMemberId,
                    'updated_at' => now(),
                ]);

            // Member status flips: source inactive (iff no other active plans), destination active.
            $sourceHasOtherActive = DB::table('member_memberships')
                ->where('gym_member_id', $sourceMemberId)
                ->where('status', 'active')
                ->exists();
            if (! $sourceHasOtherActive) {
                DB::table('gym_members')->where('id', $sourceMemberId)
                    ->update(['status' => 'inactive', 'updated_at' => now()]);
            }
            DB::table('gym_members')->where('id', $destMemberId)
                ->update(['status' => 'active', 'updated_at' => now()]);

            // Cancel source's future confirmed session bookings.
            $cancelledBookings = DB::table('session_bookings')
                ->where('gym_member_id', $sourceMemberId)
                ->where('status', 'confirmed')
                ->whereIn('session_id', function ($q) {
                    $q->select('id')
                      ->from('class_sessions')
                      ->where('session_date', '>=', now()->toDateString());
                })
                ->update(['status' => 'cancelled', 'updated_at' => now()]);

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
                'cancelled_bookings' => $cancelledBookings,
            ]);
        });
    }

    /**
     * Bucket-aware membership summary for the authenticated user.
     *
     * Returns aggregated totals (for the unified membership card) plus the
     * per-bucket detail (for the Active Services list and transferred-bucket
     * audit). Mobile renders the unified view; admin views render the
     * buckets[] breakdown directly.
     */
    public function mySummary(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $gymId  = $request->query('gym_id') ?: $request->user()->gym_id;

        if (! $gymId) {
            return response()->json([
                'total_sessions'   => 0,
                'next_expiry_date' => null,
                'breakdown'        => ['original_sessions' => 0, 'transferred_sessions' => 0],
                'buckets'          => [],
            ]);
        }

        $gymMember = DB::table('gym_members')
            ->where('user_id', $userId)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        if (! $gymMember) {
            return response()->json([
                'total_sessions'   => 0,
                'next_expiry_date' => null,
                'breakdown'        => ['original_sessions' => 0, 'transferred_sessions' => 0],
                'buckets'          => [],
            ]);
        }

        // Eligible buckets only — anything expired or not paid is excluded
        // from totals and breakdown. We still return them under buckets[]
        // when expired so admin views can show history if they want; mobile
        // filters by status client-side. For now keep it tight: only valid.
        $rows = DB::table('member_memberships AS mm')
            ->leftJoin('membership_plans AS mp', 'mp.id', '=', 'mm.plan_id')
            ->leftJoin('member_memberships AS src', 'src.id', '=', 'mm.transferred_from')
            ->leftJoin('gym_members AS src_gm', 'src_gm.id', '=', 'src.gym_member_id')
            ->leftJoin('profiles AS src_user', 'src_user.id', '=', 'src_gm.user_id')
            ->where('mm.gym_member_id', $gymMember->id)
            ->where('mm.status', 'active')
            ->where('mm.payment_status', 'paid')
            ->where(function ($q) {
                $q->whereNull('mm.end_date')->orWhere('mm.end_date', '>=', DB::raw('CURRENT_DATE'));
            })
            // Exclude exhausted session-based buckets so the membership card
            // clears once the user has consumed everything. Duration-only
            // plans (no session concept) and unlimited session plans
            // (sessions_total NULL) stay visible while inside their window.
            ->where(function ($q) {
                $q->whereNotIn('mp.plan_type', ['sessions', 'duration_session'])
                  ->orWhereNull('mm.sessions_total')
                  ->orWhere('mm.sessions_remaining', '>', 0);
            })
            ->orderByRaw("CASE mm.source_type WHEN 'subscription' THEN 0 ELSE 1 END")
            ->orderByRaw('mm.end_date ASC NULLS LAST')
            ->orderBy('mm.created_at', 'asc')
            ->select(
                'mm.id',
                'mm.source_type',
                'mm.sessions_total',
                'mm.sessions_used',
                'mm.sessions_remaining',
                'mm.end_date',
                'mm.start_date',
                'mm.branch_id',
                'mm.allowed_branch_ids',
                'mm.transferred_from',
                'mm.freeze_status',
                'mp.name as plan_name',
                'mp.plan_type',
                'mp.session_count as plan_session_count',
                'src_user.full_name as transferred_from_member_name',
            )
            ->get();

        $totalSessions        = 0;
        $originalSessions     = 0;
        $transferredSessions  = 0;
        $nextExpiry           = null;

        $buckets = $rows->map(function ($r) use (&$totalSessions, &$originalSessions, &$transferredSessions, &$nextExpiry) {
            // Unlimited only applies to session-based plans (sessions /
            // duration_session) where session_count was left blank. Pure
            // duration plans have NULL sessions_total because they don't
            // have a session concept at all — flagging them as "unlimited"
            // misleads the UI.
            $isSessionPlan = in_array($r->plan_type, ['sessions', 'duration_session'], true);
            $isUnlimited = $isSessionPlan && $r->sessions_total === null;
            // Unlimited buckets count as 0 toward total_sessions to keep the
            // unified card honest about countable credits. Mobile can still
            // render "Unlimited" for the bucket itself.
            $remaining = $isUnlimited ? 0 : (int) ($r->sessions_remaining ?? 0);

            $totalSessions += $remaining;
            if ($r->source_type === 'subscription') {
                $originalSessions += $remaining;
            } else {
                $transferredSessions += $remaining;
            }

            if ($r->end_date !== null) {
                if ($nextExpiry === null || $r->end_date < $nextExpiry) {
                    $nextExpiry = $r->end_date;
                }
            }

            return [
                'id'                          => $r->id,
                'source_type'                 => $r->source_type,
                'plan_name'                   => $r->plan_name,
                'plan_type'                   => $r->plan_type,
                'sessions_total'              => $r->sessions_total !== null ? (int) $r->sessions_total : null,
                'sessions_used'               => (int) ($r->sessions_used ?? 0),
                'sessions_remaining'          => $r->sessions_remaining !== null ? (int) $r->sessions_remaining : null,
                'is_unlimited'                => $isUnlimited,
                'start_date'                  => $r->start_date,
                'end_date'                    => $r->end_date,
                'branch_id'                   => $r->branch_id,
                'allowed_branch_ids'          => $r->allowed_branch_ids,
                'freeze_status'               => $r->freeze_status,
                'transferred_from'            => $r->transferred_from,
                'transferred_from_member_name' => $r->transferred_from_member_name,
            ];
        })->values();

        return response()->json([
            'total_sessions'   => $totalSessions,
            'next_expiry_date' => $nextExpiry,
            'breakdown'        => [
                'original_sessions'    => $originalSessions,
                'transferred_sessions' => $transferredSessions,
            ],
            'buckets' => $buckets,
        ]);
    }
}
