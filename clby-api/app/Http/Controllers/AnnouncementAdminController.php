<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Services\HtmlSanitizer;
use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Super-admin CRUD for "What's New" announcements.
 *
 * Sits behind the RequireSuperAdmin middleware group — there is no
 * gym scoping here at all; targeting is data, not a query filter.
 * The tenant-facing half lives in AnnouncementController.
 */
class AnnouncementAdminController extends Controller
{
    public function __construct(private HtmlSanitizer $sanitizer)
    {
    }

    /**
     * Every announcement, newest first, with its target list and a
     * read count so the list can show reach at a glance.
     */
    public function index(): JsonResponse
    {
        $announcements = Announcement::query()
            ->with(['targets:id,announcement_id,gym_id', 'author:id,full_name,email'])
            ->withCount('reads')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Announcement $a) => $this->present($a));

        return response()->json(['data' => $announcements]);
    }

    public function show(string $id): JsonResponse
    {
        $announcement = Announcement::with(['targets:id,announcement_id,gym_id', 'author:id,full_name,email'])
            ->withCount('reads')
            ->find($id);

        if (!$announcement) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json(['data' => $this->present($announcement)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePayload($request);

        $announcement = DB::transaction(function () use ($validated, $request) {
            $announcement = Announcement::create([
                'title' => $validated['title'],
                'content' => $this->sanitizer->sanitize($validated['content'] ?? ''),
                'media_type' => $validated['media_type'] ?? null,
                'media_url' => $validated['media_url'] ?? null,
                'media_path' => $validated['media_path'] ?? null,
                'cta_label' => $validated['cta_label'] ?? null,
                'cta_url' => $validated['cta_url'] ?? null,
                'status' => $validated['status'] ?? 'draft',
                'audience' => $validated['audience'] ?? 'all',
                'published_at' => $this->resolvePublishedAt($validated, null),
                'expires_at' => $validated['expires_at'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            $this->syncTargets($announcement, $validated);

            return $announcement;
        });

        return response()->json(['data' => $this->present($announcement->fresh(['targets', 'author']))], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $validated = $this->validatePayload($request, partial: true);

        // A PATCH carrying no recognised field would otherwise issue a
        // timestamp-only write and report 200, making a no-op look like a
        // real change. Reject it so a typo'd payload is visible.
        if ($validated === []) {
            return response()->json(['error' => 'No changes supplied'], 422);
        }

        $previousMediaPath = $announcement->media_path;

        DB::transaction(function () use ($announcement, $validated) {
            $changes = [];

            foreach (['title', 'media_type', 'media_url', 'media_path', 'cta_label', 'cta_url', 'status', 'audience', 'expires_at'] as $field) {
                if (array_key_exists($field, $validated)) {
                    $changes[$field] = $validated[$field];
                }
            }

            if (array_key_exists('content', $validated)) {
                $changes['content'] = $this->sanitizer->sanitize($validated['content']);
            }

            // published_at follows the status transition unless the caller
            // set it explicitly — publishing without a date would leave the
            // row invisible to the `visible` scope.
            $resolved = $this->resolvePublishedAt($validated, $announcement);
            if ($resolved !== $announcement->published_at) {
                $changes['published_at'] = $resolved;
            }

            if ($changes) {
                $announcement->update($changes);
            }

            $this->syncTargets($announcement, $validated);
        });

        // Replacing the media leaves the old object orphaned in storage, so
        // drop it once the row pointing at it is gone. Only when the path
        // actually changed — a text-only edit must keep the file.
        if (array_key_exists('media_path', $validated)
            && $previousMediaPath
            && $validated['media_path'] !== $previousMediaPath) {
            try { app(StorageService::class)->delete($previousMediaPath); } catch (\Throwable) {}
        }

        return response()->json(['data' => $this->present($announcement->fresh(['targets', 'author'])->loadCount('reads'))]);
    }

    /**
     * Publish now. Keeps an existing future publish date if one was set,
     * so "publish" on a scheduled announcement doesn't yank it forward.
     */
    public function publish(string $id): JsonResponse
    {
        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['error' => 'Not found'], 404);
        }

        // A 'selected' announcement with no gyms would publish to nobody —
        // almost certainly a mistake, so refuse rather than silently no-op.
        if ($announcement->audience === 'selected' && $announcement->targets()->count() === 0) {
            return response()->json(['error' => 'Select at least one gym before publishing'], 422);
        }

        $announcement->update([
            'status' => 'published',
            'published_at' => $announcement->published_at ?? now(),
        ]);

        return response()->json(['data' => $this->present($announcement->fresh(['targets', 'author'])->loadCount('reads'))]);
    }

    /**
     * Back to draft. Takes effect immediately for tenants because every
     * tenant query filters on status.
     */
    public function unpublish(string $id): JsonResponse
    {
        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $announcement->update(['status' => 'draft']);

        return response()->json(['data' => $this->present($announcement->fresh(['targets', 'author'])->loadCount('reads'))]);
    }

    public function destroy(string $id, StorageService $storage): JsonResponse
    {
        $announcement = Announcement::find($id);
        if (!$announcement) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $mediaPath = $announcement->media_path;

        // Targets and reads cascade at the DB level.
        $announcement->delete();

        // Best-effort: a stale object costs storage, a failed delete here
        // must not fail the request the admin actually asked for.
        if ($mediaPath) {
            try { $storage->delete($mediaPath); } catch (\Throwable) {}
        }

        return response()->json(['message' => 'Announcement deleted']);
    }

    /**
     * Upload announcement media. Returns { path, url, media_type }.
     *
     * Images and video share one endpoint because the caller doesn't know
     * which it has until the file picker returns; the mime decides.
     */
    public function upload(Request $request, StorageService $storage): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'mimetypes:image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime',
                // php-fpm caps the request body at 12M in the API image, so
                // anything larger is rejected by nginx before it reaches
                // here anyway — keep the validator just under that.
                'max:10240',
            ],
        ]);

        $file = $request->file('file');
        $isVideo = str_starts_with((string) $file->getMimeType(), 'video/');

        // No gym scoping — these are platform-level assets.
        $result = $storage->upload($file, 'announcements');

        return response()->json(['data' => [
            'path' => $result['path'],
            'url' => $result['url'],
            'media_type' => $isVideo ? 'video' : 'image',
        ]]);
    }

    // ─── Internals ─────────────────────────────────────────────────────────

    private function validatePayload(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'title' => "{$req}|string|max:255",
            'content' => "{$req}|string|max:50000",
            'media_type' => ['nullable', Rule::in(['image', 'video', 'video_url'])],
            'media_url' => 'nullable|string|max:2048',
            'media_path' => 'nullable|string|max:2048',
            'cta_label' => 'nullable|string|max:60',
            'cta_url' => 'nullable|string|max:2048',
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'audience' => ['sometimes', Rule::in(['all', 'selected'])],
            'gym_ids' => 'sometimes|array',
            'gym_ids.*' => 'uuid|exists:gyms,id',
            'published_at' => 'sometimes|nullable|date',
            'expires_at' => 'sometimes|nullable|date',
        ]);
    }

    /**
     * Decide the publish timestamp for a create/update.
     *
     * Explicit wins. Otherwise publishing stamps now, and a row that was
     * never published keeps its null.
     */
    private function resolvePublishedAt(array $validated, ?Announcement $existing)
    {
        if (array_key_exists('published_at', $validated)) {
            return $validated['published_at'];
        }

        $status = $validated['status'] ?? $existing?->status ?? 'draft';

        if ($status === 'published') {
            return $existing?->published_at ?? now();
        }

        return $existing?->published_at;
    }

    /**
     * Replace the target list.
     *
     * Switching to 'all' clears the rows so a later switch back to
     * 'selected' starts from an explicit, deliberate list rather than a
     * stale one the admin can't see.
     */
    private function syncTargets(Announcement $announcement, array $validated): void
    {
        $audience = $validated['audience'] ?? $announcement->audience;

        if ($audience === 'all') {
            $announcement->targets()->delete();
            return;
        }

        if (!array_key_exists('gym_ids', $validated)) {
            return;
        }

        $announcement->targets()->delete();

        $rows = collect($validated['gym_ids'])->unique()->map(fn ($gymId) => [
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'announcement_id' => $announcement->id,
            'gym_id' => $gymId,
            'created_at' => now(),
        ])->all();

        if ($rows) {
            DB::table('product_announcement_gyms')->insert($rows);
        }
    }

    /**
     * Shape one announcement for the super-admin UI.
     */
    private function present(Announcement $a): array
    {
        $now = now();
        $isPublished = $a->status === 'published'
            && $a->published_at !== null
            && $a->published_at <= $now;
        $isExpired = $a->expires_at !== null && $a->expires_at <= $now;

        return [
            'id' => $a->id,
            'title' => $a->title,
            'content' => $a->content,
            'excerpt' => $this->sanitizer->excerpt($a->content),
            'media_type' => $a->media_type,
            'media_url' => $a->media_url,
            'media_path' => $a->media_path,
            'cta_label' => $a->cta_label,
            'cta_url' => $a->cta_url,
            'status' => $a->status,
            'audience' => $a->audience,
            'gym_ids' => $a->relationLoaded('targets')
                ? $a->targets->pluck('gym_id')->all()
                : [],
            'published_at' => $a->published_at,
            'expires_at' => $a->expires_at,
            'is_live' => $isPublished && !$isExpired,
            'is_scheduled' => $a->status === 'published' && $a->published_at !== null && $a->published_at > $now,
            'is_expired' => $isExpired,
            'reads_count' => $a->reads_count ?? 0,
            'created_by' => $a->created_by,
            'author_name' => $a->relationLoaded('author') ? $a->author?->full_name : null,
            'created_at' => $a->created_at,
            'updated_at' => $a->updated_at,
        ];
    }
}
