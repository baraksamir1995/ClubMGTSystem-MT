<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-token lifetime for password_reset_tokens.
 *
 * Forgot-password tokens live one hour. The account-setup link emailed to a
 * newly approved gym owner rides the same table and the same
 * POST /auth/reset-password endpoint, but an owner may not open it for days,
 * so it needs a longer window. Null keeps the legacy one-hour rule
 * (AuthController::resetPassword falls back to created_at + 1h).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });
    }
};
