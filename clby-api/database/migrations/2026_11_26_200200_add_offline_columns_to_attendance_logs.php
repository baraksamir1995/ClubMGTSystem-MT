<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance (Phase 1): link official attendance rows to the
 * offline event that produced them.
 *
 *  - source_event_id: attendance_events.event_id. UNIQUE (partial on pg) —
 *    the DB-level guarantee that one event yields at most one official row,
 *    even under concurrent resends. New column, NULL on every existing row,
 *    so the unique index cannot fail on prod data.
 *  - recorded_by: profiles.id of the actor who recorded the event (sync only).
 *  - review_flag: D2 — set when a visit was accepted although its bucket ran
 *    out between the visit and the sync (e.g. 'sessions_exhausted'); no
 *    counter was touched for such rows. Staff review them.
 *
 * attendance_logs is a legacy Supabase table with no Laravel create
 * migration — every step is guarded. Online write paths never set these
 * columns, so their behaviour is unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('attendance_logs')) {
            return;
        }

        Schema::table('attendance_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('attendance_logs', 'source_event_id')) {
                $table->uuid('source_event_id')->nullable();
            }
            if (! Schema::hasColumn('attendance_logs', 'recorded_by')) {
                $table->uuid('recorded_by')->nullable();
            }
            if (! Schema::hasColumn('attendance_logs', 'review_flag')) {
                $table->string('review_flag', 32)->nullable();
            }
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_logs_source_event_id ON attendance_logs (source_event_id) WHERE source_event_id IS NOT NULL');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_attendance_logs_review_flag ON attendance_logs (gym_id) WHERE review_flag IS NOT NULL');
        } else {
            // sqlite (tests): a plain unique index already allows many NULLs.
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_logs_source_event_id ON attendance_logs (source_event_id)');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('attendance_logs')) {
            return;
        }
        DB::statement('DROP INDEX IF EXISTS uq_attendance_logs_source_event_id');
        DB::statement('DROP INDEX IF EXISTS idx_attendance_logs_review_flag');
        Schema::table('attendance_logs', function (Blueprint $table) {
            foreach (['source_event_id', 'recorded_by', 'review_flag'] as $col) {
                if (Schema::hasColumn('attendance_logs', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
