<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Optional package-level expiry, set when the admin assigns the package
 * (e.g. "12 sessions, valid 90 days"). Surfaced on the coach app's
 * Member card as `EXP {date}` and used in the design's "inactive when
 * remaining ≤ 0 OR expiry ≤ today" rule.
 *
 * Nullable — existing assignments without a configured validity still
 * work, the coach app just hides the EXP date.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('member_service_assignments', function (Blueprint $table) {
            $table->timestampTz('expires_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('member_service_assignments', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });
    }
};
