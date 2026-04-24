<?php

namespace App\Http\Controllers;

use App\Models\GymMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

use \App\Traits\LogsActivity;

class MemberController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => []]);
        }

        $query = GymMember::where('gym_id', $gymId)
            ->with(['user:id,full_name,email,phone,photo_url,date_of_birth,gender,email_verified', 'memberships.plan:id,name,plan_type'])
            ->whereNull('deleted_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('member_number', 'ilike', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('full_name', 'ilike', "%{$search}%")
                         ->orWhere('email', 'ilike', "%{$search}%")
                         ->orWhere('phone', 'ilike', "%{$search}%");
                  });
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        // Filter by user_id — 'self' resolves to the authenticated user
        if ($userId = $request->query('user_id')) {
            $resolvedUserId = $userId === 'self' ? $request->user()->id : $userId;
            $query->where('user_id', $resolvedUserId);
        }

        // Sort — frontend sends: newest, oldest, name, member_number
        $sort = $request->query('sort', 'newest');
        match ($sort) {
            'oldest' => $query->orderBy('created_at', 'asc'),
            'name' => $query->leftJoin('profiles', 'profiles.id', '=', 'gym_members.user_id')
                            ->orderBy('profiles.full_name', 'asc')
                            ->select('gym_members.*'),
            'member_number' => $query->orderByRaw('member_number::int ASC NULLS LAST'),
            default => $query->orderBy('created_at', 'desc'),
        };

        $members = $query->paginate($request->query('per_page', 25));

        return response()->json($members);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => null]);
        }

        $member = GymMember::where('gym_id', $gymId)
            ->with([
                'user',
                'memberships.plan',
                'attendanceLogs' => fn ($q) => $q->with('branch:id,name')->orderBy('check_in_at', 'desc')->limit(20),
            ])
            ->findOrFail($id);

        // Payments for this member
        $payments = DB::table('payments')
            ->leftJoin('promo_codes', 'promo_codes.id', '=', 'payments.promo_code_id')
            ->where('payments.gym_member_id', $id)
            ->where('payments.gym_id', $gymId)
            ->select(
                'payments.id', 'payments.amount', 'payments.original_amount',
                'payments.discount_amount', 'promo_codes.code as promo_code',
                'payments.currency', 'payments.payment_method', 'payments.status',
                'payments.notes', 'payments.paid_at', 'payments.created_at',
                'payments.source', 'payments.specialist_name',
                'payments.service_name as item_name',
            )
            ->orderBy('payments.created_at', 'desc')
            ->get()
            ->map(function ($p) {
                $p = (array) $p;
                // Cast numeric strings to floats
                foreach (['amount', 'original_amount', 'discount_amount'] as $col) {
                    if (isset($p[$col])) $p[$col] = (float) $p[$col];
                }
                return $p;
            });

        // Service assignments
        $serviceAssignments = DB::table('member_service_assignments')
            ->where('gym_member_id', $id)
            ->orderBy('assigned_at', 'desc')
            ->get();

        // Freeze logs for active membership
        $activeMembership = $member->memberships->firstWhere('status', 'active');
        $freezeLogs = $activeMembership
            ? DB::table('membership_freeze_logs')
                ->where('membership_id', $activeMembership->id)
                ->orderBy('frozen_at', 'desc')
                ->get()
            : [];

        // Other gym members for transfer modal
        $gymMembers = GymMember::where('gym_id', $gymId)
            ->where('id', '!=', $id)
            ->whereNull('deleted_at')
            ->with('user:id,full_name,email')
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'member_number' => $m->member_number,
                'full_name' => $m->user->full_name ?? null,
                'email' => $m->user->email ?? null,
            ]);

        return response()->json([
            'data' => $member,
            'payments' => $payments,
            'service_assignments' => $serviceAssignments,
            'freeze_logs' => $freezeLogs,
            'gym_members_for_transfer' => $gymMembers,
        ]);
    }

    /**
     * Admin-created member (no auth.users, no password — just profile + gym_member).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => 'required|string|max:255',
            'email' => 'nullable|email',
            'phone' => 'nullable|string|max:20',
            'gender' => 'nullable|string|max:10',
            'date_of_birth' => 'nullable|date',
            'address' => 'nullable|string|max:500',
            'status' => 'nullable|string|in:active,inactive,suspended',
            'notes' => 'nullable|string',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        return DB::transaction(function () use ($validated, $gymId) {
            $profileId = Str::uuid()->toString();

            // Create auth.users stub for FK compatibility
            DB::table('auth.users')->insertOrIgnore([
                'id' => $profileId,
                'email' => $validated['email'] ?? "{$profileId}@placeholder.local",
                'encrypted_password' => Hash::make(Str::random(32)),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Create profile
            DB::table('profiles')->insert([
                'id' => $profileId,
                'email' => $validated['email'] ?? null,
                'full_name' => $validated['full_name'],
                'phone' => $validated['phone'] ?? null,
                'gender' => $validated['gender'] ?? null,
                'date_of_birth' => $validated['date_of_birth'] ?? null,
                'address' => $validated['address'] ?? null,
                'gym_id' => $gymId,
                'role' => 'member',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Create gym member — no member_number yet (assigned when membership is paid)
            $memberId = Str::uuid()->toString();
            DB::table('gym_members')->insert([
                'id' => $memberId,
                'gym_id' => $gymId,
                'user_id' => $profileId,
                'member_number' => null,
                'status' => $validated['status'] ?? 'active',
                'notes' => $validated['notes'] ?? null,
                'joined_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'data' => ['id' => $memberId],
            ], 201);
        });
    }

    /**
     * Update member (PATCH).
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $member = GymMember::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'email' => 'nullable|email',
            'phone' => 'nullable|string|max:20',
            'gender' => 'nullable|string|max:10',
            'date_of_birth' => 'nullable|date',
            'address' => 'nullable|string|max:500',
            'status' => 'sometimes|string|in:active,inactive,suspended',
            'notes' => 'nullable|string',
        ]);

        // Update gym_member fields
        $memberFields = array_intersect_key($validated, array_flip(['status', 'notes']));
        if (! empty($memberFields)) {
            $member->update($memberFields);
        }

        // Update profile fields
        $profileFields = array_intersect_key($validated, array_flip(['full_name', 'email', 'phone', 'gender', 'date_of_birth', 'address']));
        if (! empty($profileFields) && $member->user_id) {
            DB::table('profiles')->where('id', $member->user_id)->update($profileFields);
        }

        return response()->json(['data' => $member->fresh()->load('user')]);
    }

    /**
     * Verify a member's email address (admin action).
     */
    public function verifyEmail(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $member = GymMember::where('gym_id', $gymId)
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        if (! $member) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        DB::table('profiles')
            ->where('id', $member->user_id)
            ->update(['email_verified' => true, 'updated_at' => now()]);

        return response()->json(['message' => 'Email verified successfully']);
    }

    /**
     * Soft-delete member.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        GymMember::where('gym_id', $gymId)->where('id', $id)
            ->update(['deleted_at' => now(), 'status' => 'inactive']);

        return response()->json(['message' => 'Member deleted']);
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|uuid',
            'email' => 'required|email',
            'full_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'date_of_birth' => 'nullable|date',
        ]);

        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        DB::select('SELECT register_gym_member(?, ?, ?, ?, ?, ?)', [
            $validated['user_id'],
            $gymId,
            $validated['email'],
            $validated['full_name'],
            $validated['phone'] ?? null,
            $validated['date_of_birth'] ?? null,
        ]);

        return response()->json(['message' => 'Member registered successfully'], 201);
    }

    public function deleteAccount(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;

        DB::transaction(function () use ($userId) {
            // Remove gym memberships and related data
            $memberIds = DB::table('gym_members')->where('user_id', $userId)->pluck('id');
            if ($memberIds->isNotEmpty()) {
                DB::table('session_bookings')->whereIn('gym_member_id', $memberIds)->delete();
                DB::table('member_memberships')->whereIn('gym_member_id', $memberIds)->delete();
                DB::table('attendance_logs')->whereIn('gym_member_id', $memberIds)->delete();
                DB::table('member_service_assignments')->whereIn('gym_member_id', $memberIds)->delete();
                DB::table('gym_members')->where('user_id', $userId)->delete();
            }

            // Remove profile and auth record
            DB::table('profiles')->where('id', $userId)->delete();
            DB::table('auth.users')->where('id', $userId)->delete();
        });

        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Account deleted successfully']);
    }
}
