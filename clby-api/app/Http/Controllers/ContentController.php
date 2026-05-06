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
    private const TABLES = [
        'announcements' => 'gym_announcements',
        'banners' => 'gym_banners',
        'faqs' => 'gym_faqs',
        'onboarding' => 'gym_onboarding_slides',
        'partners' => 'gym_partners',
        'photos' => 'gym_photos',
        'popups' => 'gym_popups',
    ];

    /** Singular key names for response wrapping (matches frontend expectations) */
    private const SINGULAR = [
        'announcements' => 'announcement',
        'banners' => 'banner',
        'faqs' => 'faq',
        'onboarding' => 'slide',
        'partners' => 'partner',
        'photos' => 'photo',
        'popups' => 'popup',
    ];

    /** Allowed columns per content type */
    private const ALLOWED_COLUMNS = [
        'announcements' => ['title', 'content', 'is_active', 'priority', 'start_date', 'end_date'],
        'banners' => ['title', 'subtitle', 'description', 'image_url', 'link_url', 'is_active', 'position', 'start_date', 'end_date'],
        'faqs' => ['question', 'answer', 'position', 'is_active', 'category'],
        'onboarding' => ['title', 'subtitle', 'description', 'image_url', 'position', 'is_active'],
        'partners' => ['name', 'description', 'image_url', 'link_url', 'is_active', 'position'],
        'photos' => ['title', 'description', 'image_url', 'is_active', 'position'],
        'popups' => ['title', 'subtitle', 'description', 'image_url', 'link_url', 'is_active', 'start_date', 'end_date', 'show_once'],
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
                'banners' => 'gym_content',
                'photos' => 'gym_content',
                'partners' => 'gym_content',
                'popups' => 'gym_content',
                'onboarding' => 'gym_content',
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

        DB::table($table)->where('id', $id)->where('gym_id', $gymId)->update($data);

        // Return the full updated record
        $updated = DB::table($table)->where('id', $id)->first();
        $key = self::SINGULAR[$type] ?? 'item';
        return response()->json([$key => $updated ? (array) $updated : $data]);
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
