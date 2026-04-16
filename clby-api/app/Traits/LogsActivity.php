<?php

namespace App\Traits;

use Illuminate\Support\Facades\DB;
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

        // Get staff_id from staff_members
        $staffId = DB::table('staff_members')
            ->where('user_id', $userId)
            ->where('gym_id', $gymId)
            ->whereNull('deleted_at')
            ->value('id');

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
    }
}
