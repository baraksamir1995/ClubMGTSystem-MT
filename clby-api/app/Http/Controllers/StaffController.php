<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

use \App\Traits\LogsActivity;

class StaffController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $staffRows = DB::table('staff_members')
            ->join('profiles', 'profiles.id', '=', 'staff_members.user_id')
            ->where('staff_members.gym_id', $gymId)
            ->whereNull('staff_members.deleted_at')
            ->select(
                'staff_members.id', 'staff_members.user_id', 'staff_members.gym_id',
                'staff_members.status', 'staff_members.created_at',
                'profiles.full_name', 'profiles.email', 'profiles.phone', 'profiles.photo_url',
            )
            ->orderBy('staff_members.created_at', 'desc')
            ->get();

        // Attach roles as nested array per staff member
        $staffIds = $staffRows->pluck('id');
        $roleAssignments = DB::table('staff_member_roles')
            ->join('staff_roles', 'staff_roles.id', '=', 'staff_member_roles.role_id')
            ->whereIn('staff_member_roles.staff_id', $staffIds)
            ->select('staff_member_roles.staff_id', 'staff_roles.id', 'staff_roles.name')
            ->get()
            ->groupBy('staff_id');

        $staff = $staffRows->map(function ($s) use ($roleAssignments) {
            $s = (array) $s;
            $s['roles'] = ($roleAssignments[$s['id']] ?? collect())->map(fn ($r) => [
                'id' => $r->id, 'name' => $r->name,
            ])->values()->toArray();
            return $s;
        });

        return response()->json(['data' => $staff]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'full_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'uuid',
        ]);

        $gymId = $request->user()->gym_id;

        // Reject if the email already maps to any profile. Without this,
        // updateOrInsert below would overwrite a foreign profile's gym_id,
        // role, and password — a path to taking over an existing account
        // (member or admin) by knowing the email.
        $existing = DB::table('profiles')->where('email', $validated['email'])->first();
        if ($existing) {
            return response()->json([
                'error' => 'A user with this email already exists. Use the existing-user attach flow instead.',
                'code' => 'email_taken',
            ], 422);
        }

        // Validate every role_id belongs to the caller's gym. Without this
        // a tampered request could attach roles defined in another tenant
        // and inherit those permissions.
        $roleIds = $validated['role_ids'] ?? [];
        if (! empty($roleIds)) {
            $validCount = DB::table('staff_roles')
                ->whereIn('id', $roleIds)
                ->where('gym_id', $gymId)
                ->count();
            if ($validCount !== count($roleIds)) {
                return response()->json([
                    'error' => 'One or more role IDs do not belong to this gym.',
                    'code' => 'invalid_role_ids',
                ], 422);
            }
        }

        // Generate temp password
        $tempPassword = Str::random(10);

        return DB::transaction(function () use ($validated, $gymId, $tempPassword, $roleIds) {
            $profileId = Str::uuid()->toString();

            // Create auth.users stub for FK
            DB::table('auth.users')->insert([
                'id' => $profileId,
                'email' => $validated['email'],
                'encrypted_password' => Hash::make($tempPassword),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('profiles')->insert([
                'id' => $profileId,
                'email' => $validated['email'],
                'full_name' => $validated['full_name'],
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($tempPassword),
                'gym_id' => $gymId,
                'role' => 'staff',
                'is_active' => true,
                'must_reset_password' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $staffId = Str::uuid()->toString();
            DB::table('staff_members')->insert([
                'id' => $staffId,
                'gym_id' => $gymId,
                'user_id' => $profileId,
                'full_name' => $validated['full_name'],
                'email' => $validated['email'],
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($roleIds as $roleId) {
                DB::table('staff_member_roles')->insert([
                    'staff_id' => $staffId,
                    'role_id' => $roleId,
                ]);
            }

            return response()->json([
                'data' => ['id' => $staffId],
                'tempPassword' => $tempPassword,
            ], 201);
        });
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $validated = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email',
            'phone' => 'nullable|string|max:20',
            'status' => 'sometimes|string|in:active,inactive',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'uuid',
        ]);

        $staff = DB::table('staff_members')
            ->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $staff) return response()->json(['error' => 'Staff not found'], 404);

        // Update staff_members
        if (isset($validated['status'])) {
            DB::table('staff_members')->where('id', $id)
                ->update(['status' => $validated['status'], 'updated_at' => now()]);

            // Deactivating staff must revoke any active sessions —
            // otherwise their bearer token continues to grant admin access
            // until it ages out (which Sanctum tokens never do by default).
            if ($validated['status'] === 'inactive' && $staff->user_id) {
                DB::table('profiles')
                    ->where('id', $staff->user_id)
                    ->update(['is_active' => false, 'updated_at' => now()]);
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', \App\Models\User::class)
                    ->where('tokenable_id', $staff->user_id)
                    ->delete();
            } elseif ($validated['status'] === 'active' && $staff->user_id) {
                DB::table('profiles')
                    ->where('id', $staff->user_id)
                    ->update(['is_active' => true, 'updated_at' => now()]);
            }
        }

        // Update profile fields
        $profileFields = array_intersect_key($validated, array_flip(['full_name', 'email', 'phone']));
        if (! empty($profileFields) && $staff->user_id) {
            DB::table('profiles')->where('id', $staff->user_id)->update($profileFields);
        }

        // Update roles — same gym-scoping check as create.
        if (array_key_exists('role_ids', $validated)) {
            $roleIds = $validated['role_ids'] ?? [];
            if (! empty($roleIds)) {
                $validCount = DB::table('staff_roles')
                    ->whereIn('id', $roleIds)
                    ->where('gym_id', $gymId)
                    ->count();
                if ($validCount !== count($roleIds)) {
                    return response()->json([
                        'error' => 'One or more role IDs do not belong to this gym.',
                        'code' => 'invalid_role_ids',
                    ], 422);
                }
            }
            DB::table('staff_member_roles')->where('staff_id', $id)->delete();
            foreach ($roleIds as $roleId) {
                DB::table('staff_member_roles')->insert([
                    'staff_id' => $id,
                    'role_id' => $roleId,
                ]);
            }
        }

        return response()->json(['message' => 'Staff updated']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $staff = DB::table('staff_members')
            ->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $staff) return response()->json(['error' => 'Staff not found'], 404);

        DB::table('staff_members')
            ->where('id', $id)->where('gym_id', $gymId)
            ->update(['deleted_at' => now(), 'status' => 'inactive']);

        // Soft-deleting a staff record must also lock them out of the API
        // — flip the linked profile inactive and shred their tokens.
        if ($staff->user_id) {
            DB::table('profiles')
                ->where('id', $staff->user_id)
                ->update(['is_active' => false, 'updated_at' => now()]);
            DB::table('personal_access_tokens')
                ->where('tokenable_type', \App\Models\User::class)
                ->where('tokenable_id', $staff->user_id)
                ->delete();
        }

        return response()->json(['message' => 'Staff deactivated']);
    }

    public function resetPassword(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $staff = DB::table('staff_members')
            ->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $staff) return response()->json(['error' => 'Staff not found'], 404);

        $tempPassword = Str::random(10);

        DB::table('profiles')->where('id', $staff->user_id)
            ->update(['password' => Hash::make($tempPassword), 'must_reset_password' => true]);

        return response()->json(['tempPassword' => $tempPassword]);
    }

    public function overview(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $totalStaff = DB::table('staff_members')
            ->where('gym_id', $gymId)->whereNull('deleted_at')->count();
        $activeStaff = DB::table('staff_members')
            ->where('gym_id', $gymId)->whereNull('deleted_at')->where('status', 'active')->count();
        $totalRoles = DB::table('staff_roles')->where('gym_id', $gymId)->count();

        // Role breakdown with member counts
        $roleBreakdown = DB::table('staff_roles')
            ->where('staff_roles.gym_id', $gymId)
            ->leftJoin('staff_member_roles', 'staff_member_roles.role_id', '=', 'staff_roles.id')
            ->select('staff_roles.id', 'staff_roles.name', DB::raw('COUNT(staff_member_roles.staff_id) as count'))
            ->groupBy('staff_roles.id', 'staff_roles.name')
            ->get();

        // Recent activity
        $recentActivity = DB::table('staff_activity_logs')
            ->where('gym_id', $gymId)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'totalStaff' => $totalStaff,
            'activeStaff' => $activeStaff,
            'inactiveStaff' => $totalStaff - $activeStaff,
            'totalRoles' => $totalRoles,
            'roleBreakdown' => $roleBreakdown,
            'recentActivity' => $recentActivity,
        ]);
    }

    public function activity(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $page = (int) $request->query('page', 1);
        $limit = (int) $request->query('limit', 20);

        $total = DB::table('staff_activity_logs')->where('gym_id', $gymId)->count();
        $logs = DB::table('staff_activity_logs')
            ->where('gym_id', $gymId)
            ->orderBy('created_at', 'desc')
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get();

        return response()->json([
            'logs' => $logs,
            'pagination' => [
                'page' => $page,
                'pages' => max(1, (int) ceil($total / $limit)),
                'total' => $total,
            ],
        ]);
    }

    // --- Roles ---

    public function roles(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $roles = DB::table('staff_roles')
            ->where('gym_id', $gymId)
            ->orderBy('name')
            ->get();

        $roleIds = $roles->pluck('id');

        // Permissions per role
        $perms = DB::table('staff_role_permissions')
            ->whereIn('role_id', $roleIds)
            ->select('role_id', 'module', 'action')
            ->get()
            ->groupBy('role_id');

        // Member count per role
        $memberCounts = DB::table('staff_member_roles')
            ->whereIn('role_id', $roleIds)
            ->select('role_id', DB::raw('COUNT(*) as count'))
            ->groupBy('role_id')
            ->pluck('count', 'role_id');

        $roles = $roles->map(fn ($r) => (object) array_merge(
            (array) $r,
            [
                'permissions' => ($perms[$r->id] ?? collect())->map(fn ($p) => [
                    'module' => $p->module, 'action' => $p->action,
                ])->values()->toArray(),
                'memberCount' => $memberCounts[$r->id] ?? 0,
            ],
        ));

        return response()->json(['data' => $roles]);
    }

    /**
     * Reject (module, action) pairs not in the server-side allowlist.
     * Returns the offending tuple, or null if everything checks out.
     */
    private function findInvalidPermission(array $permissions): ?string
    {
        foreach ($permissions as $p) {
            $module = (string) ($p['module'] ?? '');
            $action = (string) ($p['action'] ?? '');
            if (! \App\Support\Permissions::isValid($module, $action)) {
                return "{$module}:{$action}";
            }
        }
        return null;
    }

    public function storeRole(Request $request): JsonResponse
    {
        // Only gym_admin can mint or modify roles. Without this, any staff
        // with permission:staff,create could create a role that grants them
        // payments:delete or members:edit and assign it to themselves.
        if ($request->user()->role !== 'gym_admin') {
            return response()->json(['error' => 'Only gym admins can manage roles.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'permissions' => 'nullable|array',
            'permissions.*.module' => 'required|string',
            'permissions.*.action' => 'required|string',
        ]);

        $perms = $validated['permissions'] ?? [];
        if ($invalid = $this->findInvalidPermission($perms)) {
            return response()->json([
                'error' => "Unknown permission: {$invalid}",
                'code' => 'invalid_permission',
            ], 422);
        }

        $gymId = $request->user()->gym_id;
        $roleId = Str::uuid()->toString();

        DB::table('staff_roles')->insert([
            'id' => $roleId,
            'gym_id' => $gymId,
            'name' => $validated['name'],
            'created_at' => now(),
        ]);

        if (! empty($perms)) {
            $rows = array_map(fn ($p) => [
                'id' => Str::uuid()->toString(),
                'role_id' => $roleId,
                'module' => $p['module'],
                'action' => $p['action'],
            ], $perms);
            DB::table('staff_role_permissions')->insert($rows);
        }

        return response()->json(['data' => ['id' => $roleId]], 201);
    }

    public function updateRole(Request $request, string $id): JsonResponse
    {
        if ($request->user()->role !== 'gym_admin') {
            return response()->json(['error' => 'Only gym admins can manage roles.'], 403);
        }

        $gymId = $request->user()->gym_id;

        // Verify role belongs to this gym
        $role = DB::table('staff_roles')->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $role) return response()->json(['error' => 'Role not found'], 404);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
            'permissions' => 'nullable|array',
            'permissions.*.module' => 'required|string',
            'permissions.*.action' => 'required|string',
        ]);

        if (array_key_exists('permissions', $validated)) {
            if ($invalid = $this->findInvalidPermission($validated['permissions'] ?? [])) {
                return response()->json([
                    'error' => "Unknown permission: {$invalid}",
                    'code' => 'invalid_permission',
                ], 422);
            }
        }

        if (isset($validated['name'])) {
            DB::table('staff_roles')->where('id', $id)->where('gym_id', $gymId)->update(['name' => $validated['name']]);
        }

        if (array_key_exists('permissions', $validated)) {
            DB::table('staff_role_permissions')->where('role_id', $id)->delete();
            if (! empty($validated['permissions'])) {
                $rows = array_map(fn ($p) => [
                    'id' => Str::uuid()->toString(),
                    'role_id' => $id,
                    'module' => $p['module'],
                    'action' => $p['action'],
                    'created_at' => now(),
                ], $validated['permissions']);
                DB::table('staff_role_permissions')->insert($rows);
            }
        }

        return response()->json(['message' => 'Role updated']);
    }

    public function destroyRole(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Verify role belongs to this gym
        $role = DB::table('staff_roles')->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $role) return response()->json(['error' => 'Role not found'], 404);

        DB::table('staff_role_permissions')->where('role_id', $id)->delete();
        DB::table('staff_member_roles')->where('role_id', $id)->delete();
        DB::table('staff_roles')->where('id', $id)->where('gym_id', $gymId)->delete();
        return response()->json(['message' => 'Role deleted']);
    }
}
