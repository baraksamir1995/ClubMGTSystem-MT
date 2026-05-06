<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

use \App\Traits\LogsActivity;

class AttendanceController extends Controller
{
    use LogsActivity;

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

        // ── Step 2: Find active membership ──────────────────────────────────
        $membership = DB::table('member_memberships')
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
                'member_memberships.freeze_status',
                'membership_plans.plan_type',
                'membership_plans.session_count',
                'membership_plans.name as plan_name',
            )
            ->orderBy('member_memberships.start_date', 'desc')
            ->first();

        if (!$membership) {
            return response()->json(['error' => 'Member does not have an active subscription'], 422);
        }

        if ($membership->freeze_status === 'frozen') {
            return response()->json(['error' => 'Membership is frozen'], 422);
        }

        // ── Step 3: Validate entry type vs plan type ────────────────────────
        //
        // Plan types:
        //   sessions         → classes ONLY (no gym access)
        //   duration         → gym ONLY (no class access)
        //   duration_session → BOTH gym and classes
        //
        $planType = $membership->plan_type;
        $shouldDecrementSession = false;

        if ($isClassEntry) {
            // Class entry: allowed for 'sessions' and 'duration_session' only
            if ($planType === 'duration') {
                return response()->json(['error' => 'This plan does not allow class access. Duration plans are gym-only.'], 422);
            }

            // Check remaining sessions (use sessions_remaining which accounts for added sessions)
            if ($membership->sessions_remaining !== null && $membership->sessions_remaining <= 0) {
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
            // Gym entry: allowed for 'duration' and 'duration_session' only
            if ($planType === 'sessions') {
                return response()->json(['error' => 'This plan does not allow gym access. Session plans are class-only.'], 422);
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

        $result = DB::select('SELECT log_gym_attendance_by_token(?, ?) AS data', [
            $validated['gym_member_id'],
            $validated['token'],
        ]);

        return response()->json([
            'data' => json_decode($result[0]->data, true),
        ]);
    }
}
