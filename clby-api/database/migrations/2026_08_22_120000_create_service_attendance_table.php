<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-recorded attendance for session-based services (PT, nutrition,
 * physio, and anything else configured as a session package).
 *
 * Why a separate table instead of a `status` column on
 * `service_session_logs`: a `service_session_logs` row *means* "one
 * session was delivered" — that's the invariant the Services → Service
 * Logs tab, its CSV export, and the coach app all rely on. Absent and
 * cancelled attendance must be recorded WITHOUT consuming a session, so
 * storing them as log rows would change what every existing reader of
 * that table sees.
 *
 * Instead: this table is the source event for every attendance action,
 * and only an 'attended' row produces a `service_session_logs` row
 * (pointed at by `service_log_id`). That keeps the existing Service Logs
 * format and semantics byte-identical while giving attendance its own
 * status vocabulary.
 *
 * Service-agnostic by construction: the service is whatever the linked
 * assignment/package says it is (`member_service_assignments.service_type`
 * / `service_session_packages.trainer_type`). No service names appear here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_attendance', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id');
            $table->uuid('gym_member_id');
            // The specific package instance the attendance is recorded
            // against. A member may hold several assignments for the same
            // service, so the deduction always targets this one row.
            $table->uuid('assignment_id');
            // Specialist credited with the session. Admin-selected (it
            // defaults to the assignment's trainer in the UI) because the
            // acting admin is usually not the person delivering it.
            $table->uuid('trainer_id')->nullable();

            // attended → deducts 1 session + writes a service log.
            // absent / cancelled → recorded only, never deducts.
            $table->text('status');

            // When the session took place. Separate from created_at so an
            // admin can back-date a session they're recording after the fact.
            $table->timestampTz('attended_at');

            // Set only for status='attended'. The matching Service Logs row,
            // i.e. the proof that attendance and the log are one action.
            // Nulled out on reversal (the log row itself is deleted).
            $table->uuid('service_log_id')->nullable();

            // Who recorded it (profiles.id) — audit trail.
            $table->uuid('recorded_by')->nullable();
            $table->text('note')->nullable();

            // Reversal bookkeeping. The attendance row is kept (audit) and
            // flipped to 'cancelled' rather than deleted.
            $table->timestampTz('reversed_at')->nullable();
            $table->uuid('reversed_by')->nullable();

            $table->timestampsTz();

            $table->foreign('gym_id')->references('id')->on('gyms');
            $table->foreign('gym_member_id')->references('id')->on('gym_members');
            $table->foreign('assignment_id')->references('id')->on('member_service_assignments')->cascadeOnDelete();
            $table->foreign('trainer_id')->references('id')->on('trainer_profiles')->nullOnDelete();
            // If the log row is removed (reversal / assignment teardown) the
            // pointer goes null but the attendance history survives.
            $table->foreign('service_log_id')->references('id')->on('service_session_logs')->nullOnDelete();

            // Listing: gym-scoped, newest first.
            $table->index(['gym_id', 'attended_at'], 'idx_sa_gym_attended');
            // Per-member history + the "did this member already attend" check.
            $table->index(['gym_member_id', 'attended_at'], 'idx_sa_member_attended');
            // Per-package balance reconstruction.
            $table->index(['assignment_id', 'attended_at'], 'idx_sa_assignment_attended');
        });

        DB::statement("ALTER TABLE service_attendance ADD CONSTRAINT service_attendance_status_check CHECK (status IN ('attended','absent','cancelled'))");

        // Idempotency: at most one *live* attended row per (assignment,
        // attended_at). A duplicate submission of the same action therefore
        // fails on the unique index rather than double-deducting, even if
        // two requests race past the application-level guard.
        //
        // Scoped to attended + not-yet-reversed so that (a) absent/cancelled
        // rows are unconstrained, and (b) reversing then re-recording the
        // same slot is allowed.
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX idx_sa_one_live_attended_per_slot
            ON service_attendance (assignment_id, attended_at)
            WHERE status = 'attended' AND reversed_at IS NULL
        SQL);

        // Mirrors the RLS posture of service_session_logs / member_service_assignments.
        DB::statement('ALTER TABLE service_attendance ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY service_attendance_select ON service_attendance FOR SELECT USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
        DB::statement("CREATE POLICY service_attendance_insert ON service_attendance FOR INSERT WITH CHECK (true)");
        DB::statement("CREATE POLICY service_attendance_update ON service_attendance FOR UPDATE USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('service_attendance');
    }
};
