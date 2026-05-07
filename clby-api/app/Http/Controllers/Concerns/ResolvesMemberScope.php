<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Helper for endpoints shared between member and admin callers.
 *
 * Members must always be scoped to their own gym_member row; admins/staff/
 * trainers may pass an arbitrary id, but it must belong to their gym.
 *
 * The classic mistake is to scope only by gym_id, which is enough to keep
 * tenants apart but lets a member of gym X read every other member of
 * gym X. These helpers make the right thing the easy thing.
 */
trait ResolvesMemberScope
{
    /**
     * Roles that may act on any gym_member in their own gym.
     */
    protected array $adminRoles = ['gym_admin', 'staff', 'trainer', 'super_admin'];

    /**
     * Whether the caller is an admin-class user (free to pick which member
     * they're operating on, within their own gym).
     */
    protected function callerIsAdmin(Request $request): bool
    {
        return in_array($request->user()->role, $this->adminRoles, true);
    }

    /**
     * The caller's own gym_member id, or null if the caller doesn't have
     * a gym_member row (admins, staff, trainers, super-admins typically
     * don't — they're profiles without a membership).
     */
    protected function callerOwnMemberId(Request $request): ?string
    {
        $user = $request->user();
        if (! $user->gym_id) return null;
        return DB::table('gym_members')
            ->where('user_id', $user->id)
            ->where('gym_id', $user->gym_id)
            ->whereNull('deleted_at')
            ->value('id');
    }

    /**
     * Resolve the gym_member id this request should operate on.
     *
     *  - For admins: returns $requested if it's a member of their gym, else null.
     *  - For non-admins: ALWAYS returns the caller's own gym_member id,
     *    regardless of $requested. The hostile client cannot trick it into
     *    targeting someone else.
     *
     * Returns null when the caller has no eligible member id (e.g. a
     * non-admin user with no gym_member row, or an admin asking for a
     * member that isn't in their gym).
     */
    protected function scopedMemberId(Request $request, ?string $requested): ?string
    {
        $user = $request->user();
        if (! $user->gym_id) return null;

        if ($this->callerIsAdmin($request)) {
            if (! $requested) return null;
            $exists = DB::table('gym_members')
                ->where('id', $requested)
                ->where('gym_id', $user->gym_id)
                ->whereNull('deleted_at')
                ->exists();
            return $exists ? $requested : null;
        }

        return $this->callerOwnMemberId($request);
    }
}
