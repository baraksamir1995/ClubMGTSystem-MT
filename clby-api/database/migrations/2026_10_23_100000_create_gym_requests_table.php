<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Self-onboarding requests submitted from clbyapp.com/register.
 *
 *   gym_requests
 *       One row per submission. Nothing in `gyms` / `profiles` exists until a
 *       super-admin approves, so a pending or declined request can never leak
 *       into the mobile gym list (GymController::listPublic reads `gyms`).
 *       Approval runs GymProvisioningService inside the same transaction that
 *       flips the status, so `approved` always implies a fully provisioned
 *       gym; `provisioned_gym_id` / `owner_profile_id` record what it made.
 *
 *       The partial unique index allows at most one *pending* request per
 *       owner email — the database-level guard against double submits.
 *       `submission_key` is a client-generated idempotency key so a retried
 *       POST returns the original request instead of erroring.
 *
 *       Email delivery is tracked separately from the decision
 *       (`*_email_sent_at`, `last_email_error`) so a Resend failure never
 *       un-approves a gym and a retried job never double-sends.
 *
 *   gym_request_events
 *       Append-only audit trail: submitted / approved / declined / reopened /
 *       provisioning_failed / email_sent / email_failed. `staff_activity_logs`
 *       is gym-scoped and these events mostly happen before a gym exists.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('gym_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('reference')->unique();
            $table->text('status')->default('pending');        // pending | approved | declined
            $table->uuid('submission_key')->nullable()->unique();

            // Gym
            $table->text('gym_name');
            $table->text('description')->nullable();
            $table->text('logo_url')->nullable();
            $table->text('address')->nullable();
            $table->text('city');
            $table->text('country');
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();
            $table->text('phone');
            $table->text('business_email');
            $table->text('category')->nullable();
            $table->json('services')->nullable();
            $table->integer('branches_count')->default(1);
            $table->text('timezone')->default('Africa/Cairo');

            // Owner
            $table->text('owner_name');
            $table->text('owner_email');
            $table->text('owner_phone');

            $table->text('submitted_ip')->nullable();
            $table->text('user_agent')->nullable();

            // Review
            $table->uuid('reviewed_by')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('decline_reason')->nullable();
            $table->boolean('share_decline_reason')->default(false);

            // Provisioning outcome
            $table->uuid('provisioned_gym_id')->nullable();
            $table->uuid('owner_profile_id')->nullable();
            $table->integer('provisioning_attempts')->default(0);
            $table->text('last_provisioning_error')->nullable();
            $table->timestampTz('last_provisioning_failed_at')->nullable();

            // Notification outcome
            $table->timestampTz('submitted_email_sent_at')->nullable();
            $table->timestampTz('decision_email_sent_at')->nullable();
            $table->text('last_email_error')->nullable();
            $table->timestampTz('last_email_failed_at')->nullable();

            $table->timestampsTz();

            $table->foreign('reviewed_by')->references('id')->on('profiles')->nullOnDelete();
            $table->foreign('provisioned_gym_id')->references('id')->on('gyms')->nullOnDelete();

            $table->index(['status', 'created_at'], 'gym_requests_status_created_idx');
        });

        DB::statement("CREATE UNIQUE INDEX gym_requests_one_pending_per_email ON gym_requests (lower(owner_email)) WHERE status = 'pending'");

        Schema::create('gym_request_events', function (Blueprint $table) {
            // Sequential id, not a uuid: events in the same second (submitted
            // + email_sent) must still read back in the order they happened.
            $table->id();
            $table->uuid('gym_request_id');
            $table->text('event');
            $table->uuid('actor_id')->nullable();
            $table->json('details')->nullable();
            $table->text('ip_address')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('gym_request_id')->references('id')->on('gym_requests')->cascadeOnDelete();
            $table->foreign('actor_id')->references('id')->on('profiles')->nullOnDelete();
            $table->index(['gym_request_id', 'id'], 'gym_request_events_request_idx');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE public.gym_requests ADD CONSTRAINT gym_requests_status_chk CHECK (status IN ('pending','approved','declined'))");

            // Written and read only through the API's owner connection.
            DB::statement('ALTER TABLE public.gym_requests ENABLE ROW LEVEL SECURITY');
            DB::statement("CREATE POLICY gym_requests_select ON public.gym_requests FOR SELECT USING (my_role() = 'superadmin')");
            DB::statement('ALTER TABLE public.gym_request_events ENABLE ROW LEVEL SECURITY');
            DB::statement("CREATE POLICY gym_request_events_select ON public.gym_request_events FOR SELECT USING (my_role() = 'superadmin')");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('gym_request_events');
        Schema::dropIfExists('gym_requests');
    }
};
