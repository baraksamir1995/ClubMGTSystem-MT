<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Business decision (2026-08-09): every member MUST have an email.
 * Reverses this morning's 2026_08_09_120000_profiles_email_nullable —
 * that migration made the column match the then-optional validation;
 * the validation is now `required` instead (MemberController), so the
 * constraint comes back.
 *
 * Any rows created during the nullable window are backfilled with the
 * same placeholder convention the auth.users stub uses, so re-adding
 * NOT NULL cannot fail mid-deploy (migrate-on-boot aborts the container
 * on failure). Both statements are idempotent under re-runs.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE profiles SET email = id || '@placeholder.local' WHERE email IS NULL");
        DB::statement('ALTER TABLE profiles ALTER COLUMN email SET NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL');
    }
};
