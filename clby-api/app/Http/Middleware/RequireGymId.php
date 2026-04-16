<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireGymId
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user()?->gym_id) {
            return response()->json(['message' => 'No gym association found.'], 403);
        }

        return $next($request);
    }
}
