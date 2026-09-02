<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Services\HtmlSanitizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Tenant-facing "What's New" feed for gym-admin dashboard users.
 *
 * Every query here goes through Announcement::forGym($gymId), which is
 * the tenant isolation boundary — including the read/dismiss writes,
 * which re-check targeting before inserting so a gym can neither mark
 * nor probe an announcement aimed at someone else.
 *
 * Read state is per authenticated user rather than per gym, so one
 * staff member opening the popup doesn't consume it for their colleagues.
 */
class AnnouncementController extends Controller
{
    public function __construct(private HtmlSanitizer $sanitizer)
    {
    }

    /**
     * The What's New panel: every announcement this gym can see,
     * newest first, including expired ones (kept as history) but never
     * drafts or unpublished ones.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $announcements = Announcement::query()
            ->visible()
            ->forGym($user->gym_id)
            ->orderByDesc('published_at')
            ->limit(50)
            ->get();

        $reads = $this->readsFor($announcements->pluck('id')->all(), $user->id);

        return response()->json([
            'data' => $announcements->map(fn (Announcement $a) => $this->present($a, $reads[$a->id] ?? null)),
        ]);
    }

    /**
     * Badge count: announcements this user has never opened.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();

        $count = Announcement::query()
            ->visible()
            ->forGym($user->gym_id)
            ->whereNotExists(function ($sub) use ($user) {
                $sub->selectRaw('1')
                    ->from('product_announcement_reads')
                    ->whereColumn('product_announcement_reads.announcement_id', 'product_announcements.id')
                    ->where('product_announcement_reads.user_id', $user->id)
                    ->whereNotNull('product_announcement_reads.read_at');
            })
            ->count();

        return response()->json(['data' => ['unread' => $count]]);
    }

    /**
     * The auto-popup: the newest live announcement this user has never
     * interacted with, or null.
     *
     * Unlike the panel this excludes expired announcements — an expired
     * update stays readable in history but must not ambush anyone.
     */
    public function popup(Request $request): JsonResponse
    {
        $user = $request->user();

        $announcement = Announcement::query()
            ->visible()
            ->forGym($user->gym_id)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->whereNotExists(function ($sub) use ($user) {
                $sub->selectRaw('1')
                    ->from('product_announcement_reads')
                    ->whereColumn('product_announcement_reads.announcement_id', 'product_announcements.id')
                    ->where('product_announcement_reads.user_id', $user->id);
            })
            ->orderByDesc('published_at')
            ->first();

        return response()->json([
            'data' => $announcement ? $this->present($announcement, null) : null,
        ]);
    }

    /**
     * Full detail for one announcement, opened from the panel.
     * Marks it read as a side effect — opening it *is* reading it.
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        $announcement = Announcement::query()
            ->visible()
            ->forGym($user->gym_id)
            ->find($id);

        // 404 rather than 403 for an untargeted announcement: a gym should
        // not be able to tell "exists but not yours" from "doesn't exist".
        if (!$announcement) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $read = $this->touch($announcement->id, $user, markRead: true, markDismissed: false);

        return response()->json(['data' => $this->present($announcement, $read)]);
    }

    /**
     * Mark read without opening the full view (panel row click-through).
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        return $this->interact($request, $id, markRead: true, markDismissed: false);
    }

    /**
     * Popup dismissed via the X. Also counts as read — the user saw it.
     */
    public function dismiss(Request $request, string $id): JsonResponse
    {
        return $this->interact($request, $id, markRead: true, markDismissed: true);
    }

    // ─── Internals ─────────────────────────────────────────────────────────

    private function interact(Request $request, string $id, bool $markRead, bool $markDismissed): JsonResponse
    {
        $user = $request->user();

        // Re-check targeting on the write path — this is what stops a
        // hand-crafted id from creating a read row against another gym's
        // announcement.
        $exists = Announcement::query()
            ->visible()
            ->forGym($user->gym_id)
            ->whereKey($id)
            ->exists();

        if (!$exists) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $this->touch($id, $user, $markRead, $markDismissed);

        return response()->json(['message' => 'ok']);
    }

    /**
     * Upsert this user's interaction row.
     *
     * Timestamps are only ever set, never cleared: re-opening an
     * announcement must not reset a previous dismissal.
     */
    private function touch(string $announcementId, $user, bool $markRead, bool $markDismissed): ?object
    {
        $now = now();

        DB::table('product_announcement_reads')->upsert(
            [[
                'id' => (string) Str::uuid(),
                'announcement_id' => $announcementId,
                'user_id' => $user->id,
                'gym_id' => $user->gym_id,
                'read_at' => $markRead ? $now : null,
                'dismissed_at' => $markDismissed ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]],
            ['announcement_id', 'user_id'],
            [
                'read_at' => DB::raw($markRead ? 'COALESCE(product_announcement_reads.read_at, excluded.read_at)' : 'product_announcement_reads.read_at'),
                'dismissed_at' => DB::raw($markDismissed ? 'COALESCE(product_announcement_reads.dismissed_at, excluded.dismissed_at)' : 'product_announcement_reads.dismissed_at'),
                'updated_at' => DB::raw('excluded.updated_at'),
            ],
        );

        return DB::table('product_announcement_reads')
            ->where('announcement_id', $announcementId)
            ->where('user_id', $user->id)
            ->first();
    }

    /**
     * @return array<string, object> keyed by announcement_id
     */
    private function readsFor(array $announcementIds, string $userId): array
    {
        if (!$announcementIds) {
            return [];
        }

        return DB::table('product_announcement_reads')
            ->whereIn('announcement_id', $announcementIds)
            ->where('user_id', $userId)
            ->get()
            ->keyBy('announcement_id')
            ->all();
    }

    /**
     * Shape one announcement for the dashboard.
     *
     * `content` is the sanitised HTML stored at write time, safe to
     * render; `excerpt` is plain text for the list rows.
     */
    private function present(Announcement $a, ?object $read): array
    {
        return [
            'id' => $a->id,
            'title' => $a->title,
            'content' => $a->content,
            'excerpt' => $this->sanitizer->excerpt($a->content),
            'media_type' => $a->media_type,
            'media_url' => $a->media_url,
            'cta_label' => $a->cta_label,
            'cta_url' => $a->cta_url,
            'published_at' => $a->published_at,
            'expires_at' => $a->expires_at,
            'is_expired' => $a->expires_at !== null && $a->expires_at <= now(),
            'is_read' => $read?->read_at !== null,
            'read_at' => $read?->read_at,
            'dismissed_at' => $read?->dismissed_at,
        ];
    }
}
