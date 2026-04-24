<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Fast permission lookups for CheckPermission middleware
        DB::statement('CREATE INDEX IF NOT EXISTS idx_staff_role_permissions_role_module_action
            ON staff_role_permissions (role_id, module, action)');

        // Fast gym-scoped activity log queries (staff overview, activity page)
        DB::statement('CREATE INDEX IF NOT EXISTS idx_staff_activity_logs_gym_created
            ON staff_activity_logs (gym_id, created_at DESC)');

        // Fast staff member lookup by user_id (used in logging and permission checks)
        DB::statement('CREATE INDEX IF NOT EXISTS idx_staff_members_user_gym
            ON staff_members (user_id, gym_id) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_staff_role_permissions_role_module_action');
        DB::statement('DROP INDEX IF EXISTS idx_staff_activity_logs_gym_created');
        DB::statement('DROP INDEX IF EXISTS idx_staff_members_user_gym');
    }
};
