<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            // Stores the gym the user selected during self-registration.
            // Consumed (converted to gym_id + gym_members row) when the user
            // verifies their email. Cleared afterwards.
            $table->uuid('pending_gym_id')->nullable()->after('gym_id');
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn('pending_gym_id');
        });
    }
};
