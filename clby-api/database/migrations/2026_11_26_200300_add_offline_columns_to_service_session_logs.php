<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance (Phase 1): link coach-delivered service sessions to
 * the offline event that produced them.
 *
 *  - source_event_id: UNIQUE (partial on pg); NULL on every existing row.
 *  - review_flag: D2 — 'pack_exhausted' when a session recorded offline was
 *    accepted although the pack ran out before it synced. Such a row did NOT
 *    increment member_service_assignments.sessions_used (counters never
 *    exceed sessions_total); staff review it.
 *
 * Guarded so it is a no-op where the table doesn't exist.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('service_session_logs')) {
            return;
        }

        Schema::table('service_session_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('service_session_logs', 'source_event_id')) {
                $table->uuid('source_event_id')->nullable();
            }
            if (! Schema::hasColumn('service_session_logs', 'review_flag')) {
                $table->string('review_flag', 32)->nullable();
            }
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS uq_service_session_logs_source_event_id ON service_session_logs (source_event_id) WHERE source_event_id IS NOT NULL');
        } else {
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS uq_service_session_logs_source_event_id ON service_session_logs (source_event_id)');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('service_session_logs')) {
            return;
        }
        DB::statement('DROP INDEX IF EXISTS uq_service_session_logs_source_event_id');
        Schema::table('service_session_logs', function (Blueprint $table) {
            foreach (['source_event_id', 'review_flag'] as $col) {
                if (Schema::hasColumn('service_session_logs', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
