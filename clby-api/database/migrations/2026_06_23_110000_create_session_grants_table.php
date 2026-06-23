<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_grants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id');
            $table->uuid('gym_member_id');
            $table->uuid('membership_id');
            $table->integer('count');
            $table->uuid('granted_by')->nullable(); // admin profile id
            $table->text('note')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();
            $table->foreign('gym_member_id')->references('id')->on('gym_members')->cascadeOnDelete();
            $table->foreign('membership_id')->references('id')->on('member_memberships')->cascadeOnDelete();

            $table->index('gym_member_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_grants');
    }
};
