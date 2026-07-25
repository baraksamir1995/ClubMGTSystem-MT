<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sales & Leads pipeline (gym-level CRM).
 *
 * `sales_` prefix keeps these tables distinct from `landing_leads`, which
 * belongs to the SaaS marketing site. All tables are gym-scoped; FKs to
 * legacy Supabase tables (gyms, branches, profiles, membership_plans,
 * gym_members) are intentionally plain indexed uuid columns — those tables
 * predate Laravel migrations, and the app layer owns referential checks.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_lead_sources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id')->index();
            $table->string('name');
            $table->string('default_score', 10)->default('warm');
            $table->boolean('is_active')->default(true);
            $table->integer('sort')->default(0);
            $table->timestampsTz();
            $table->unique(['gym_id', 'name']);
        });

        Schema::create('sales_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id')->unique();
            $table->integer('unassigned_sla_minutes')->default(60);
            $table->integer('qualify_sla_hours')->default(24);
            $table->integer('first_contact_minutes')->default(15);
            $table->integer('max_contact_attempts')->default(5);
            $table->json('cadence_days')->nullable();       // default [1,3,7] applied in model
            $table->json('reminder_hours')->nullable();     // default [24,2] applied in model
            $table->string('intake_token', 64)->nullable()->unique();
            $table->timestampsTz();
        });

        Schema::create('sales_leads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id');
            $table->uuid('branch_id')->nullable()->index();
            $table->uuid('source_id')->nullable()->index();
            $table->string('name');
            $table->string('phone', 32);                    // E.164 (+ country code, generous headroom)
            $table->string('email')->nullable();
            $table->string('interest')->nullable();
            $table->text('notes')->nullable();

            // Qualification checklist
            $table->string('interest_level', 20)->nullable();
            $table->string('location_fit', 20)->nullable();
            $table->string('fitness_goal', 30)->nullable();
            $table->string('budget_range', 50)->nullable();
            $table->string('join_timeframe', 30)->nullable();

            $table->string('stage', 20)->default('new');
            $table->string('score', 10)->nullable();
            $table->uuid('assigned_to')->nullable()->index(); // profiles.id
            $table->timestampTz('claimed_at')->nullable();

            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();

            $table->integer('contact_attempts')->default(0);
            $table->timestampTz('first_contacted_at')->nullable();
            $table->timestampTz('qualified_at')->nullable();
            $table->timestampTz('converted_at')->nullable();
            $table->timestampTz('lost_at')->nullable();
            $table->string('lost_reason', 40)->nullable();
            $table->text('lost_notes')->nullable();
            $table->date('reengage_at')->nullable();

            // Conversion payload
            $table->uuid('converted_member_id')->nullable();  // gym_members.id
            $table->uuid('accepted_offer_id')->nullable();
            $table->string('agreement_ref')->nullable();
            $table->string('payment_method', 30)->nullable();
            $table->decimal('final_price', 10, 2)->nullable();
            $table->date('membership_start_date')->nullable();

            $table->uuid('created_by')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['gym_id', 'stage']);
            $table->index(['gym_id', 'phone']);
            $table->index(['gym_id', 'email']);
            // List filters/sorts on these under gym scoping.
            $table->index(['gym_id', 'score']);
            $table->index(['gym_id', 'assigned_to']);
            $table->index(['gym_id', 'created_at']);
        });

        Schema::create('sales_lead_stage_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('lead_id')->index();
            $table->string('from_stage', 20)->nullable();
            $table->string('to_stage', 20);
            $table->uuid('changed_by')->nullable();
            $table->text('reason')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('sales_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id')->index();
            $table->uuid('lead_id')->index();
            $table->uuid('user_id')->nullable();
            $table->string('type', 20);       // call|whatsapp|sms|email|note
            $table->string('outcome', 30)->nullable();
            $table->text('notes')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('sales_appointments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id')->index();
            $table->uuid('lead_id')->index();
            $table->uuid('branch_id')->nullable()->index();
            $table->uuid('host_id')->nullable();
            $table->string('type', 20);       // tour|trial|guest_pass|class_taster
            $table->timestampTz('scheduled_at')->index();
            $table->string('status', 15)->default('scheduled'); // scheduled|showed|no_show|cancelled
            // Offsets (in hours-before) already reminded, e.g. [24, 2]. Keyed
            // by offset so per-gym reminder_hours config of any length works.
            $table->json('reminders_sent')->nullable();
            $table->timestampTz('marked_at')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampsTz();
        });

        Schema::create('sales_offers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id')->index();
            $table->uuid('lead_id')->index();
            $table->uuid('plan_id')->nullable();              // membership_plans.id
            $table->string('discount_type', 30)->nullable();  // percent|fixed|waived_joining_fee|custom
            $table->decimal('discount_value', 10, 2)->nullable();
            $table->decimal('quoted_price', 10, 2);
            $table->date('valid_until')->nullable();
            $table->text('incentive_notes')->nullable();
            $table->string('status', 15)->default('open');    // open|accepted|declined
            $table->uuid('created_by')->nullable();
            $table->timestampsTz();
        });

        Schema::create('sales_objections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id')->index();
            $table->uuid('lead_id')->index();
            $table->uuid('offer_id')->nullable();
            $table->string('reason', 40);
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('sales_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id')->index();
            $table->uuid('lead_id')->nullable()->index();
            $table->uuid('assigned_to')->nullable()->index(); // profiles.id
            $table->string('type', 20);       // follow_up|rebook|onboarding|other
            $table->string('title');
            $table->timestampTz('due_at')->index();
            $table->string('status', 15)->default('open');    // open|done|cancelled
            $table->timestampTz('completed_at')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestampsTz();
        });

        // Outbound message log for the notification abstraction (drivers stubbed).
        Schema::create('sales_outbound_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id')->index();
            $table->uuid('lead_id')->nullable()->index();
            $table->string('channel', 20);    // whatsapp|sms
            $table->string('to', 25);
            $table->text('body');
            $table->string('status', 15)->default('queued'); // queued|sent|failed|stubbed
            $table->timestampTz('created_at')->useCurrent();
        });

        // Sales-role designation on existing staff. `sales_role` null means the
        // module permission alone decides (staff with `sales` module = rep).
        if (! Schema::hasColumn('staff_members', 'sales_role')) {
            Schema::table('staff_members', function (Blueprint $table) {
                $table->string('sales_role', 10)->nullable();   // rep|manager
                $table->uuid('branch_id')->nullable();          // rep's home branch
                $table->json('manager_branch_ids')->nullable(); // manager's branches
            });
        }

        // Trigram indexes for the leads-list ILIKE '%q%' search (name/phone/
        // email) — a leading wildcard can't use a btree, so without these the
        // search seq-scans the gym's leads. Mirrors the existing admin-search
        // trgm pattern. pgsql-only; the sqlite test connection skips it.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_sales_leads_name_trgm  ON sales_leads USING gin (name  gin_trgm_ops)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_sales_leads_phone_trgm ON sales_leads USING gin (phone gin_trgm_ops)');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_sales_leads_email_trgm ON sales_leads USING gin (email gin_trgm_ops)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_outbound_messages');
        Schema::dropIfExists('sales_tasks');
        Schema::dropIfExists('sales_objections');
        Schema::dropIfExists('sales_offers');
        Schema::dropIfExists('sales_appointments');
        Schema::dropIfExists('sales_activities');
        Schema::dropIfExists('sales_lead_stage_history');
        Schema::dropIfExists('sales_leads');
        Schema::dropIfExists('sales_settings');
        Schema::dropIfExists('sales_lead_sources');
        if (Schema::hasColumn('staff_members', 'sales_role')) {
            Schema::table('staff_members', function (Blueprint $table) {
                $table->dropColumn(['sales_role', 'branch_id', 'manager_branch_ids']);
            });
        }
    }
};
