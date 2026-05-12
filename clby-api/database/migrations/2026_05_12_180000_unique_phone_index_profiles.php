<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Enforce one-phone-per-person uniqueness on profiles.
 *
 * Partial index: applies only to active rows with a non-null, non-empty
 * phone. Soft-deleted profiles don't block re-registration; profiles with
 * NULL or empty phone (admins/staff) aren't constrained.
 *
 * This is a STRICT migration: if any duplicate phones exist on the target
 * DB, the CREATE INDEX statement will raise an error and the deploy
 * aborts. On prod, run the diagnostic query in the docblock first; pick
 * which row in each duplicate group keeps the phone, and NULL the others
 * (or merge accounts if a real person was duplicated).
 *
 * Diagnostic — run before deploying this migration to a populated DB:
 *
 *   SELECT phone, COUNT(*), array_agg(id) AS ids, array_agg(email) AS emails
 *   FROM profiles
 *   WHERE phone IS NOT NULL AND phone <> '' AND deleted_at IS NULL
 *   GROUP BY phone HAVING COUNT(*) > 1;
 *
 * Cleanup template (keeps the OLDEST profile per phone, NULLs the rest):
 *
 *   UPDATE profiles SET phone = NULL, updated_at = now()
 *   WHERE id IN (
 *     SELECT id FROM (
 *       SELECT id, phone,
 *              ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at) AS rn
 *       FROM profiles
 *       WHERE phone IS NOT NULL AND phone <> '' AND deleted_at IS NULL
 *     ) t WHERE t.rn > 1
 *   );
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement(<<<'SQL'
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '' AND deleted_at IS NULL
SQL
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS profiles_phone_unique');
    }
};
