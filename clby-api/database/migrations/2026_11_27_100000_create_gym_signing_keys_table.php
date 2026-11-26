<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Offline attendance Phase 2 (PHASE2-CONTRACT "Keys"): per-gym Ed25519
 * signing keys for member passes.
 *
 * secret_key_enc is the libsodium secret key encrypted with Laravel Crypt
 * (APP_KEY); it never leaves the server. One ACTIVE key per (gym, purpose),
 * enforced by a partial unique index (new table, so it can't fail on data).
 * Retired keys stay to verify passes issued before rotation until
 * retired_at + member_pass_ttl_days. Additive + idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('gym_signing_keys')) {
            Schema::create('gym_signing_keys', function (Blueprint $table) {
                $table->string('kid', 32)->primary();
                $table->uuid('gym_id');
                $table->string('purpose', 32)->default('member_pass');
                $table->string('public_key', 64);       // base64url, 32-byte Ed25519 public key
                $table->text('secret_key_enc');          // Crypt::encryptString(base64url secret key)
                $table->string('status', 16)->default('active'); // active | retired
                $table->timestampTz('created_at')->nullable();
                $table->timestampTz('retired_at')->nullable();

                $table->index(['gym_id', 'purpose', 'status'], 'idx_gym_signing_keys_gym');
            });
        }

        // sqlite also supports partial indexes.
        DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS uq_gym_signing_keys_one_active ON gym_signing_keys (gym_id, purpose) WHERE status = 'active'");
    }

    public function down(): void
    {
        Schema::dropIfExists('gym_signing_keys');
    }
};
