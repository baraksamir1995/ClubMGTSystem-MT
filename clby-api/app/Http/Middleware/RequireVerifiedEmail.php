<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Block unverified members from sensitive endpoints.
 *
 * register() issues a Sanctum token immediately so the mobile app can
 * fetch profile data and show the "verify your email" screen without
 * a second login round-trip. But that token must NOT grant access to
 * money-moving or entitlement-modifying endpoints — otherwise a fresh
 * registration is the same as a verified login for those flows.
 *
 * Apply to: purchases, attendance, transfers, freeze/unfreeze,
 * any other action that should require a verified human.
 *
 * Admin/staff/trainer/super_admin roles bypass — they're created via
 * invitation flows that don't depend on member email verification.
 */
class RequireVerifiedEmail
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (! $user) return $next($request);

        $isAdminClass = in_array($user->role, ['gym_admin', 'staff', 'trainer', 'super_admin'], true);
        if ($isAdminClass) return $next($request);

        if (! $user->email_verified) {
            return response()->json([
                'error' => 'Please verify your email before performing this action.',
                'code' => 'email_not_verified',
            ], 403);
        }

        return $next($request);
    }
}
