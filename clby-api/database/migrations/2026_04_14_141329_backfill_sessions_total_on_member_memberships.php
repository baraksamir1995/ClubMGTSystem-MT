<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Backfill sessions_total from plan's session_count where missing
        DB::statement("
            UPDATE member_memberships mm
            SET sessions_total = mp.session_count
            FROM membership_plans mp
            WHERE mm.plan_id = mp.id
              AND mp.plan_type = 'sessions'
              AND mp.session_count IS NOT NULL
              AND mm.sessions_total IS NULL
        ");

        // Backfill sessions_used to 0 where null (for sessions plans)
        DB::statement("
            UPDATE member_memberships mm
            SET sessions_used = 0
            FROM membership_plans mp
            WHERE mm.plan_id = mp.id
              AND mp.plan_type = 'sessions'
              AND mm.sessions_used IS NULL
        ");

        // Recalculate sessions_remaining = sessions_total - sessions_used
        DB::statement("
            UPDATE member_memberships
            SET sessions_remaining = GREATEST(0, COALESCE(sessions_total, 0) - COALESCE(sessions_used, 0))
            WHERE sessions_total IS NOT NULL
              AND (sessions_remaining IS NULL OR sessions_remaining != GREATEST(0, sessions_total - COALESCE(sessions_used, 0)))
        ");
    }

    public function down(): void
    {
        // Not reversible — data was missing before
    }
};
