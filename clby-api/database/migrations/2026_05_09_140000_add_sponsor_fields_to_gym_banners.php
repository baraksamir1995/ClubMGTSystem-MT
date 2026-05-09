<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Three nullable text columns to support a 'sponsor' action_type on
        // gym_banners. action_type stays plain text — no enum constraint to
        // alter — so existing rows are unaffected and the new value rides
        // alongside 'none' / 'external_link' / 'internal'.
        //
        // Detail-screen headline + body reuse the existing caption +
        // description columns; only the promo code, the external URL, and
        // the fine-print terms are new.
        DB::statement('ALTER TABLE gym_banners
            ADD COLUMN IF NOT EXISTS sponsor_promo_code   text,
            ADD COLUMN IF NOT EXISTS sponsor_external_url text,
            ADD COLUMN IF NOT EXISTS sponsor_terms        text;');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE gym_banners
            DROP COLUMN IF EXISTS sponsor_promo_code,
            DROP COLUMN IF EXISTS sponsor_external_url,
            DROP COLUMN IF EXISTS sponsor_terms;');
    }
};
