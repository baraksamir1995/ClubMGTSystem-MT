<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Blocks regular members from admin-only endpoints.
 * Allows: gym_admin, staff, trainer
 * Blocks: member (or any other role)
 */
class RequireAdminRole
{
    private const ADMIN_ROLES = ['gym_admin', 'staff', 'trainer', 'super_admin'];

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role, self::ADMIN_ROLES)) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
