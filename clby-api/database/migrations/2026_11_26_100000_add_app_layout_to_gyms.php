<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-gym mobile app layout: order + visibility of the Home and Explore
 * screen sections, edited from gym-admin Settings → "App Layout".
 *
 * Shape (see App\Support\AppLayout):
 *   { "home":    [{"key":"banners","visible":true}, ...],
 *     "explore": [{"key":"memberships","visible":true}, ...] }
 *
 * NULL = the app's built-in default order, so existing gyms are unchanged.
 */
return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasColumn('gyms', 'app_layout')) {
            return;
        }
        Schema::table('gyms', function (Blueprint $table) {
            $table->jsonb('app_layout')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('gyms', function (Blueprint $table) {
            $table->dropColumn('app_layout');
        });
    }
};
