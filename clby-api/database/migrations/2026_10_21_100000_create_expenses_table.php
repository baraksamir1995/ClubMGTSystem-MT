<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gym expenses — the cost side of Payments → Financial Overview.
 *
 * Deliberately separate from `payments`: an expense is money the gym paid
 * out, recorded by hand, and never touches a member or a payment row.
 * Revenue for the overview is still read straight from `payments`.
 *
 * `expense_date` is a plain DATE (not a timestamp) because it is the
 * business date the admin picks — "the March rent" — so there is no
 * timezone to resolve when bucketing it into a month.
 *
 * `category` / `payment_method` are free text constrained in the
 * controller rather than by a CHECK, so the category list can grow
 * without a migration.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('gym_id');
            $table->text('title');
            $table->decimal('amount', 12, 2);
            $table->date('expense_date');
            $table->text('category');
            $table->text('vendor')->nullable();
            $table->text('payment_method')->nullable();
            $table->text('description')->nullable();
            // Who recorded it (profiles.id) — audit trail.
            $table->uuid('created_by')->nullable();
            $table->timestampsTz();

            $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();

            // Every read is gym-scoped and date-ranged: the table, the
            // monthly totals and the export all filter on both.
            $table->index(['gym_id', 'expense_date'], 'idx_expenses_gym_date');
        });

        DB::statement('ALTER TABLE expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0)');

        // Same posture as service_attendance: tenant-scoped reads, writes go
        // through the API (which enforces gym_id itself).
        DB::statement('ALTER TABLE expenses ENABLE ROW LEVEL SECURITY');
        DB::statement("CREATE POLICY expenses_select ON expenses FOR SELECT USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
        DB::statement("CREATE POLICY expenses_insert ON expenses FOR INSERT WITH CHECK (true)");
        DB::statement("CREATE POLICY expenses_update ON expenses FOR UPDATE USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
        DB::statement("CREATE POLICY expenses_delete ON expenses FOR DELETE USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
