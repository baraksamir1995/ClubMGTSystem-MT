<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance (Phase 1): server-side record of every synced event,
 * accepted or not. `event_id` is the client idempotency key; a resend with
 * the same actor + payload_hash replays the stored result.
 *
 * All tenant/actor columns are SERVER-derived (never the client's claim).
 * The links to the official rows are ON DELETE SET NULL because
 * attendance_logs rows get hard-deleted (member/gym deletion, booking
 * revert, recurring stop) and service_session_logs cascade with their
 * assignment — the audit row must survive both.
 *
 * Additive + idempotent (migrate-on-boot safe). No legacy-table FKs other
 * than the two SET NULL links, which are only added when the target table
 * exists.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('attendance_events')) {
            return;
        }

        $hasLogs = Schema::hasTable('attendance_logs');
        $hasServiceLogs = Schema::hasTable('service_session_logs');

        Schema::create('attendance_events', function (Blueprint $table) use ($hasLogs, $hasServiceLogs) {
            $table->uuid('event_id')->primary();
            $table->string('kind', 24);                      // attendance | service_session
            $table->string('method', 16)->nullable();        // staff_qr | member_qr | manual (kind=attendance)
            $table->uuid('gym_id');
            $table->uuid('branch_id')->nullable();
            $table->uuid('gym_member_id')->nullable();
            $table->uuid('class_session_id')->nullable();
            $table->uuid('studio_id')->nullable();
            $table->uuid('service_assignment_id')->nullable();
            $table->uuid('actor_user_id');
            $table->string('actor_type', 16);                // gym_admin | staff | trainer | member | super_admin
            $table->uuid('device_id')->nullable();
            $table->string('app', 16)->nullable();
            $table->string('app_version', 32)->nullable();
            $table->timestampTz('device_recorded_at', 3)->nullable(); // null only for unparseable payloads
            $table->string('device_timezone', 64)->nullable();
            $table->timestampTz('server_received_at', 3);
            $table->timestampTz('processed_at', 3)->nullable();
            $table->string('result', 16);                    // accepted | duplicate | rejected | error
            $table->string('reason_code', 64);               // contract result code
            $table->text('reason_message')->nullable();
            $table->boolean('retryable')->default(false);
            $table->uuid('attendance_log_id')->nullable();
            $table->uuid('service_log_id')->nullable();
            $table->jsonb('flags')->nullable();              // D2 review flags, e.g. ["sessions_exhausted"]
            $table->boolean('needs_review')->default(false); // true when flags is non-empty
            $table->char('payload_hash', 64);
            $table->jsonb('qr_meta')->nullable();            // never the raw token
            $table->jsonb('metadata')->nullable();           // client metadata, stored, never trusted
            $table->unsignedInteger('attempts')->default(1);
            $table->timestampsTz();

            $table->index(['gym_id', 'server_received_at'], 'idx_attendance_events_gym_received');
            $table->index(['gym_id', 'result'], 'idx_attendance_events_gym_result');
            $table->index(['gym_id', 'needs_review'], 'idx_attendance_events_gym_review');
            $table->index(['gym_member_id', 'device_recorded_at'], 'idx_attendance_events_member_recorded');
            $table->index('device_id', 'idx_attendance_events_device');
            $table->index('attendance_log_id', 'idx_attendance_events_attendance_log');
            $table->index('service_log_id', 'idx_attendance_events_service_log');

            if ($hasLogs) {
                $table->foreign('attendance_log_id')->references('id')->on('attendance_logs')->nullOnDelete();
            }
            if ($hasServiceLogs) {
                $table->foreign('service_log_id')->references('id')->on('service_session_logs')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_events');
    }
};
