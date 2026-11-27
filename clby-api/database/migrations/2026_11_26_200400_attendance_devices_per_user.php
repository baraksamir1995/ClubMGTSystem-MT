<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance — CONTRACT §6.1: device binding is per
 * (device_id, user_id). A shared front-desk browser / handed-over phone is
 * used by several accounts; each pair is registered and revoked on its own.
 *
 * `attendance_devices.id` becomes a server surrogate key. The client's
 * device id moves to the new `device_id` column, backfilled from `id` for
 * existing rows (each existing id is unique, so the new unique index on
 * (device_id, user_id) cannot fail). Additive + idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('attendance_devices')) {
            return;
        }

        if (! Schema::hasColumn('attendance_devices', 'device_id')) {
            Schema::table('attendance_devices', function (Blueprint $table) {
                $table->uuid('device_id')->nullable();
            });
        }

        DB::table('attendance_devices')->whereNull('device_id')->update(['device_id' => DB::raw('id')]);

        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_devices_device_user ON attendance_devices (device_id, user_id)');
    }

    public function down(): void
    {
        if (! Schema::hasTable('attendance_devices')) {
            return;
        }
        DB::statement('DROP INDEX IF EXISTS uq_attendance_devices_device_user');
        if (Schema::hasColumn('attendance_devices', 'device_id')) {
            Schema::table('attendance_devices', function (Blueprint $table) {
                $table->dropColumn('device_id');
            });
        }
    }
};
