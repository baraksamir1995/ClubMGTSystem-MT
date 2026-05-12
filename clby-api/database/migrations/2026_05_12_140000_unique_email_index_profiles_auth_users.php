<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Plug the registration race-condition vulnerability disclosed 2026-05-12.
 *
 * Before this migration:
 *   - `profiles.email` had only a non-unique btree index. `auth.users.email`
 *     had no index at all.
 *   - AuthController::register relied on `Rule::unique('profiles','email')`,
 *     which is a SELECT-then-INSERT pattern. Two concurrent requests with the
 *     same email could both pass validation and both INSERT, leaving N rows
 *     per email and N tokens, breaking identity uniqueness platform-wide.
 *
 * After this migration:
 *   - A case-insensitive UNIQUE index on `LOWER(email)` exists on both
 *     `profiles` (partial, where deleted_at IS NULL — soft-deleted users
 *     don't block fresh signups) and `auth.users`. Concurrent registers now
 *     race at the DB level — one insert wins, the loser raises SQLSTATE
 *     23505, which AuthController::register catches and returns as a clean
 *     422.
 *
 * Note: prod was manually de-duplicated immediately before this migration
 * (4 attacker rows from the BugHunter PoC + 3 unrelated orphan auth.users
 * rows). The migration assumes no duplicates remain — it will fail on any
 * environment that still has them. Run the de-dupe SQL in conversation
 * history before deploying.
 */
return new class extends Migration {
    public function up(): void
    {
        // Partial unique: ignore soft-deleted rows so re-registration after
        // account deletion is possible. profiles uses soft-delete via
        // `deleted_at`; auth.users does not.
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique '
            . 'ON profiles (LOWER(email)) WHERE deleted_at IS NULL');

        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_lower_unique '
            . 'ON auth.users (LOWER(email))');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS profiles_email_lower_unique');
        DB::statement('DROP INDEX IF EXISTS auth.auth_users_email_lower_unique');
    }
};
