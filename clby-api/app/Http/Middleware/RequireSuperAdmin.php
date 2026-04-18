<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequireSuperAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user || $user->role !== 'super_admin') {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
