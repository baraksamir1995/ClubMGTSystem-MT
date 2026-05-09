<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\StorageService;

/**
 * Generic CRUD for gym content tables:
 * announcements, banners, FAQs, onboarding slides, partners, photos, popups.
 */
use \App\Traits\LogsActivity;

class ContentController extends Controller
{
    use LogsActivity;

    public function __construct(
        private StorageService $storage,
    ) {}
    // Removed: announcements / faqs / onboarding / photos. Their admin tabs
    // were retired and the existing whitelists didn't match the real schemas
    // anyway. Tables stay (no destructive drop), just the controller no
    // longer routes to them — /api/content/<removed> returns 400.
    private const TABLES = [
        'banners' => 'gym_banners',
        'partners' => 'gym_partners',
        'popups' => 'gym_popups',
    ];

    /** Singular key names for response wrapping (matches frontend expectations) */
    private const SINGULAR = [
        'banners' => 'banner',
        'partners' => 'partner',
        'popups' => 'popup',
    ];

    /** Allowed columns per content type — must match the real DB schema. */
    private const ALLOWED_COLUMNS = [
        'banners' => [
            'image_url', 'storage_path', 'caption', 'description',
            'tag', 'tag_color', 'action_type', 'action_value',
            'sort_order', 'is_active', 'is_featured',
            // Sponsor variant: when banner.action_type = 'sponsor', tapping
            // opens an in-app detail screen with reveal-and-copy promo code.
            'sponsor_promo_code', 'sponsor_external_url', 'sponsor_terms',
        ],
        'partners' => ['name', 'image_url', 'storage_path', 'is_visible', 'display_order'],
        'popups' => [
            'title', 'subtitle', 'image_url', 'storage_path',
            'cta_label', 'cta_action_type', 'cta_action_value',
            'is_active', 'priority',
        ],
    ];

    /** Convert camelCase keys to snake_case */
    private function toSnakeCase(array $data): array
    {
        $result = [];
        foreach ($data as $key => $value) {
            $snakeKey = strtolower(preg_replace('/[A-Z]/', '_$0', $key));
            $result[$snakeKey] = $value;
        }
        return $result;
    }

    /** Filter data to only allowed columns for a content type */
    private function filterAllowed(array $data, string $type): array
    {
        $allowed = self::ALLOWED_COLUMNS[$type] ?? [];
        return array_intersect_key($data, array_flip($allowed));
    }

    public function index(Request $request, string $type): JsonResponse
    {
        $table = self::TABLES[$type] ?? null;
        if (! $table) return response()->json(['error' => 'Invalid content type'], 400);

        $gymId = $request->user()->gym_id;

        $query = DB::table($table)
            ->where('gym_id', $gymId)
            ->orderBy('created_at', 'desc');

        // Honour ?limit=N for slim mobile callers; admin/dashboard paginate.
        if ($limit = $request->query('limit')) {
            $items = $query->limit(min(100, max(1, (int) $limit)))->get();
            return response()->json(['data' => $items]);
        }

        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));
        $paginator = $query->paginate($perPage);

        return response()->json([
            'data' => $paginator->items(),
            'pagination' => [
                'page'  => $paginator->currentPage(),
                'pages' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'limit' => $paginator->perPage(),
            ],
        ]);
    }

    public function store(Request $request, string $type): JsonResponse
    {
        $table = self::TABLES[$type] ?? null;
        if (! $table) return response()->json(['error' => 'Invalid content type'], 400);

        $gymId = $request->user()->gym_id;
        $data = $this->filterAllowed($this->toSnakeCase($request->all()), $type);
        $data['id'] = Str::uuid()->toString();
        $data['gym_id'] = $gymId;
        $data['created_at'] = now();

        // Handle file upload for content types that have images
        if ($request->hasFile('file')) {
            $folder = match ($type) {
                'banners', 'partners', 'popups' => 'gym_content',
                default => 'uploads',
            };
            $result = $this->storage->upload($request->file('file'), $folder, $gymId);
            $data['image_url'] = $result['url'];
        }

        DB::table($table)->insert($data);

        // Return with the singular key the frontend expects
        $key = self::SINGULAR[$type] ?? 'item';
        return response()->json([$key => $data], 201);
    }

    public function update(Request $request, string $type, string $id): JsonResponse
    {
        $table = self::TABLES[$type] ?? null;
        if (! $table) return response()->json(['error' => 'Invalid content type'], 400);

        $gymId = $request->user()->gym_id;
        $data = $this->filterAllowed($this->toSnakeCase($request->all()), $type);

        if (! empty($data)) {
            DB::table($table)->where('id', $id)->where('gym_id', $gymId)->update($data);
        }

        // Return the full updated record
        $updated = DB::table($table)->where('id', $id)->first();
        $key = self::SINGULAR[$type] ?? 'item';
        return response()->json([$key => $updated ? (array) $updated : $data]);
    }

    /**
     * Replace the image_url of an existing content row (banners / partners /
     * popups). Lives at its own POST route because PHP only parses multipart
     * bodies for POST, not PATCH — sidestepping the spoofing dance.
     */
    public function replaceImage(Request $request, string $type, string $id): JsonResponse
    {
        $imageBackedTypes = ['banners', 'partners', 'popups'];
        if (! in_array($type, $imageBackedTypes, true)) {
            return response()->json(['error' => 'This content type does not have an image'], 400);
        }
        $table = self::TABLES[$type] ?? null;
        if (! $table) return response()->json(['error' => 'Invalid content type'], 400);

        if (! $request->hasFile('file')) {
            return response()->json(['error' => 'Missing file upload'], 422);
        }

        $gymId = $request->user()->gym_id;
        $existing = DB::table($table)->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $existing) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $result = $this->storage->upload($request->file('file'), 'gym_content', $gymId);
        DB::table($table)
            ->where('id', $id)
            ->where('gym_id', $gymId)
            ->update(['image_url' => $result['url']]);

        $updated = DB::table($table)->where('id', $id)->first();
        $key = self::SINGULAR[$type] ?? 'item';
        return response()->json([$key => $updated ? (array) $updated : ['image_url' => $result['url']]]);
    }

    public function destroy(Request $request, string $type, string $id): JsonResponse
    {
        $table = self::TABLES[$type] ?? null;
        if (! $table) return response()->json(['error' => 'Invalid content type'], 400);

        $gymId = $request->user()->gym_id;
        DB::table($table)->where('id', $id)->where('gym_id', $gymId)->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
