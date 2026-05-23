<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One row per coach-delivered service session.
 *
 * Created so the coach mobile app can: (a) decrement a member's
 * `sessions_used` with a 30-minute double-decrement guard, (b) render
 * "today's attendance" for the logged-in coach, (c) render per-member
 * session history with editable notes.
 *
 * Distinct from `attendance_logs` (which is gym-entry attendance) and
 * `session_bookings` (group class bookings).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_session_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id');
            // The package assignment whose `sessions_used` was incremented
            // by this log. Cascade so cleanup of a torn-down assignment
            // doesn't leave orphan log rows.
            $table->uuid('assignment_id');
            // Owning coach (trainer_profiles.id) and member (gym_members.id).
            $table->uuid('trainer_id');
            $table->uuid('gym_member_id');
            $table->timestampTz('delivered_at');
            $table->text('note')->nullable();
            $table->timestampsTz();

            $table->foreign('gym_id')->references('id')->on('gyms');
            $table->foreign('assignment_id')->references('id')->on('member_service_assignments')->cascadeOnDelete();
            $table->foreign('trainer_id')->references('id')->on('trainer_profiles');
            $table->foreign('gym_member_id')->references('id')->on('gym_members');

            // "Today's log" for a coach + per-member history use these two.
            $table->index(['trainer_id', 'delivered_at'], 'idx_ssl_trainer_delivered');
            $table->index(['assignment_id', 'delivered_at'], 'idx_ssl_assignment_delivered');
            // Gym-scoped audit lookups.
            $table->index(['gym_id', 'delivered_at'], 'idx_ssl_gym_delivered');
        });

        // RLS belt-and-braces. Mirrors the policies on the existing
        // member_service_assignments table — only gym-scoped reads/writes,
        // and a member-self-read for /api/me-style mobile flows.
        DB::statement('ALTER TABLE service_session_logs ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY service_session_logs_select ON service_session_logs FOR SELECT USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
        DB::statement("CREATE POLICY service_session_logs_insert ON service_session_logs FOR INSERT WITH CHECK (true)");
        DB::statement("CREATE POLICY service_session_logs_update ON service_session_logs FOR UPDATE USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('service_session_logs');
    }
};
