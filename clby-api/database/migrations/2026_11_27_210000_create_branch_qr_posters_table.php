<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance Phase 3 amendment: ONE fixed signed gym QR per branch.
 * GET /branches/{id}/qr returns the stored poster every time; it is
 * reissued (row overwritten) only when the branch token was regenerated,
 * the signing kid is no longer the gym's active key, or it is within 30
 * days of exp. Separate table (the legacy `branches` table stays untouched).
 * New table, PK on branch_id → nothing can fail on existing data. Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('branch_qr_posters')) {
            return;
        }
        Schema::create('branch_qr_posters', function (Blueprint $table) {
            $table->uuid('branch_id')->primary();
            $table->uuid('gym_id');
            $table->text('qr');                       // the exact v2 QR text handed out
            $table->string('kid', 32);
            $table->uuid('token');                    // branches.qr_token it was signed for
            $table->bigInteger('iat');
            $table->bigInteger('exp');
            $table->timestampsTz();
            $table->index('gym_id', 'idx_branch_qr_posters_gym');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_qr_posters');
    }
};
