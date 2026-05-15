<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-gym toggle for the member session-transfer feature. When false, the
 * mobile app hides the "Share sessions" entry point in the profile screen.
 *
 * Default TRUE so every existing gym keeps the current behaviour (transfer
 * banner always shown) until an admin explicitly turns it off — no silent
 * feature removal on deploy.
 *
 * Mirrors the existing mobile_payments_enabled / capacity_feature_enabled
 * boolean-flag pattern on gyms.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('gyms', function (Blueprint $table) {
            $table->boolean('session_transfer_enabled')
                ->default(true)
                ->after('mobile_payments_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('gyms', function (Blueprint $table) {
            $table->dropColumn('session_transfer_enabled');
        });
    }
};
