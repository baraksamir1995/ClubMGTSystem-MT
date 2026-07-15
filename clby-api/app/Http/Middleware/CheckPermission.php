<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Enforces module-level permissions from staff_role_permissions.
 *
 * Usage in routes:  ->middleware('permission:members,create')
 *
 * Access is granted per module (tab): any staff_role_permissions row for
 * the module unlocks every action in it. The action segment is kept in
 * route definitions for audit/log readability but is not part of the
 * check.
 *
 * gym_admin bypasses all checks (full access).
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $module, string $action)
    {
        $user = $request->user();

        // Inactive profiles never get past the permission gate, regardless of role.
        // Belt & braces: Sanctum tokens are also revoked on deactivation
        // (StaffController), but a stale token in flight should still be
        // rejected here.
        if (! $user->is_active) {
            return response()->json(['error' => 'Account is inactive'], 403);
        }

        // gym_admin has unrestricted access within their own gym.
        if ($user->role === 'gym_admin') {
            return $next($request);
        }

        // staff/trainer — check role permissions, with three additional
        // guards beyond the module match:
        //   1. staff_roles.gym_id must equal staff_members.gym_id
        //      (closes the "cross-gym role id grants permissions" vector
        //      where a tampered request body inserted a foreign role).
        //   2. staff_members.status must be 'active' (deactivated staff
        //      can keep a valid token until expiry).
        //   3. staff_members.deleted_at must be null (already enforced).
        $hasPermission = DB::table('staff_members')
            ->join('staff_member_roles', 'staff_member_roles.staff_id', '=', 'staff_members.id')
            ->join('staff_roles', function ($join) {
                $join->on('staff_roles.id', '=', 'staff_member_roles.role_id')
                     ->whereColumn('staff_roles.gym_id', '=', 'staff_members.gym_id');
            })
            ->join('staff_role_permissions', 'staff_role_permissions.role_id', '=', 'staff_roles.id')
            ->where('staff_members.user_id', $user->id)
            ->where('staff_members.gym_id', $user->gym_id)
            ->where('staff_members.status', 'active')
            ->whereNull('staff_members.deleted_at')
            ->where('staff_role_permissions.module', $module)
            ->exists();

        if (! $hasPermission) {
            return response()->json([
                'error' => 'Forbidden — insufficient permissions',
                'required' => $module,
            ], 403);
        }

        return $next($request);
    }
}
