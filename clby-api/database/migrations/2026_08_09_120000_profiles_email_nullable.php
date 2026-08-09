<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Admin-created members (walk-ins) have no email: MemberController::store
 * inserts profiles.email = NULL by design, but the column still carried
 * NOT NULL from the Supabase-era schema, so "Add member" without an email
 * 500'd with a not-null violation (identical on local + prod).
 *
 * Login and the profiles_email_lower_unique index are unaffected: NULLs
 * are allowed in (and excluded from) the unique index, and login always
 * matches a concrete email/username. The auth.users FK stub keeps its
 * placeholder email either way.
 *
 * DROP NOT NULL is idempotent — safe under migrate-on-boot re-runs.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL');
    }

    public function down(): void
    {
        // Backfill placeholders before restoring the constraint so the
        // rollback can't fail on rows legitimately created without email.
        DB::statement("UPDATE profiles SET email = id || '@placeholder.local' WHERE email IS NULL");
        DB::statement('ALTER TABLE profiles ALTER COLUMN email SET NOT NULL');
    }
};
