<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

use \App\Traits\LogsActivity;

class AttendanceController extends Controller
{
    use LogsActivity;
    use ResolvesMemberScope;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_date' => 'nullable|date',
            'from' => 'nullable|date',
            'to_date' => 'nullable|date',
            'to' => 'nullable|date',
            'member_id' => 'nullable|uuid',
            'gym_member_id' => 'nullable|uuid',
            'access_point' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:500',
            'page' => 'nullable|integer|min:1',
            'type' => 'nullable|string',
        ]);

        $user = $request->user();
        $gymId = $user->gym_id;

        if (!$gymId) {
            return response()->json(['data' => []]);
        }

        $memberId = $validated['gym_member_id'] ?? $validated['member_id'] ?? null;

        // Non-admin roles (members) can only see their own attendance
        if (!in_array($user->role, ['gym_admin', 'staff', 'trainer', 'super_admin'])) {
            $ownMemberId = DB::table('gym_members')
                ->where('user_id', $user->id)
                ->where('gym_id', $gymId)
                ->value('id');
            if (!$ownMemberId) {
                return response()->json(['data' => [], 'pagination' => ['page' => 1, 'pages' => 1, 'total' => 0, 'limit' => 0]]);
            }
            $memberId = $ownMemberId;
        }
        $fromDate = $validated['from_date'] ?? $validated['from'] ?? null;
        $toDate = $validated['to_date'] ?? $validated['to'] ?? null;
        $perPage = $validated['limit'] ?? 25;
        $page = $validated['page'] ?? 1;

        // The member's current active subscription is fetched via a single
        // LATERAL join (one lookup per attendance row) instead of two
        // correlated subqueries (two lookups per row). At 50 rows/page that
        // halves DB round-trips and is index-friendly via the existing
        // partial index `idx_member_memberships_active`.
        $query = DB::table('attendance_logs as al')
            ->join('gym_members as gm', 'gm.id', '=', 'al.gym_member_id')
            ->join('profiles as p', 'p.id', '=', 'gm.user_id')
            ->leftJoin('branches as b', 'b.id', '=', 'al.branch_id')
            ->leftJoin('class_sessions as cs', 'cs.id', '=', 'al.class_session_id')
            ->leftJoin('classes as c', 'c.id', '=', 'cs.class_id')
            ->leftJoin('studios as st', 'st.id', '=', 'al.studio_id')
            ->leftJoin(
                DB::raw(<<<'SQL'
                    LATERAL (
                        SELECT mp.name AS plan_name, mp.plan_type
                        FROM member_memberships mm
                        JOIN membership_plans mp ON mp.id = mm.plan_id
                        WHERE mm.gym_member_id = al.gym_member_id
                          AND mm.status = 'active'
                          AND mm.source_type = 'subscription'
                        ORDER BY mm.start_date DESC
                        LIMIT 1
                    ) plan
                SQL),
                DB::raw('true'), '=', DB::raw('true')
            )
            ->where('al.gym_id', $gymId)
            ->select([
                'al.id', 'al.gym_member_id', 'gm.member_number',
                'p.full_name', 'p.photo_url', 'al.check_in_at', 'al.method',
                'al.access_point', 'b.name as branch_name',
                'al.specialist_name', 'c.name as class_name',
                'cs.session_date', DB::raw('cs.start_time::text as session_time'),
                DB::raw('COALESCE(cs.instructor, c.instructor) as instructor_name'),
                'st.name as studio_name',
                'plan.plan_name',
                'plan.plan_type',
            ]);

        if ($fromDate) $query->where('al.check_in_at', '>=', $fromDate);
        if ($toDate) $query->where('al.check_in_at', '<=', $toDate . ' 23:59:59');
        if ($memberId) $query->where('al.gym_member_id', $memberId);
        if ($validated['access_point'] ?? null) $query->where('al.access_point', $validated['access_point']);

        $total = (clone $query)->count();
        $results = $query->orderBy('al.check_in_at', 'desc')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        return response()->json([
            'data' => $results,
            'pagination' => [
                'page' => $page,
                'pages' => max(1, (int) ceil($total / $perPage)),
                'total' => $total,
                'limit' => $perPage,
            ],
        ]);
    }

    /**
     * Manual check-in with full validation:
     * 1. Verify member has active subscription
     * 2. Check plan eligibility (gym vs class)
     * 3. Validate session count for class entries
     * 4. Check plan not expired
     * 5. Prevent duplicate check-ins
     * 6. Decrement session count for class entries
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'required|uuid',
            'check_in_at' => 'nullable|date',
            'method' => 'nullable|string|max:50',
            'access_point' => 'nullable|string|max:100',
            'branch_id' => 'nullable|uuid',
            'studio_id' => 'nullable|uuid',
            'specialist_name' => 'nullable|string|max:255',
            'class_session_id' => 'nullable|uuid',
        ]);

        $gymId = $request->user()->gym_id;
        if (!$gymId) {
            return response()->json(['error' => 'No gym association found.'], 403);
        }

        $memberId = $validated['gym_member_id'];
        $classSessionId = $validated['class_session_id'] ?? null;
        $isClassEntry = $classSessionId !== null;

        // ── Step 1: Verify member exists ────────────────────────────────────
        $member = DB::table('gym_members')
            ->where('id', $memberId)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        if (!$member) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        // ── Step 2: Load active, in-window membership buckets ───────────────
        //
        // A member can hold several buckets at once — e.g. a `duration`
        // subscription PLUS transferred `sessions`. We must pick by plan
        // CAPABILITY, not just the most-recent row, otherwise gifted sessions
        // never let a duration member into a class. Ordered to mirror
        // validate_studio_access: own subscription before transferred credits,
        // earliest-expiring first.
        $memberships = DB::table('member_memberships')
            ->join('membership_plans', 'membership_plans.id', '=', 'member_memberships.plan_id')
            ->where('member_memberships.gym_member_id', $memberId)
            ->where('member_memberships.status', 'active')
            ->where(function ($q) {
                $q->whereNull('member_memberships.end_date')
                  ->orWhere('member_memberships.end_date', '>=', now()->toDateString());
            })
            ->select(
                'member_memberships.id as membership_id',
                'member_memberships.sessions_used',
                'member_memberships.sessions_remaining',
                'member_memberships.sessions_total',
                'member_memberships.freeze_status',
                'member_memberships.source_type',
                'membership_plans.plan_type',
                'membership_plans.session_count',
                'membership_plans.name as plan_name',
            )
            ->orderByRaw("CASE member_memberships.source_type WHEN 'subscription' THEN 0 ELSE 1 END")
            ->orderByRaw('member_memberships.end_date ASC NULLS LAST')
            ->orderBy('member_memberships.created_at', 'asc')
            ->get();

        if ($memberships->isEmpty()) {
            return response()->json(['error' => 'Member does not have an active subscription'], 422);
        }

        // ── Step 3: Pick the bucket that authorizes THIS entry type ─────────
        //
        // Plan capability:
        //   sessions         → classes ONLY (no gym access)
        //   duration         → gym ONLY (no class access)
        //   duration_session → BOTH gym and classes
        //
        $shouldDecrementSession = false;

        if ($isClassEntry) {
            $classCapable = $memberships->whereIn('plan_type', ['sessions', 'duration_session']);
            if ($classCapable->isEmpty()) {
                return response()->json(['error' => 'This plan does not allow class access. Duration plans are gym-only.'], 422);
            }

            // Usable = not frozen and has remaining (unbounded sessions_total
            // NULL counts as usable for its time window).
            $membership = $classCapable->first(function ($m) {
                if (($m->freeze_status ?? '') === 'frozen') return false;
                return $m->sessions_total === null || (int) ($m->sessions_remaining ?? 0) > 0;
            });

            if (!$membership) {
                // No usable class bucket — distinguish frozen-only from spent.
                if ($classCapable->every(fn ($m) => ($m->freeze_status ?? '') === 'frozen')) {
                    return response()->json(['error' => 'Membership is frozen'], 422);
                }
                return response()->json(['error' => 'No remaining sessions'], 422);
            }
            $shouldDecrementSession = true;

            // Prevent duplicate check-in for the same class session
            $alreadyCheckedIn = DB::table('attendance_logs')
                ->where('gym_member_id', $memberId)
                ->where('class_session_id', $classSessionId)
                ->exists();

            if ($alreadyCheckedIn) {
                return response()->json(['error' => 'Already checked in for this session'], 422);
            }
        } else {
            // Gym entry: any non-'sessions' plan grants gym access.
            $gymCapable = $memberships->where('plan_type', '<>', 'sessions');
            if ($gymCapable->isEmpty()) {
                return response()->json(['error' => 'This plan does not allow gym access. Session plans are class-only.'], 422);
            }

            $membership = $gymCapable->first(fn ($m) => ($m->freeze_status ?? '') !== 'frozen');
            if (!$membership) {
                return response()->json(['error' => 'Membership is frozen'], 422);
            }
        }

        // ── Step 4: Execute check-in in transaction ─────────────────────────
        $id = Str::uuid()->toString();

        return DB::transaction(function () use (
            $id, $gymId, $memberId, $validated, $classSessionId,
            $isClassEntry, $shouldDecrementSession, $membership, $member, $request
        ) {
            // Insert attendance record
            DB::table('attendance_logs')->insert([
                'id' => $id,
                'gym_id' => $gymId,
                'gym_member_id' => $memberId,
                'check_in_at' => $validated['check_in_at'] ?? now(),
                'access_point' => $validated['access_point'] ?? null,
                'method' => $validated['method'] ?? 'manual',
                'branch_id' => $validated['branch_id'] ?? null,
                'studio_id' => $validated['studio_id'] ?? null,
                'specialist_name' => $validated['specialist_name'] ?? null,
                'class_session_id' => $classSessionId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Decrement session count for class entries on session-based plans
            if ($shouldDecrementSession) {
                DB::table('member_memberships')
                    ->where('id', $membership->membership_id)
                    ->update([
                        'sessions_used' => DB::raw('sessions_used + 1'),
                        'sessions_remaining' => DB::raw('GREATEST(0, COALESCE(sessions_remaining, 0) - 1)'),
                        'updated_at' => now(),
                    ]);
            }

            // Log activity
            $memberName = DB::table('profiles')->where('id', $member->user_id)->value('full_name') ?? 'Unknown';
            $entryType = $isClassEntry
                ? ($validated['access_point'] ?? 'Class')
                : 'Gym Access';

            $description = $shouldDecrementSession
                ? "{$request->user()->full_name} checked in {$memberName} for {$entryType} (session decremented)"
                : "{$request->user()->full_name} checked in {$memberName} ({$entryType})";

            $this->logActivity(
                $gymId,
                $request->user()->id,
                'checkin',
                'attendance',
                $description,
                'attendance_logs',
                $id,
            );

            return response()->json(['data' => ['id' => $id]], 201);
        });
    }

    public function logByQr(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gym_member_id' => 'required|uuid',
            'token' => 'required|uuid',
        ]);

        // Members must scan as themselves — they don't get to pick whose
        // attendance is being logged. Admins/staff/trainers can submit
        // any member id, but it must belong to their gym.
        $resolved = $this->scopedMemberId($request, $validated['gym_member_id']);
        if (! $resolved) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Server-side gate. log_gym_attendance_by_token only checks that the
        // token exists and inserts with the BRANCH's gym, and the membership
        // rules lived only in the mobile app — so a direct API call could
        // log attendance in another gym, or with a frozen / non-gym plan.
        // These checks mirror the app's existing rules exactly
        // (qr_scanner_screen.dart) and reuse the reason codes it already
        // maps to messages, so behaviour for normal app users is unchanged.
        if ($denied = $this->gymEntryDenial($resolved, $validated['token'])) {
            return response()->json(['data' => ['status' => 'denied', 'reason' => $denied]]);
        }

        $result = DB::select('SELECT log_gym_attendance_by_token(?, ?) AS data', [
            $resolved,
            $validated['token'],
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }

    /**
     * Why a member may not enter via a branch QR token, or null when allowed.
     * Unknown / inactive tokens are left to log_gym_attendance_by_token so
     * its existing responses are unchanged.
     */
    private function gymEntryDenial(string $gymMemberId, string $token): ?string
    {
        $branch = DB::table('branches')->where('qr_token', $token)->first(['id', 'gym_id']);
        if (! $branch) {
            return null;
        }

        $member = DB::table('gym_members')
            ->where('id', $gymMemberId)->whereNull('deleted_at')->first(['gym_id']);
        // A member can only check in at their own gym's branches.
        if (! $member || $member->gym_id !== $branch->gym_id) {
            return 'not_a_member';
        }

        // The single active paid subscription (enforced by
        // idx_one_active_subscription_per_member) — same row the app uses.
        $current = DB::table('member_memberships as mm')
            ->leftJoin('membership_plans as mp', 'mp.id', '=', 'mm.plan_id')
            ->where('mm.gym_member_id', $gymMemberId)
            ->where('mm.gym_id', $member->gym_id)
            ->where('mm.source_type', 'subscription')
            ->where('mm.status', 'active')
            ->where('mm.payment_status', 'paid')
            ->first(['mm.freeze_status', 'mm.allowed_branch_ids', 'mp.plan_type']);

        if ($current) {
            if ($current->freeze_status === 'frozen') {
                return 'membership_frozen';
            }
            if (! in_array($current->plan_type, ['monthly', 'annual', 'duration', 'duration_session'], true)) {
                return 'gym_access_not_included';
            }
            $allowed = $this->pgArray($current->allowed_branch_ids);
            if (! empty($allowed) && ! in_array($branch->id, $allowed, true)) {
                return 'branch_not_included';
            }
            return null;
        }

        // No subscription: transferred sessions are studio-only.
        $hasTransfer = DB::table('member_memberships')
            ->where('gym_member_id', $gymMemberId)
            ->where('gym_id', $member->gym_id)
            ->where('source_type', 'transfer')
            ->where('status', 'active')
            ->exists();

        return $hasTransfer ? 'gym_access_not_included' : null;
    }

    /** Postgres text[] ("{a,b}") or array → list of strings. */
    private function pgArray(mixed $value): array
    {
        if (is_array($value)) return array_values(array_map('strval', $value));
        if (! is_string($value) || $value === '' || $value === '{}') return [];
        return array_values(array_filter(array_map(
            fn ($v) => trim($v, '" '),
            explode(',', trim($value, '{}'))
        ), fn ($v) => $v !== ''));
    }
}
