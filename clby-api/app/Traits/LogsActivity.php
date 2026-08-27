<?php

namespace App\Traits;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

trait LogsActivity
{
    protected function logActivity(
        string $gymId,
        string $userId,
        string $actionType,
        string $module,
        string $description,
        ?string $entity = null,
        ?string $entityId = null,
        ?array $details = null,
    ): void {
        // Get staff name
        $staffName = DB::table('profiles')->where('id', $userId)->value('full_name') ?? 'Unknown';

        // staff_activity_logs.staff_id is FK -> profiles(id), NOT
        // staff_members(id). Writing the staff_members id raised a 23503 for
        // anyone who actually had a staff_members row; gym owners have none,
        // so the lookup returned null and the bug stayed hidden until the
        // first real staff member checked a member in.
        $staffId = $userId;

        // An audit-log failure must never break the operation being audited —
        // the check-in/payment itself has already succeeded by this point.
        // LogActivityMiddleware takes the same stance.
        try {
            DB::table('staff_activity_logs')->insert([
                'id' => Str::uuid()->toString(),
                'gym_id' => $gymId,
                'staff_id' => $staffId,
                'staff_name' => $staffName,
                'action' => $actionType,
                'action_type' => $actionType,
                'module' => $module,
                'description' => $description,
                'entity' => $entity,
                'entity_id' => $entityId,
                'details' => $details ? json_encode($details) : null,
                'ip_address' => request()->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Activity log failed: ' . $e->getMessage());
        }
    }
}
