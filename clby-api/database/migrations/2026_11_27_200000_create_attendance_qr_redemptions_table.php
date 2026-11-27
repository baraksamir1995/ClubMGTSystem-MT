<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance Phase 3 (PHASE3-CONTRACT §2): replay protection for
 * ROTATING branch QR v2 tokens. Each (jti, gym_member_id) may produce at
 * most one accepted member_qr event; the UNIQUE index is the DB-level
 * guarantee (the sync also holds the per-member advisory lock on pg), and
 * the row points at the original attendance row so a replay can return it.
 * New table → the unique index cannot fail on existing data. Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('attendance_qr_redemptions')) {
            return;
        }
        $hasLogs = Schema::hasTable('attendance_logs');

        Schema::create('attendance_qr_redemptions', function (Blueprint $table) use ($hasLogs) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id');
            $table->string('jti', 32);
            $table->uuid('gym_member_id');
            $table->uuid('event_id');                    // attendance_events.event_id that redeemed it
            $table->uuid('attendance_log_id')->nullable();
            $table->uuid('branch_id')->nullable();
            $table->timestampTz('qr_exp')->nullable();
            $table->timestampTz('created_at')->nullable();

            $table->unique(['jti', 'gym_member_id'], 'uq_attendance_qr_redemptions_jti_member');
            $table->index(['gym_id', 'created_at'], 'idx_attendance_qr_redemptions_gym');
            if ($hasLogs) {
                $table->foreign('attendance_log_id')->references('id')->on('attendance_logs')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_qr_redemptions');
    }
};
