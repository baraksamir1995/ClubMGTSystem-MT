<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Recurring expenses — Payments → Financial Overview.
 *
 * A `recurring_expenses` row is a schedule (a definition). It never counts
 * in any total itself; the generator (`expenses:generate-recurring`) turns
 * each due date into an ordinary row in the existing `expenses` table,
 * linked back through `expenses.recurring_expense_id`. So the overview
 * math keeps reading one table, and an occurrence is the same entity as a
 * one-off expense.
 *
 * Every step is guarded (hasTable / hasColumn / IF NOT EXISTS) because
 * prod runs migrate-on-boot and aborts the container on any failure — a
 * partially-applied run must be safe to re-run. The one unique index,
 * (recurring_expense_id, scheduled_date), only covers new columns that
 * start out NULL on every existing row, and Postgres treats NULLs as
 * distinct, so it cannot collide with existing data.
 *
 * See docs/recurring-expenses.md for the full design.
 */
return new class extends Migration {
    public function up(): void
    {
        $pg = DB::getDriverName() === 'pgsql';

        if (! Schema::hasTable('recurring_expenses')) {
            Schema::create('recurring_expenses', function (Blueprint $table) use ($pg) {
                $pg
                    ? $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'))
                    : $table->uuid('id')->primary();
                $table->uuid('gym_id');
                $table->text('title');
                $table->decimal('amount', 12, 2);
                // Gym currency at creation; copied onto every occurrence.
                $table->string('currency', 3);
                $table->text('category');
                $table->text('payment_method')->nullable();
                $table->text('vendor')->nullable();
                $table->text('description')->nullable();

                // weekly | monthly | quarterly | yearly
                $table->string('frequency', 16);
                // "Repeat every N <frequency>". Quarterly N = every 3N months.
                $table->unsignedSmallInteger('interval')->default(1);
                $table->date('start_date');
                // NULL = ongoing.
                $table->date('end_date')->nullable();
                // weekly: ISO weekday 1 (Mon) – 7 (Sun);
                // monthly / quarterly / yearly: day of month 1–31, clamped
                // to the month's last day in short months.
                $table->unsignedSmallInteger('recurrence_day');
                // yearly only: 1–12.
                $table->unsignedSmallInteger('recurrence_month')->nullable();

                // active | paused | ended
                $table->string('status', 16)->default('active');
                // Generator cursor: every scheduled date <= this has been
                // processed (recorded, or deliberately passed over while
                // paused). Never moves backwards.
                $table->date('generated_through')->nullable();
                // "Edit this and future": the schedule this one replaced.
                $table->uuid('previous_id')->nullable();

                // Audit (profiles.id; NULL actor = the system generator).
                $table->uuid('created_by')->nullable();
                $table->uuid('updated_by')->nullable();
                $table->timestampTz('paused_at')->nullable();
                $table->uuid('paused_by')->nullable();
                $table->timestampTz('resumed_at')->nullable();
                $table->uuid('resumed_by')->nullable();
                $table->timestampTz('ended_at')->nullable();
                $table->uuid('ended_by')->nullable();
                $table->timestampsTz();

                $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();
                $table->index(['gym_id', 'status'], 'idx_recurring_expenses_gym_status');
            });

            if ($pg) {
                DB::statement('ALTER TABLE recurring_expenses ADD CONSTRAINT recurring_expenses_amount_positive CHECK (amount > 0)');
                DB::statement('ALTER TABLE recurring_expenses ADD CONSTRAINT recurring_expenses_interval_positive CHECK ("interval" >= 1)');
                // Same posture as `expenses`: tenant-scoped reads, writes
                // through the API which enforces gym_id itself.
                DB::statement('ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY');
                DB::statement("CREATE POLICY recurring_expenses_select ON recurring_expenses FOR SELECT USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
                DB::statement('CREATE POLICY recurring_expenses_insert ON recurring_expenses FOR INSERT WITH CHECK (true)');
                DB::statement("CREATE POLICY recurring_expenses_update ON recurring_expenses FOR UPDATE USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
                DB::statement("CREATE POLICY recurring_expenses_delete ON recurring_expenses FOR DELETE USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
            }
        }

        // Lifecycle audit trail: one row per create / edit / split /
        // pause / resume / end / occurrence edit / skip / cancel.
        if (! Schema::hasTable('recurring_expense_events')) {
            Schema::create('recurring_expense_events', function (Blueprint $table) use ($pg) {
                $pg
                    ? $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'))
                    : $table->uuid('id')->primary();
                $table->uuid('gym_id');
                $table->uuid('recurring_expense_id');
                // The occurrence acted on, for occurrence-level events.
                $table->uuid('expense_id')->nullable();
                $table->string('action', 32);
                // NULL = system (generator auto-end).
                $table->uuid('actor_id')->nullable();
                $table->text('actor_name')->nullable();
                $table->json('details')->nullable();
                $table->timestampTz('created_at')->nullable();

                $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();
                $table->index(['recurring_expense_id', 'created_at'], 'idx_recurring_expense_events_schedule');
            });

            if ($pg) {
                DB::statement('ALTER TABLE recurring_expense_events ENABLE ROW LEVEL SECURITY');
                DB::statement("CREATE POLICY recurring_expense_events_select ON recurring_expense_events FOR SELECT USING ((gym_id = my_gym_id()) OR (my_role() = 'superadmin'))");
                DB::statement('CREATE POLICY recurring_expense_events_insert ON recurring_expense_events FOR INSERT WITH CHECK (true)');
            }
        }

        // Occurrence columns on the existing expenses table. All nullable
        // or defaulted, so every existing (one-off) row stays valid and
        // keeps counting exactly as before (status defaults to recorded).
        Schema::table('expenses', function (Blueprint $table) {
            if (! Schema::hasColumn('expenses', 'recurring_expense_id')) {
                $table->uuid('recurring_expense_id')->nullable();
            }
            if (! Schema::hasColumn('expenses', 'scheduled_date')) {
                // The schedule's date for this occurrence. Fixed even if
                // the occurrence's own expense_date is later edited.
                $table->date('scheduled_date')->nullable();
            }
            if (! Schema::hasColumn('expenses', 'status')) {
                // recorded  — an actual expense (every one-off row);
                // scheduled — a future occurrence edited ahead of time
                //             (becomes recorded when its date arrives);
                // skipped   — a future occurrence the admin skipped;
                // cancelled — a recorded occurrence the admin voided.
                // Only `recorded` ever counts in totals.
                $table->string('status', 16)->default('recorded');
            }
            if (! Schema::hasColumn('expenses', 'currency')) {
                // NULL on legacy rows = the gym's currency.
                $table->string('currency', 3)->nullable();
            }
            if (! Schema::hasColumn('expenses', 'recorded_at')) {
                // When an occurrence became an actual expense.
                $table->timestampTz('recorded_at')->nullable();
            }
            if (! Schema::hasColumn('expenses', 'updated_by')) {
                $table->uuid('updated_by')->nullable();
            }
        });

        // Backfill-free NOT NULL: the column was added with a default, but
        // make the constraint explicit (no-op if already NOT NULL).
        if ($pg) {
            DB::statement("UPDATE expenses SET status = 'recorded' WHERE status IS NULL");
            DB::statement('ALTER TABLE expenses ALTER COLUMN status SET NOT NULL');

            DB::statement(<<<'SQL'
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'expenses_recurring_expense_id_foreign'
                    ) THEN
                        -- Never cascade: removing a schedule must not erase
                        -- recorded financial history.
                        ALTER TABLE expenses
                            ADD CONSTRAINT expenses_recurring_expense_id_foreign
                            FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            SQL);
        }

        // One occurrence per (schedule, date) — the duplicate guard the
        // generator relies on (INSERT … ON CONFLICT DO NOTHING).
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_recurring_scheduled ON expenses (recurring_expense_id, scheduled_date)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_expenses_gym_recurring ON expenses (gym_id, recurring_expense_id)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS uq_expenses_recurring_scheduled');
        DB::statement('DROP INDEX IF EXISTS idx_expenses_gym_recurring');
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_recurring_expense_id_foreign');
        }
        Schema::table('expenses', function (Blueprint $table) {
            foreach (['recurring_expense_id', 'scheduled_date', 'status', 'currency', 'recorded_at', 'updated_by'] as $col) {
                if (Schema::hasColumn('expenses', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
        Schema::dropIfExists('recurring_expense_events');
        Schema::dropIfExists('recurring_expenses');
    }
};
