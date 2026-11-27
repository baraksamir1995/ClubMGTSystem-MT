<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PHASE2-CONTRACT amendment §4: signing keys can be REVOKED (status
 * 'revoked' — never accepted, no grace). revoked_at records when.
 * Additive + idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('gym_signing_keys') && ! Schema::hasColumn('gym_signing_keys', 'revoked_at')) {
            Schema::table('gym_signing_keys', function (Blueprint $table) {
                $table->timestampTz('revoked_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('gym_signing_keys') && Schema::hasColumn('gym_signing_keys', 'revoked_at')) {
            Schema::table('gym_signing_keys', function (Blueprint $table) {
                $table->dropColumn('revoked_at');
            });
        }
    }
};
