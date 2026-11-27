<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Module-level staff permission check, shared by the `permission:` route
 * middleware (CheckPermission) and code paths that must check a module per
 * item rather than per route (POST /api/attendance/sync checks it per event).
 *
 * gym_admin has unrestricted access within their own gym. staff/trainer
 * need an active, non-deleted staff_members row in their gym holding a role
 * (of the same gym) that grants one of the modules.
 */
class StaffPermission
{
    /** @param string|array<int,string> $modules any one of them grants access */
    public static function has(User $user, string|array $modules): bool
    {
        if (! $user->is_active) {
            return false;
        }
        if ($user->role === 'gym_admin') {
            return true;
        }

        return DB::table('staff_members')
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
            ->whereIn('staff_role_permissions.module', (array) $modules)
            ->exists();
    }
}
