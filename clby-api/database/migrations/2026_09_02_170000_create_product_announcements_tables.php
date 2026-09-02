<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "What's New" product announcements — platform → gym-admin dashboards.
 *
 * Named `product_announcements` rather than `announcements` because a
 * legacy Supabase-era `announcements` table (gym-scoped, per-gym notices)
 * still exists in the schema. That feature was removed from
 * ContentController and the table is empty, but it is not ours to drop,
 * and these rows are a different concept anyway: platform product
 * updates, not per-gym notices.
 *
 * Platform-level content like `client_logos`: written only by the
 * super-admin API, so there is no `gym_id` on the announcement itself and
 * no per-tenant RLS write policy. Targeting lives in the join table
 * `announcement_gyms`, which is what every tenant-facing query filters on.
 *
 * `audience` is denormalised onto the announcement rather than inferred
 * from "has no rows in announcement_gyms" so that an 'all' announcement
 * and a 'selected' announcement whose gym list was cleared stay
 * distinguishable — the second must show to nobody, not to everybody.
 *
 * Reads are tracked per *user*, not per gym: a gym with five staff
 * accounts should not have the popup silently consumed by whoever logged
 * in first. `gym_id` is denormalised onto the read row anyway so the
 * isolation check and any future per-tenant reporting can run without a
 * join back to profiles.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_announcements', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->text('title');
            // Sanitised HTML from the rich-text editor. Sanitisation happens
            // server-side on write (see AnnouncementController::sanitizeHtml)
            // so anything already stored is safe to render.
            $table->text('content');

            // 'image' | 'video' (uploaded file) | 'video_url' (embed/remote).
            $table->text('media_type')->nullable();
            $table->text('media_url')->nullable();
            // Storage path, kept so deleting a row can delete the object too.
            // Null for 'video_url', which we never own.
            $table->text('media_path')->nullable();

            $table->text('cta_label')->nullable();
            $table->text('cta_url')->nullable();

            $table->text('status')->default('draft');       // draft | published
            $table->text('audience')->default('all');       // all | selected

            $table->timestampTz('published_at')->nullable();
            $table->timestampTz('expires_at')->nullable();

            $table->uuid('created_by')->nullable();
            $table->timestampsTz();

            $table->foreign('created_by')->references('id')->on('profiles')->nullOnDelete();

            // The tenant feed query: published rows, newest first.
            $table->index(['status', 'published_at'], 'product_announcements_feed_idx');
        });

        DB::statement("ALTER TABLE public.product_announcements ADD CONSTRAINT product_announcements_status_chk CHECK (status IN ('draft','published'))");
        DB::statement("ALTER TABLE public.product_announcements ADD CONSTRAINT product_announcements_audience_chk CHECK (audience IN ('all','selected'))");
        DB::statement("ALTER TABLE public.product_announcements ADD CONSTRAINT product_announcements_media_type_chk CHECK (media_type IS NULL OR media_type IN ('image','video','video_url'))");

        Schema::create('product_announcement_gyms', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('announcement_id');
            $table->uuid('gym_id');
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('announcement_id')->references('id')->on('product_announcements')->cascadeOnDelete();
            $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();

            // One row per (announcement, gym) — re-saving a target list must
            // not be able to double-insert.
            $table->unique(['announcement_id', 'gym_id'], 'product_announcement_gyms_unique');
            // "which announcements target me" — the tenant isolation lookup.
            $table->index('gym_id', 'product_announcement_gyms_gym_idx');
        });

        Schema::create('product_announcement_reads', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('announcement_id');
            $table->uuid('user_id');
            $table->uuid('gym_id')->nullable();

            // Opened from the What's New panel.
            $table->timestampTz('read_at')->nullable();
            // Closed the popup — suppresses the automatic popup only.
            $table->timestampTz('dismissed_at')->nullable();
            $table->timestampsTz();

            $table->foreign('announcement_id')->references('id')->on('product_announcements')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('profiles')->cascadeOnDelete();
            $table->foreign('gym_id')->references('id')->on('gyms')->nullOnDelete();

            // Upsert target: one interaction row per user per announcement.
            $table->unique(['announcement_id', 'user_id'], 'product_announcement_reads_unique');
            // Unread-count and feed joins are always "my rows".
            $table->index('user_id', 'product_announcement_reads_user_idx');
        });

        // Reads are open (the API filters by the authenticated user);
        // writes go through the API's owner connection only, matching the
        // client_logos precedent.
        foreach (['product_announcements', 'product_announcement_gyms', 'product_announcement_reads'] as $t) {
            DB::statement("ALTER TABLE public.{$t} ENABLE ROW LEVEL SECURITY");
            DB::statement("CREATE POLICY {$t}_select ON public.{$t} FOR SELECT USING (true)");
            DB::statement("CREATE POLICY {$t}_insert ON public.{$t} FOR INSERT WITH CHECK (false)");
            DB::statement("CREATE POLICY {$t}_update ON public.{$t} FOR UPDATE USING (false)");
            DB::statement("CREATE POLICY {$t}_delete ON public.{$t} FOR DELETE USING (false)");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_announcement_reads');
        Schema::dropIfExists('product_announcement_gyms');
        Schema::dropIfExists('product_announcements');
    }
};
