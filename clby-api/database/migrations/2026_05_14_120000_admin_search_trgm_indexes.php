<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Trigram indexes for the admin members / memberships search.
 *
 * MemberController::index and MembershipController::index run
 * `ILIKE '%q%'` against profiles.full_name / email / phone and
 * gym_members.member_number. The leading wildcard rules out the
 * existing btree indexes, so each keystroke seq-scans profiles
 * joined to gym_members.
 *
 * member_number is integer, so it needs an expression index on
 * `member_number::text` rather than a column index. The IMMUTABLE
 * cast is index-safe.
 *
 * The earlier 2026_05_06 migration already created pg_trgm and
 * indexes for the mobile explore search; this one fills in the
 * admin-side columns it missed.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        DB::statement('CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON profiles USING gin (full_name gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm     ON profiles USING gin (email     gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_profiles_phone_trgm     ON profiles USING gin (phone     gin_trgm_ops)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_gym_members_member_number_trgm ON gym_members USING gin ((member_number::text) gin_trgm_ops)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_gym_members_member_number_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_profiles_phone_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_profiles_email_trgm');
        DB::statement('DROP INDEX IF EXISTS idx_profiles_full_name_trgm');
        // Leave pg_trgm extension in place — other features rely on it.
    }
};
