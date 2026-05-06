<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Performance indexes that the audit (2026-05-06) flagged as missing.
     *
     *   - pg_trgm GIN indexes on the five text columns hit by SearchController.
     *     Without these, every keystroke from the mobile search box does a
     *     sequential scan of each table.
     *   - trainer_profiles.gym_id had no index — every gym-scoped query did
     *     a sequential scan.
     */
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        DB::statement('CREATE INDEX IF NOT EXISTS idx_membership_plans_name_trgm ON membership_plans USING gin (name gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_trainer_profiles_name_trgm ON trainer_profiles USING gin (name gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_classes_name_trgm           ON classes           USING gin (name gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_gym_offers_title_trgm       ON gym_offers       USING gin (title gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_gym_programs_title_trgm     ON gym_programs     USING gin (title gin_trgm_ops)');

        DB::statement('CREATE INDEX IF NOT EXISTS idx_trainer_profiles_gym ON trainer_profiles (gym_id)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_trainer_profiles_gym');
        DB::statement('DROP INDEX IF EXISTS idx_gym_programs_title_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_gym_offers_title_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_classes_name_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_trainer_profiles_name_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_membership_plans_name_trgm');
        // Leave pg_trgm extension in place — other features may rely on it.
    }
};
