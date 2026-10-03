<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pending-payment reminders + tenant "I have paid" settlement claims for
 * the platform's SaaS invoices (`gym_saas_invoices`, legacy Supabase table
 * with no Laravel migration of its own).
 *
 * SaaS invoices are settled outside the system, so a gym can only *claim*
 * it has paid. The claim never marks the invoice paid on its own: it moves
 * the invoice to `awaiting_confirmation` and a super-admin confirms
 * (→ paid) or rejects (→ back to the status it had before the claim).
 *
 *   gym_saas_invoices.reminder_dismissed_until
 *       Per-invoice snooze for the gym dashboard banner. An invoice belongs
 *       to exactly one gym, so "per reminder, per tenant" is a column here
 *       rather than a join table. Dismissing never touches `status`.
 *
 *   saas_invoice_settlement_requests
 *       One row per claim, kept as history (approved / rejected). The
 *       partial unique index allows at most one *pending* claim per invoice
 *       — the database-level guard against a double-click or two admins
 *       claiming at once. `previous_status` is what a rejection restores,
 *       so an `overdue` invoice doesn't come back as plain `pending`.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('gym_saas_invoices', function (Blueprint $table) {
            $table->timestampTz('reminder_dismissed_until')->nullable();
        });

        Schema::create('saas_invoice_settlement_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('invoice_id');
            // Denormalised from the invoice so tenant isolation checks never
            // need the join.
            $table->uuid('gym_id');
            $table->uuid('requested_by')->nullable();
            $table->text('status')->default('pending');      // pending | approved | rejected
            $table->text('previous_status')->default('pending');
            $table->uuid('reviewed_by')->nullable();
            $table->timestampTz('reviewed_at')->nullable();
            $table->timestampsTz();

            $table->foreign('invoice_id')->references('id')->on('gym_saas_invoices')->cascadeOnDelete();
            $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();
            $table->foreign('requested_by')->references('id')->on('profiles')->nullOnDelete();
            $table->foreign('reviewed_by')->references('id')->on('profiles')->nullOnDelete();

            $table->index('gym_id', 'saas_settlement_requests_gym_idx');
            $table->index('status', 'saas_settlement_requests_status_idx');
        });

        DB::statement("CREATE UNIQUE INDEX saas_settlement_requests_one_pending ON saas_invoice_settlement_requests (invoice_id) WHERE status = 'pending'");

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE public.saas_invoice_settlement_requests ADD CONSTRAINT saas_settlement_requests_status_chk CHECK (status IN ('pending','approved','rejected'))");

            // Written and read only through the API's owner connection,
            // matching gym_saas_invoices (super-admin-only select policy).
            DB::statement('ALTER TABLE public.saas_invoice_settlement_requests ENABLE ROW LEVEL SECURITY');
            DB::statement("CREATE POLICY saas_invoice_settlement_requests_select ON public.saas_invoice_settlement_requests FOR SELECT USING (my_role() = 'superadmin')");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('saas_invoice_settlement_requests');
        Schema::table('gym_saas_invoices', function (Blueprint $table) {
            $table->dropColumn('reminder_dismissed_until');
        });
    }
};
