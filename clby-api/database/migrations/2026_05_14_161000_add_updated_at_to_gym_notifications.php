<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Same class of bug as the target_audience migration: the original
 * gym_notifications table only has `created_at`. NotificationController
 * writes both timestamps. Backfill `updated_at` to match `created_at`
 * for existing rows so historical data is sensible.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('gym_notifications', function (Blueprint $table) {
            $table->timestampTz('updated_at')->nullable()->after('created_at');
        });

        // Backfill existing rows so updated_at matches created_at — keeps
        // any "last modified" UI from showing NULL on rows that predate
        // this column.
        \Illuminate\Support\Facades\DB::statement(
            'UPDATE gym_notifications SET updated_at = created_at WHERE updated_at IS NULL'
        );
    }

    public function down(): void
    {
        Schema::table('gym_notifications', function (Blueprint $table) {
            $table->dropColumn('updated_at');
        });
    }
};
