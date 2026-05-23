<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gates the /api/coach/* routes to authenticated specialists.
 *
 * A "coach" is a `profiles` user with role='trainer' AND a matching
 * `trainer_profiles` row (the specialist record). On success we resolve
 * the trainer_profile_id once and stash it on the request so the
 * controllers don't each have to re-query.
 *
 * gym_admin doesn't bypass this gate — admins use the dashboard, not the
 * coach app. We don't want a gym_admin token to accidentally act as a
 * coach (it has no trainer_profiles row anyway).
 */
class RequireCoachRole
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user || ! $user->is_active || $user->deleted_at !== null) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        if ($user->role !== 'trainer') {
            return response()->json([
                'error' => 'Coach app access requires a specialist account.',
                'code'  => 'not_a_coach',
            ], 403);
        }

        $trainer = DB::table('trainer_profiles')
            ->where('profile_id', $user->id)
            ->where('gym_id', $user->gym_id)
            ->where('is_active', true)
            ->first(['id', 'name', 'trainer_type', 'gym_id']);

        if (! $trainer) {
            return response()->json([
                'error' => 'No active specialist profile linked to this account. Ask your gym admin to verify the setup.',
                'code'  => 'no_specialist_profile',
            ], 403);
        }

        // Stash for downstream controllers — `request()->get('coach')`.
        $request->attributes->set('coach', $trainer);

        return $next($request);
    }
}
