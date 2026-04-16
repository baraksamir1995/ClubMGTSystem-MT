<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Enforces fine-grained module+action permissions from staff_role_permissions.
 *
 * Usage in routes:  ->middleware('permission:members,create')
 *
 * gym_admin bypasses all checks (full access).
 * staff/trainer must have the exact module+action in their assigned roles.
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $module, string $action)
    {
        $user = $request->user();

        // gym_admin has unrestricted access
        if ($user->role === 'gym_admin') {
            return $next($request);
        }

        // staff/trainer — check role permissions
        $hasPermission = DB::table('staff_members')
            ->join('staff_member_roles', 'staff_member_roles.staff_id', '=', 'staff_members.id')
            ->join('staff_role_permissions', 'staff_role_permissions.role_id', '=', 'staff_member_roles.role_id')
            ->where('staff_members.user_id', $user->id)
            ->where('staff_members.gym_id', $user->gym_id)
            ->whereNull('staff_members.deleted_at')
            ->where('staff_role_permissions.module', $module)
            ->where('staff_role_permissions.action', $action)
            ->exists();

        if (! $hasPermission) {
            return response()->json([
                'error' => 'Forbidden — insufficient permissions',
                'required' => "{$module}:{$action}",
            ], 403);
        }

        return $next($request);
    }
}
