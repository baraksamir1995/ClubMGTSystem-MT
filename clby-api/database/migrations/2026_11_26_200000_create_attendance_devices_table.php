<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance (Phase 1): devices that sync offline-recorded events.
 *
 * `id` is generated on the device and persisted there. On first sync the
 * row is bound to (user_id, gym_id); any other user presenting the same id
 * is refused (403), and a revoked device is refused until re-registered.
 * Additive + idempotent (migrate-on-boot safe).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('attendance_devices')) {
            return;
        }

        Schema::create('attendance_devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id');
            $table->uuid('user_id');
            $table->string('app', 16)->nullable();          // admin | coach | member
            $table->string('platform', 16)->nullable();     // ios | android | web
            $table->string('app_version', 32)->nullable();
            $table->string('label', 120)->nullable();
            $table->timestampTz('first_seen_at')->nullable();
            $table->timestampTz('last_seen_at')->nullable();
            $table->timestampTz('last_sync_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampsTz();

            $table->index(['gym_id', 'user_id'], 'idx_attendance_devices_gym_user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_devices');
    }
};
