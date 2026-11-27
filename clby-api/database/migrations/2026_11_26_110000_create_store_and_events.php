<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Store (physical products with stock) + Events, ported from the Ippon
 * academy fork and adapted to CLBY:
 *
 *  - Members register THEMSELVES for events (no guardian layer), so
 *    event_registrations records `registered_by` (the acting profile) next
 *    to the gym_member it is for.
 *  - Ippon targeted events at groups (classes with assigned members). CLBY
 *    members are not assigned to classes, so events target MEMBERSHIP PLANS
 *    instead: only members holding an active membership on one of the
 *    plans see/register. No targets = visible to every member.
 *  - payments.event_registration_id links a Paymob / desk payment to the
 *    registration it settles. Product purchases keep their fulfilment
 *    record (product/variant/quantity/stock flags) in payments.metadata.
 *
 * Every table is gym-scoped (gym_id) and every query in the controllers
 * filters on the caller's gym.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('products')) {
            Schema::create('products', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('gym_id')->index();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('image_url', 2048)->nullable();
                $table->decimal('before_price', 10, 2)->nullable();
                $table->decimal('price', 10, 2);
                $table->string('currency', 5)->default('EGP');
                $table->integer('stock')->nullable(); // null = not tracked
                $table->boolean('is_active')->default(true);
                $table->integer('display_order')->default(0);
                $table->timestamps();
                $table->softDeletes();
                $table->index(['gym_id', 'is_active', 'display_order']);
            });
        }

        if (! Schema::hasTable('product_variants')) {
            Schema::create('product_variants', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('product_id')->index();
                $table->uuid('gym_id')->index();
                $table->string('name');
                $table->string('image_url', 2048)->nullable();
                $table->decimal('before_price', 10, 2)->nullable();
                $table->decimal('price', 10, 2);
                $table->integer('stock')->nullable();
                $table->boolean('is_active')->default(true);
                $table->integer('display_order')->default(0);
                $table->timestamps();
                $table->softDeletes();
                $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
                $table->index(['product_id', 'is_active']);
            });
        }

        if (! Schema::hasTable('events')) {
            Schema::create('events', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('gym_id');
                $table->string('title');
                $table->text('description')->nullable();
                $table->string('location')->nullable();
                $table->string('image_url', 1024)->nullable();
                $table->timestampTz('starts_at');
                $table->timestampTz('ends_at')->nullable();
                $table->timestampTz('registration_deadline')->nullable();
                $table->integer('capacity')->nullable(); // null = unlimited
                $table->boolean('is_paid')->default(false);
                $table->integer('price_cents')->nullable();
                $table->string('currency', 5)->default('EGP');
                $table->boolean('is_published')->default(false);
                // Label for the pick-one option list ("Weight class", "Level").
                $table->string('configuration_label', 100)->nullable();
                $table->uuid('created_by')->nullable();
                $table->timestampsTz();
                $table->index(['gym_id', 'is_published', 'starts_at']);
            });
        }

        if (! Schema::hasTable('event_configurations')) {
            Schema::create('event_configurations', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('event_id');
                $table->string('name');
                $table->integer('sort_order')->default(0);
                $table->timestampsTz();
                $table->foreign('event_id')->references('id')->on('events')->cascadeOnDelete();
                $table->index(['event_id', 'sort_order']);
            });
        }

        if (! Schema::hasTable('event_plan_targets')) {
            Schema::create('event_plan_targets', function (Blueprint $table) {
                $table->uuid('event_id');
                $table->uuid('plan_id');
                $table->primary(['event_id', 'plan_id']);
                $table->foreign('event_id')->references('id')->on('events')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('event_registrations')) {
            Schema::create('event_registrations', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('gym_id');
                $table->uuid('event_id');
                $table->uuid('gym_member_id');
                $table->uuid('registered_by')->nullable(); // profile that registered (member or staff)
                // confirmed | pending_payment | cancelled
                $table->string('status', 16)->default('confirmed');
                // na | unpaid | paid | refunded
                $table->string('payment_status', 12)->default('na');
                $table->boolean('attended')->default(false);
                $table->uuid('event_configuration_id')->nullable();
                $table->string('configuration_name')->nullable();
                $table->timestampsTz();
                $table->foreign('event_id')->references('id')->on('events')->cascadeOnDelete();
                $table->foreign('event_configuration_id')->references('id')->on('event_configurations')->nullOnDelete();
                $table->unique(['event_id', 'gym_member_id']);
                $table->index(['gym_id', 'gym_member_id']);
            });
        }

        if (Schema::hasTable('payments') && ! Schema::hasColumn('payments', 'event_registration_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->uuid('event_registration_id')->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('payments', 'event_registration_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropColumn('event_registration_id');
            });
        }
        Schema::dropIfExists('event_registrations');
        Schema::dropIfExists('event_plan_targets');
        Schema::dropIfExists('event_configurations');
        Schema::dropIfExists('events');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
    }
};
