<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance Phase 3 Amendment 2 §C: ONE fixed signed coach
 * (specialist) QR per trainer, stored like branch_qr_posters: the same text
 * on every call; reissued only when the signing kid is no longer the gym's
 * active key or the QR is within 30 days of exp. New table → safe. Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('trainer_qr_posters')) {
            return;
        }
        Schema::create('trainer_qr_posters', function (Blueprint $table) {
            $table->uuid('trainer_id')->primary();     // trainer_profiles.id
            $table->uuid('gym_id');
            $table->text('qr');
            $table->string('kid', 32);
            $table->bigInteger('iat');
            $table->bigInteger('exp');
            $table->timestampsTz();
            $table->index('gym_id', 'idx_trainer_qr_posters_gym');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trainer_qr_posters');
    }
};
