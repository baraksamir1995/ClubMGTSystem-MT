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
        // (member or admin) by knowing the email. Compare on LOWER(email)
        // to match the auth_users/profiles email_lower_unique indexes, and
        // also check auth.users so an orphaned shim row can't 500 the
        // insert below.
        $emailLower = strtolower($validated['email']);
        $existing = DB::table('profiles')
            ->whereRaw('LOWER(email) = ?', [$emailLower])
            ->exists()
            || DB::table('auth.users')
                ->whereRaw('LOWER(email) = ?', [$emailLower])
                ->exists();
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

        try {
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
        } catch (\Illuminate\Database\QueryException $e) {
            // 23505 = unique_violation. Race-loser path — the pre-check
            // above passed but a concurrent insert (or an index the check
            // doesn't cover) beat us. Same 422 the pre-check would return.
            if ($e->getCode() === '23505' && str_contains($e->getMessage(), 'email')) {
                return response()->json([
                    'error' => 'A user with this email already exists. Use the existing-user attach flow instead.',
                    'code' => 'email_taken',
                ], 422);
            }
            throw $e;
        }
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

        // Changing role assignments is gym_admin-only, same as role
        // definitions: otherwise staff with staff:edit could attach an
        // existing high-privilege role to their own record and escalate
        // past the storeRole/updateRole guard. The admin UI echoes the
        // current role_ids on every edit, so a payload that leaves the set
        // unchanged is allowed through (and skipped). Checked before any
        // writes so a 403 never leaves a partial update behind.
        if (array_key_exists('role_ids', $validated) && $request->user()->role !== 'gym_admin') {
            $current = array_map('strtolower', DB::table('staff_member_roles')
                ->where('staff_id', $id)->pluck('role_id')->all());
            $requested = array_map('strtolower', $validated['role_ids'] ?? []);
            sort($current);
            sort($requested);
            if ($current !== $requested) {
                return response()->json(['error' => 'Only gym admins can assign roles.'], 403);
            }
            unset($validated['role_ids']);
        }

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
            if (isset($profileFields['email'])) {
                // Same taken-email guard as store(), excluding this user —
                // without it the unique index turns a duplicate into a 500,
                // and auth.users would drift from profiles.
                $emailLower = strtolower($profileFields['email']);
                $taken = DB::table('profiles')
                    ->whereRaw('LOWER(email) = ?', [$emailLower])
                    ->where('id', '!=', $staff->user_id)
                    ->exists()
                    || DB::table('auth.users')
                        ->whereRaw('LOWER(email) = ?', [$emailLower])
                        ->where('id', '!=', $staff->user_id)
                        ->exists();
                if ($taken) {
                    return response()->json([
                        'error' => 'A user with this email already exists.',
                        'code' => 'email_taken',
                    ], 422);
                }
            }

            DB::table('profiles')->where('id', $staff->user_id)
                ->update($profileFields + ['updated_at' => now()]);

            // Keep the auth.users shim and the denormalized copies on
            // staff_members in sync with profiles.
            if (isset($profileFields['email'])) {
                DB::table('auth.users')->where('id', $staff->user_id)
                    ->update(['email' => $profileFields['email'], 'updated_at' => now()]);
            }
            $staffCopies = array_intersect_key($profileFields, array_flip(['full_name', 'email']));
            if (! empty($staffCopies)) {
                DB::table('staff_members')->where('id', $id)
                    ->update($staffCopies + ['updated_at' => now()]);
            }
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
        if (! $staff->user_id) return response()->json(['error' => 'Staff has no linked account'], 422);

        $tempPassword = Str::random(10);

        DB::table('profiles')->where('id', $staff->user_id)
            ->update(['password' => Hash::make($tempPassword), 'must_reset_password' => true]);

        // A reset is often prompted by a lost/compromised device — existing
        // sessions must die with the old password, matching deactivate/delete.
        DB::table('personal_access_tokens')
            ->where('tokenable_type', \App\Models\User::class)
            ->where('tokenable_id', $staff->user_id)
            ->delete();

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
        // Clamp: page 0/negative would produce a negative OFFSET (PG error),
        // limit 0 a DivisionByZeroError below, and an uncapped limit lets a
        // single request dump the whole log table.
        $page = max(1, (int) $request->query('page', 1));
        $limit = min(100, max(1, (int) $request->query('limit', 20)));

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

        DB::transaction(function () use ($validated, $perms, $gymId, $roleId) {
            DB::table('staff_roles')->insert([
                'id' => $roleId,
                'gym_id' => $gymId,
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
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
        });

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

        DB::transaction(function () use ($validated, $id, $gymId) {
            $roleFields = array_intersect_key($validated, array_flip(['name', 'description']));
            if (! empty($roleFields)) {
                DB::table('staff_roles')->where('id', $id)->where('gym_id', $gymId)
                    ->update($roleFields + ['updated_at' => now()]);
            }

            if (array_key_exists('permissions', $validated)) {
                DB::table('staff_role_permissions')->where('role_id', $id)->delete();
                if (! empty($validated['permissions'])) {
                    // NB: staff_role_permissions has no created_at column —
                    // including one here makes the insert fail outright.
                    $rows = array_map(fn ($p) => [
                        'id' => Str::uuid()->toString(),
                        'role_id' => $id,
                        'module' => $p['module'],
                        'action' => $p['action'],
                    ], $validated['permissions']);
                    DB::table('staff_role_permissions')->insert($rows);
                }
            }
        });

        return response()->json(['message' => 'Role updated']);
    }

    public function destroyRole(Request $request, string $id): JsonResponse
    {
        // Same guard as storeRole/updateRole — otherwise staff with
        // staff:delete could destroy role definitions and strip every
        // colleague holding them of their permissions.
        if ($request->user()->role !== 'gym_admin') {
            return response()->json(['error' => 'Only gym admins can manage roles.'], 403);
        }

        $gymId = $request->user()->gym_id;

        // Verify role belongs to this gym
        $role = DB::table('staff_roles')->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $role) return response()->json(['error' => 'Role not found'], 404);

        DB::transaction(function () use ($id, $gymId) {
            DB::table('staff_role_permissions')->where('role_id', $id)->delete();
            DB::table('staff_member_roles')->where('role_id', $id)->delete();
            DB::table('staff_roles')->where('id', $id)->where('gym_id', $gymId)->delete();
        });
        return response()->json(['message' => 'Role deleted']);
    }
}
