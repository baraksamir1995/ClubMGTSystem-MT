<?php

namespace App\Http\Controllers;

use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Client logos for the landing-page carousel.
 *
 * `listPublic` is unauthenticated (the landing site has no session);
 * everything else sits behind the super-admin middleware group.
 */
class ClientLogoController extends Controller
{
    /**
     * Public: active logos in display order, for the landing carousel.
     */
    public function listPublic(): JsonResponse
    {
        $logos = DB::table('client_logos')
            ->select('id', 'name', 'logo_url', 'website_url')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $logos]);
    }

    /**
     * Super-admin: every logo, active or not.
     */
    public function index(): JsonResponse
    {
        $logos = DB::table('client_logos')
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $logos]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'logo_url' => 'required|string|max:2048',
            'logo_path' => 'nullable|string|max:2048',
            'website_url' => 'nullable|url|max:2048',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        // Default to the end of the list so a new logo never silently
        // displaces an existing one.
        $sortOrder = $validated['sort_order']
            ?? ((int) DB::table('client_logos')->max('sort_order') + 1);

        $id = Str::uuid()->toString();

        DB::table('client_logos')->insert([
            'id' => $id,
            'name' => $validated['name'],
            'logo_url' => $validated['logo_url'],
            'logo_path' => $validated['logo_path'] ?? null,
            'website_url' => $validated['website_url'] ?? null,
            'sort_order' => $sortOrder,
            'is_active' => $validated['is_active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('client_logos')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, string $id, StorageService $storage): JsonResponse
    {
        $logo = DB::table('client_logos')->where('id', $id)->first();
        if (!$logo) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'logo_url' => 'sometimes|string|max:2048',
            'logo_path' => 'nullable|string|max:2048',
            'website_url' => 'nullable|url|max:2048',
            'sort_order' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
        ]);

        // A PATCH carrying no recognised field would otherwise issue a
        // timestamp-only write and report 200, making a no-op look like a
        // real change. Reject it so a typo'd payload is visible.
        if ($validated === []) {
            return response()->json(['error' => 'No changes supplied'], 422);
        }

        $previousPath = $logo->logo_path;

        $validated['updated_at'] = now();
        DB::table('client_logos')->where('id', $id)->update($validated);

        // Replacing the image leaves the old object orphaned in storage, so
        // drop it once the row pointing at it is gone. Only when the path
        // actually changed — a metadata-only edit must keep the file.
        if (array_key_exists('logo_path', $validated)
            && $previousPath
            && $validated['logo_path'] !== $previousPath) {
            try { $storage->delete($previousPath); } catch (\Throwable) {}
        }

        return response()->json(['data' => DB::table('client_logos')->where('id', $id)->first()]);
    }

    /**
     * Super-admin: persist a whole drag-and-drop reorder in one call.
     *
     * Sent as a full ordered list of ids rather than per-row PATCHes so
     * the positions can never end up half-applied.
     */
    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|uuid',
        ]);

        $known = DB::table('client_logos')
            ->whereIn('id', $validated['ids'])
            ->pluck('id')
            ->all();

        if (count($known) !== count($validated['ids'])) {
            return response()->json(['error' => 'One or more logos no longer exist'], 422);
        }

        DB::transaction(function () use ($validated) {
            foreach ($validated['ids'] as $position => $logoId) {
                DB::table('client_logos')->where('id', $logoId)->update([
                    'sort_order' => $position,
                    'updated_at' => now(),
                ]);
            }
        });

        return response()->json(['data' => DB::table('client_logos')
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get()]);
    }

    public function destroy(string $id, StorageService $storage): JsonResponse
    {
        $logo = DB::table('client_logos')->where('id', $id)->first();
        if (!$logo) return response()->json(['error' => 'Not found'], 404);

        DB::table('client_logos')->where('id', $id)->delete();

        // Best-effort: a stale object costs storage, a failed delete here
        // must not fail the request the admin actually asked for.
        if ($logo->logo_path) {
            try { $storage->delete($logo->logo_path); } catch (\Throwable) {}
        }

        return response()->json(['message' => 'Logo deleted']);
    }

    /**
     * Super-admin: upload a logo image, returns { path, url }.
     */
    public function upload(Request $request, StorageService $storage): JsonResponse
    {
        $request->validate(['file' => 'required|image|max:5120']);

        // No gym scoping — these are platform-level assets.
        $result = $storage->upload($request->file('file'), 'client-logos');

        return response()->json(['data' => $result]);
    }
}
