<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
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
    use ResolvesMemberScope;

    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (!$gymId) {
            return response()->json(['data' => []]);
        }

        $query = GymMember::where('gym_id', $gymId)
            ->with(['user:id,full_name,email,phone,photo_url,date_of_birth,gender,email_verified', 'memberships.plan:id,name,plan_type'])
            ->whereNull('deleted_at');

        // Non-admin callers can only ever see themselves. Admins and
        // staff (with members,view permission upstream — see route group)
        // get the full gym list.
        if (! $this->callerIsAdmin($request)) {
            $ownMemberId = $this->callerOwnMemberId($request);
            if (! $ownMemberId) {
                return response()->json(['data' => [], 'pagination' => null]);
            }
            $query->where('id', $ownMemberId);
        }

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

        // user_id filter still honoured for admin convenience; non-admins
        // are already scoped to themselves above so this can't be used to
        // pivot to another user.
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

        // Non-admin callers may only fetch their own profile. Without this
        // any logged-in member could read another member's profile,
        // payments, and last 20 check-ins.
        $scopedId = $this->scopedMemberId($request, $id);
        if (! $scopedId || $scopedId !== $id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $member = GymMember::where('gym_id', $gymId)
            ->with([
                'user',
                'memberships' => fn ($q) => $q->orderBy('start_date', 'desc'),
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

        // Other gym members for transfer modal.
        // SECURITY: previously this embed leaked full_name + email of every
        // gym member to ANY member who fetched their own record (PII leak,
        // disclosed 2026-05-12). Admin/staff/trainer keep the PII (they
        // already have full member-list access anyway); non-admin members
        // get only ids + member numbers — the transfer flow can resolve a
        // chosen target's name server-side via a scoped lookup endpoint.
        $callerIsAdmin = $this->callerIsAdmin($request);
        $query = GymMember::where('gym_id', $gymId)
            ->where('id', '!=', $id)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'desc')
            ->limit(100);
        if ($callerIsAdmin) {
            $query->with('user:id,full_name,email');
        }
        $gymMembers = $query->get()->map(function ($m) use ($callerIsAdmin) {
            $row = [
                'id' => $m->id,
                'member_number' => $m->member_number,
            ];
            if ($callerIsAdmin) {
                $row['full_name'] = $m->user->full_name ?? null;
                $row['email'] = $m->user->email ?? null;
            }
            return $row;
        });

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
     * List a member's service-package assignments (PT, nutrition, physio).
     * Member-accessible: callers can read assignments inside their own gym.
     */
    public function services(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        if (! $gymId) {
            return response()->json(['data' => []]);
        }

        // Non-admin callers may only read their own service assignments.
        $scopedId = $this->scopedMemberId($request, $id);
        if (! $scopedId || $scopedId !== $id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $member = GymMember::where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->find($id);

        if (! $member) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        $assignments = DB::table('member_service_assignments')
            ->where('gym_member_id', $id)
            ->where('gym_id', $gymId)
            ->orderBy('assigned_at', 'desc')
            ->get();

        return response()->json(['data' => $assignments]);
    }

    /**
     * Admin: assign a service package to a member.
     * Creates the assignment row and a pending payment in one transaction
     * so the dashboard's Active Services panel and the member's mobile
     * profile both reflect the assignment immediately.
     */
    public function assignService(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'service_package_id' => 'required|uuid',
            'trainer_id' => 'nullable|uuid',
            'payment_method' => 'nullable|string|max:50',
            'notes' => 'nullable|string',
        ]);

        $gymId = $request->user()->gym_id;

        if (! $gymId) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        $member = GymMember::where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->find($id);

        if (! $member) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        $package = DB::table('service_session_packages')
            ->where('id', $validated['service_package_id'])
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->first();

        if (! $package) {
            return response()->json(['error' => 'Package not found'], 404);
        }

        $trainerName = null;
        if (! empty($validated['trainer_id'])) {
            $trainer = DB::table('trainer_profiles')
                ->where('id', $validated['trainer_id'])
                ->where('gym_id', $gymId)
                ->first();

            if (! $trainer) {
                return response()->json(['error' => 'Trainer not found'], 404);
            }
            $trainerName = $trainer->name;
        }

        return DB::transaction(function () use ($validated, $gymId, $member, $package, $trainerName, $request) {
            $assignmentId = Str::uuid()->toString();
            DB::table('member_service_assignments')->insert([
                'id' => $assignmentId,
                'gym_id' => $gymId,
                'gym_member_id' => $member->id,
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

            $paymentId = Str::uuid()->toString();
            DB::table('payments')->insert([
                'id' => $paymentId,
                'gym_id' => $gymId,
                'gym_member_id' => $member->id,
                'amount' => $package->price ?? 0,
                'original_amount' => $package->price ?? 0,
                'currency' => $package->currency ?? 'EGP',
                'payment_method' => $validated['payment_method'] ?? 'cash',
                'status' => 'pending',
                'source' => 'admin',
                'service_type' => 'service_package',
                'service_name' => $package->name,
                'specialist_name' => $trainerName,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'data' => [
                    'assignment_id' => $assignmentId,
                    'payment_id' => $paymentId,
                ],
            ], 201);
        });
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

        $member = DB::table('gym_members')
            ->where('gym_id', $gymId)
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();
        if (! $member) {
            return response()->json(['error' => 'Member not found'], 404);
        }

        DB::transaction(function () use ($member, $gymId, $id) {
            DB::table('gym_members')
                ->where('gym_id', $gymId)
                ->where('id', $id)
                ->update(['deleted_at' => now(), 'status' => 'inactive', 'updated_at' => now()]);

            // Lock the linked profile out of the API too — until now,
            // soft-deleting a gym_member left the profile and its
            // Sanctum tokens fully active. The deleted member could
            // keep using their bearer token.
            //
            // Only lock the profile if THIS gym was their only
            // affiliation. Members who belong to multiple gyms (rare
            // but possible) should retain access to the others.
            if ($member->user_id) {
                $stillActiveElsewhere = DB::table('gym_members')
                    ->where('user_id', $member->user_id)
                    ->where('id', '!=', $id)
                    ->whereNull('deleted_at')
                    ->exists();
                if (! $stillActiveElsewhere) {
                    DB::table('profiles')
                        ->where('id', $member->user_id)
                        ->update(['is_active' => false, 'updated_at' => now()]);
                    DB::table('personal_access_tokens')
                        ->where('tokenable_type', \App\Models\User::class)
                        ->where('tokenable_id', $member->user_id)
                        ->delete();
                }
            }
        });

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
