<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Gym-specific Contract Terms & Conditions.
 *
 * Modelled as an append-only *version history* rather than a single
 * column on `gyms`, because the terms are a contractual document: an
 * invoice issued under v1 must keep showing v1 even after the gym
 * publishes v2. A plain `gyms.contract_terms` column could not express
 * that — editing it would silently rewrite every historical invoice.
 *
 *   gym_contract_terms   one row per published version, per gym
 *   payments.contract_terms_id   the version in force when the payment
 *                                was recorded (NULL for pre-existing
 *                                rows and for gyms with no terms yet)
 *
 * The "current" terms for a gym = the highest `terms_version` row.
 * Version numbers are per-gym and allocated in the controller inside a
 * transaction; the unique index below is what actually guarantees no
 * two concurrent saves can claim the same number.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('gym_contract_terms', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('uuid_generate_v4()'));
            $table->uuid('gym_id');
            $table->text('contract_terms_conditions');
            $table->integer('terms_version');
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();
            // updated_by → profiles: nullable + nullOnDelete so removing a
            // staff account never destroys the contract history.
            $table->foreign('updated_by')->references('id')->on('profiles')->nullOnDelete();

            // Tenant isolation + the concurrency guard for version numbers.
            $table->unique(['gym_id', 'terms_version']);
            $table->index(['gym_id', 'terms_version'], 'gym_contract_terms_current_idx');
        });

        // Version pinning: which terms version an invoice was issued under.
        Schema::table('payments', function (Blueprint $table) {
            $table->uuid('contract_terms_id')->nullable();
            // restrictOnDelete: a terms version referenced by an invoice
            // must not be deletable — that's the whole point of pinning.
            $table->foreign('contract_terms_id')
                ->references('id')->on('gym_contract_terms')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['contract_terms_id']);
            $table->dropColumn('contract_terms_id');
        });
        Schema::dropIfExists('gym_contract_terms');
    }
};
