<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Branding chosen during self-onboarding (live app preview on /register).
 *
 * Same keys as gyms.branding_config (primary_color, secondary_color) plus
 * `customized` (false = the applicant kept the CLBY defaults). Copied into
 * gyms.branding_config on approval. Null on requests submitted before this
 * existed, which approve exactly as before (platform default branding).
 *
 * Nullable add-column only: safe on a populated table.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('gym_requests', function (Blueprint $table) {
            $table->jsonb('branding_config')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('gym_requests', function (Blueprint $table) {
            $table->dropColumn('branding_config');
        });
    }
};
