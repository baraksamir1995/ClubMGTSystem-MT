<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lets specialists (coach app users) log in with a short numeric username
 * the admin doesn't have to invent — `profiles.username` is auto-assigned
 * on create (see SpecialistController::store) and the login endpoint
 * matches against either `email` or `username`.
 *
 * Nullable: existing rows (members, admins, staff) keep using email-only
 * login. The unique constraint is a partial index over LOWER(username)
 * so we can be case-insensitive AND skip the millions of NULL rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->text('username')->nullable();
        });
        // Case-insensitive uniqueness, only enforced for rows that
        // actually have a username set.
        DB::statement(
            'CREATE UNIQUE INDEX profiles_username_lower_unique '
            .'ON profiles (LOWER(username)) '
            .'WHERE username IS NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS profiles_username_lower_unique');
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn('username');
        });
    }
};
