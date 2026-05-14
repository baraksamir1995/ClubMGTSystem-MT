<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * NotificationController::store has been writing a `target_audience` column
 * (one of all | active_members | expired_members) for the FCM fan-out
 * filter, but the column was never added via any migration — the original
 * gym_notifications table only has the older recipient_type / recipient_filter
 * pair. Production was 500ing on every "send notification" attempt with
 * `column "target_audience" does not exist`.
 *
 * Add the column with a sane default so existing pre-existing rows backfill
 * to 'all' (which matches the controller's default when the field is omitted).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('gym_notifications', function (Blueprint $table) {
            // 'all' default mirrors the controller's behaviour when callers
            // omit the field. Length cap is generous; the validator
            // restricts the actual values.
            $table->string('target_audience', 32)->default('all')->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('gym_notifications', function (Blueprint $table) {
            $table->dropColumn('target_audience');
        });
    }
};
