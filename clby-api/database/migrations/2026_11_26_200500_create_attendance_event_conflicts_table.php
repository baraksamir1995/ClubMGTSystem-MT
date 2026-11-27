<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance — CONTRACT §6.3 / SPEC §7: audit trail of sync
 * attempts that reuse an existing event_id (`event_id_conflict`: another
 * actor/gym; `event_id_reused`: same actor, different payload). The
 * original attendance_events row is never modified; each attempt is a row
 * here, attributed to the ATTEMPTING actor/gym/device. Additive + idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('attendance_event_conflicts')) {
            return;
        }

        Schema::create('attendance_event_conflicts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('event_id');                       // the contested id
            $table->string('reason_code', 32);              // event_id_conflict | event_id_reused
            $table->uuid('gym_id');                         // attempting actor's gym
            $table->uuid('actor_user_id');
            $table->string('actor_type', 16);
            $table->uuid('device_id')->nullable();
            $table->string('app', 16)->nullable();
            $table->string('app_version', 32)->nullable();
            $table->char('payload_hash', 64);               // hash of the attempted payload
            $table->timestampTz('server_received_at', 3);
            $table->string('ip_address', 64)->nullable();
            $table->timestampTz('created_at')->nullable();

            $table->index(['gym_id', 'server_received_at'], 'idx_attendance_event_conflicts_gym');
            $table->index('event_id', 'idx_attendance_event_conflicts_event');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_event_conflicts');
    }
};
