<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LogActivityMiddleware
{
    /** Map route patterns to module names */
    private const MODULE_MAP = [
        'members' => 'members',
        'memberships' => 'members',
        'payments' => 'payments',
        'paymob' => 'payments',
        'classes' => 'classes',
        'sessions' => 'classes',
        'bookings' => 'classes',
        'schedule' => 'classes',
        'class-types' => 'classes',
        'promo-codes' => 'promotions',
        'plan-promotions' => 'promotions',
        'plans' => 'plans',
        'staff' => 'staff',
        'trainers' => 'services',
        'service-packages' => 'services',
        'programs' => 'services',
        'offers' => 'services',
        'attendance' => 'attendance',
        'branches' => 'settings',
        'studios' => 'settings',
        'settings' => 'settings',
        'content' => 'content',
        'notifications' => 'content',
        'invitations' => 'invitations',
    ];

    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Only log successful write operations
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            return $response;
        }

        if ($response->getStatusCode() >= 400) {
            return $response;
        }

        $user = $request->user();
        if (! $user || ! $user->gym_id) {
            return $response;
        }

        try {
            $path = $request->path();
            $module = $this->detectModule($path);
            $actionType = $this->detectAction($request->method(), $path);
            $description = $this->buildDescription($request->method(), $path, $request);

            // Get staff info. staff_id is FK -> profiles(id), not
            // staff_members(id) — see the note in LogsActivity. The catch
            // below meant this only ever silently dropped the log row, but
            // it dropped it for every staff member.
            $staffName = $user->full_name ?? 'Unknown';
            $staffId = $user->id;

            DB::table('staff_activity_logs')->insert([
                'id' => Str::uuid()->toString(),
                'gym_id' => $user->gym_id,
                'staff_id' => $staffId,
                'staff_name' => $staffName,
                'action' => $actionType,
                'action_type' => $actionType,
                'module' => $module,
                'description' => $description,
                'entity' => $module,
                'entity_id' => $this->extractEntityId($path),
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Never break the response due to logging failure
            \Log::warning('Activity log failed: ' . $e->getMessage());
        }

        return $response;
    }

    private function detectModule(string $path): string
    {
        // Remove "api/" prefix
        $path = preg_replace('/^api\//', '', $path);
        $segment = explode('/', $path)[0] ?? '';

        return self::MODULE_MAP[$segment] ?? $segment;
    }

    private function detectAction(string $method, string $path): string
    {
        if (str_contains($path, 'cancel')) return 'cancel';
        if (str_contains($path, 'checkin')) return 'checkin';
        if (str_contains($path, 'freeze')) return 'freeze';
        if (str_contains($path, 'invalidate')) return 'invalidate';
        if (str_contains($path, 'reset-password')) return 'reset_password';
        if (str_contains($path, 'publish')) return 'publish';

        return match ($method) {
            'POST' => 'create',
            'PUT', 'PATCH' => 'update',
            'DELETE' => 'delete',
            default => 'unknown',
        };
    }

    private function buildDescription(string $method, string $path, Request $request): string
    {
        $actorName = $request->user()?->full_name ?? 'Unknown';

        $action = match ($method) {
            'POST' => 'created',
            'PUT', 'PATCH' => 'updated',
            'DELETE' => 'deleted',
            default => 'modified',
        };

        $path = preg_replace('/^api\//', '', $path);
        $parts = explode('/', $path);
        $resource = rtrim($parts[0] ?? 'resource', 's');

        // Special descriptions
        if (str_contains($path, 'cancel')) return "{$actorName} cancelled a session";
        if (str_contains($path, 'checkin')) return "{$actorName} checked in a member";
        if (str_contains($path, 'assign')) return "{$actorName} assigned a membership";
        if (str_contains($path, 'extend')) return "{$actorName} extended a membership";
        if (str_contains($path, 'add-sessions')) return "{$actorName} added sessions to a membership";
        if (str_contains($path, 'freeze')) return "{$actorName} froze a membership";
        if (str_contains($path, 'unfreeze')) return "{$actorName} unfroze a membership";
        if (str_contains($path, 'reset-password')) return "{$actorName} reset a staff password";
        if (str_contains($path, 'publish')) return "{$actorName} published the schedule";
        if (str_contains($path, 'unpublish')) return "{$actorName} unpublished the schedule";
        if (str_contains($path, 'invalidate')) return "{$actorName} invalidated an invitation";
        if (str_contains($path, 'refund')) return "{$actorName} processed a refund";
        if (str_contains($path, 'verify-email')) return "{$actorName} verified a member's email";
        if (str_contains($path, 'consume')) return "{$actorName} consumed a session";

        $name = $request->input('name') ?? $request->input('full_name') ?? $request->input('title') ?? $request->input('code') ?? '';
        $suffix = $name ? " '{$name}'" : '';

        return "{$actorName} {$action} {$resource}{$suffix}";
    }

    private function extractEntityId(string $path): ?string
    {
        // Match UUID patterns in path
        if (preg_match('/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i', $path, $matches)) {
            return $matches[1];
        }
        return null;
    }
}
