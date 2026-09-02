<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Client logos shown in the landing-page carousel.
 *
 * Platform-level content, not gym-scoped: these are CLBY's own clients,
 * managed from the super-admin dashboard, so there is no `gym_id` and no
 * tenant RLS policy — the only writer is the super-admin API, and the
 * only reader is the public landing endpoint.
 *
 * `sort_order` is an explicit integer the super-admin reorders, rather
 * than relying on created_at, because the display order of a logo wall
 * is an editorial decision (anchor clients first) independent of when a
 * row was added. Ties fall back to created_at so a fresh row without an
 * assigned position still lands deterministically.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('client_logos', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->text('name');
            // Public URL of the uploaded image, as returned by StorageService.
            $table->text('logo_url');
            // Storage path, kept so deleting a row can delete the object too.
            $table->text('logo_path')->nullable();
            // Optional click-through to the client's site.
            $table->text('website_url')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            // The public carousel query: active rows in display order.
            $table->index(['is_active', 'sort_order'], 'client_logos_display_idx');
        });

        // Read-only to every non-owner role; all writes go through the
        // super-admin API, which connects as the owner role.
        DB::statement('ALTER TABLE public.client_logos ENABLE ROW LEVEL SECURITY');
        DB::statement('CREATE POLICY client_logos_select ON public.client_logos FOR SELECT USING (true)');
        DB::statement('CREATE POLICY client_logos_insert ON public.client_logos FOR INSERT WITH CHECK (false)');
        DB::statement('CREATE POLICY client_logos_update ON public.client_logos FOR UPDATE USING (false)');
        DB::statement('CREATE POLICY client_logos_delete ON public.client_logos FOR DELETE USING (false)');
    }

    public function down(): void
    {
        Schema::dropIfExists('client_logos');
    }
};
