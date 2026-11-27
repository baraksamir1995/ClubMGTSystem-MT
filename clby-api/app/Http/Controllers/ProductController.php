<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\StorageService;
use App\Support\DeskSales;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gym store: physical products with optional variants (sizes/colours) and
 * stock. Ported from the Ippon fork.
 *
 *  - Admin catalog CRUD + image upload       (permission:store,*)
 *  - Front-desk sale that records a paid payment and takes stock
 *                                            (permission:payments,create)
 *  - Member store listing                    (GET /store/products)
 *  - In-app purchase goes through PaymobController (item_type=product);
 *    stock is taken by the webhook on successful payment.
 */
class ProductController extends Controller
{
    /**
     * Admin listing: every product for the caller's gym (active + inactive),
     * with all its non-deleted variants.
     */
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $products = Product::where('gym_id', $gymId)
            ->with('variants')
            ->orderBy('display_order')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => $products->map(fn (Product $p) => $this->serialize($p))->values(),
        ]);
    }

    /**
     * Member store listing: only active products with only their active
     * variants. Supports ?search= (case-insensitive name match) and ?per_page=.
     */
    public function storeIndex(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $query = Product::where('gym_id', $gymId)
            ->where('is_active', true)
            ->with(['variants' => fn ($q) => $q->where('is_active', true)])
            ->orderBy('display_order')
            ->orderBy('created_at');

        $search = trim((string) $request->query('search'));
        if ($search !== '') {
            // Case-insensitive partial match; escape LIKE wildcards in input.
            $escaped = addcslashes($search, '%_\\');
            $query->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($escaped).'%']);
        }

        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));
        $paginator = $query->paginate($perPage);
        $paginator->through(fn (Product $p) => $this->serialize($p));

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:2048',
            'before_price' => 'nullable|numeric|min:0',
            'price' => 'required|numeric|min:0',
            'currency' => 'nullable|string|max:5',
            'stock' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'display_order' => 'nullable|integer',
            'variants' => 'nullable|array',
            'variants.*.name' => 'required_with:variants|string|max:255',
            'variants.*.image_url' => 'nullable|string|max:2048',
            'variants.*.before_price' => 'nullable|numeric|min:0',
            'variants.*.price' => 'required_with:variants|numeric|min:0',
            'variants.*.stock' => 'nullable|integer|min:0',
            'variants.*.is_active' => 'nullable|boolean',
            'variants.*.display_order' => 'nullable|integer',
        ]);

        $gymId = $request->user()->gym_id;

        $product = DB::transaction(function () use ($request, $gymId) {
            $product = Product::create([
                'gym_id' => $gymId,
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'image_url' => $request->input('image_url'),
                'before_price' => $request->input('before_price'),
                'price' => $request->input('price'),
                'currency' => $request->input('currency', 'EGP') ?? 'EGP',
                'stock' => $request->input('stock'),
                'is_active' => $request->boolean('is_active', true),
                'display_order' => (int) $request->input('display_order', 0),
            ]);

            foreach ($request->input('variants', []) ?? [] as $variant) {
                $product->variants()->create([
                    'gym_id' => $gymId,
                    'name' => $variant['name'],
                    'image_url' => $variant['image_url'] ?? null,
                    'before_price' => $variant['before_price'] ?? null,
                    'price' => $variant['price'],
                    'stock' => $variant['stock'] ?? null,
                    'is_active' => (bool) ($variant['is_active'] ?? true),
                    'display_order' => (int) ($variant['display_order'] ?? 0),
                ]);
            }

            return $product;
        });

        $product->load('variants');
        return response()->json($this->serialize($product), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:2048',
            'before_price' => 'nullable|numeric|min:0',
            'price' => 'sometimes|numeric|min:0',
            'currency' => 'nullable|string|max:5',
            'stock' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'display_order' => 'nullable|integer',
            'variants' => 'nullable|array',
            'variants.*.id' => 'nullable|string',
            'variants.*.name' => 'required_with:variants|string|max:255',
            'variants.*.image_url' => 'nullable|string|max:2048',
            'variants.*.before_price' => 'nullable|numeric|min:0',
            'variants.*.price' => 'required_with:variants|numeric|min:0',
            'variants.*.stock' => 'nullable|integer|min:0',
            'variants.*.is_active' => 'nullable|boolean',
            'variants.*.display_order' => 'nullable|integer',
        ]);

        $gymId = $request->user()->gym_id;

        $product = Product::where('gym_id', $gymId)->find($id);
        if (! $product) {
            return response()->json(['error' => 'Not found'], 404);
        }

        DB::transaction(function () use ($request, $gymId, $product) {
            $attrs = $request->only([
                'name', 'description', 'image_url', 'before_price', 'price',
                'currency', 'stock', 'is_active', 'display_order',
            ]);
            // NOT NULL columns: an explicit null means "leave unchanged".
            foreach (['name', 'price', 'currency', 'is_active', 'display_order'] as $k) {
                if (array_key_exists($k, $attrs) && $attrs[$k] === null) unset($attrs[$k]);
            }
            $product->fill($attrs);
            $product->save();

            // Variant sync: only when the `variants` key is present in the
            // payload. Rows with an `id` are updated, rows without are
            // created, and existing variants missing from the payload are
            // soft-deleted.
            if ($request->has('variants')) {
                $incoming = $request->input('variants') ?? [];
                $keptIds = [];

                // One SELECT up front instead of a lookup per incoming row —
                // the admin modal always sends the full variants array.
                $existingById = ProductVariant::where('product_id', $product->id)
                    ->where('gym_id', $gymId)
                    ->get()
                    ->keyBy('id');

                foreach ($incoming as $data) {
                    $attrs = [
                        'name' => $data['name'],
                        'image_url' => $data['image_url'] ?? null,
                        'before_price' => $data['before_price'] ?? null,
                        'price' => $data['price'],
                        'stock' => $data['stock'] ?? null,
                        'is_active' => (bool) ($data['is_active'] ?? true),
                        'display_order' => (int) ($data['display_order'] ?? 0),
                    ];

                    $existing = ! empty($data['id']) ? $existingById->get($data['id']) : null;

                    if ($existing) {
                        $existing->fill($attrs);
                        $existing->save();
                        $keptIds[] = $existing->id;
                    } else {
                        $created = $product->variants()->create($attrs + ['gym_id' => $gymId]);
                        $keptIds[] = $created->id;
                    }
                }

                // Single bulk soft-delete (UPDATE … SET deleted_at) — no model
                // events are consumed here, so hydrating rows one by one only
                // cost extra queries.
                ProductVariant::where('product_id', $product->id)
                    ->whereNotIn('id', $keptIds)
                    ->delete();
            }
        });

        $product->load('variants');
        return response()->json($this->serialize($product));
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $product = Product::where('gym_id', $gymId)->find($id);
        if (! $product) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $product->delete(); // soft delete; variants stay but are unreachable

        return response()->json(['message' => 'Deleted']);
    }

    /** Upload a product / variant image; returns its public URL. */
    public function uploadImage(Request $request, StorageService $storage): JsonResponse
    {
        $request->validate(['file' => 'required|image|max:5120']);
        $result = $storage->upload($request->file('file'), 'products', $request->user()->gym_id);
        return response()->json(['url' => $result['url']]);
    }

    /**
     * Front-desk sale: record a paid payment for a product and take stock in
     * one transaction. The member is optional (walk-in customers).
     */
    public function sell(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'variant_id' => 'nullable|uuid',
            'quantity' => 'nullable|integer|min:1|max:100',
            'gym_member_id' => 'nullable|uuid',
            'payment_method' => 'nullable|string|in:cash,card,bank_transfer,instapay,wallet,other',
            'notes' => 'nullable|string|max:500',
            'branch_id' => 'nullable|uuid',
        ]);
        $gymId = $request->user()->gym_id;
        $quantity = (int) ($v['quantity'] ?? 1);

        if (! empty($v['gym_member_id']) && ! DB::table('gym_members')
                ->where('id', $v['gym_member_id'])->where('gym_id', $gymId)->whereNull('deleted_at')->exists()) {
            return response()->json(['error' => 'Member not found'], 404);
        }
        if (! empty($v['branch_id']) && ! DB::table('branches')
                ->where('id', $v['branch_id'])->where('gym_id', $gymId)->exists()) {
            return response()->json(['error' => 'Branch not found'], 404);
        }

        // Row locks inside DeskSales so two desk sales can't both pass the
        // stock check. Same code path as the Record Payment modal.
        $result = DB::transaction(fn () => DeskSales::sellProduct(
            $gymId, $id, $v['variant_id'] ?? null, $quantity,
            [
                'gym_member_id' => $v['gym_member_id'] ?? null,
                'branch_id' => $v['branch_id'] ?? null,
                'payment_method' => $v['payment_method'] ?? 'cash',
                'notes' => $v['notes'] ?? null,
            ],
            $request->user()->id,
        ));

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error'], 'code' => $result['code']], $result['status']);
        }
        return response()->json(['data' => $result['payment']], 201);
    }

    /**
     * Shared response contract (admin + member store endpoints). Consumed by
     * the gym-admin dashboard and the mobile app — keep the shape stable and
     * the decimals serialized as numbers.
     */
    private function serialize(Product $product): array
    {
        $variants = $product->variants->map(fn (ProductVariant $v) => [
            'id' => $v->id,
            'name' => $v->name,
            'image_url' => $v->image_url,
            'before_price' => $v->before_price !== null ? (float) $v->before_price : null,
            'price' => (float) $v->price,
            'stock' => $v->stock !== null ? (int) $v->stock : null,
            'is_active' => (bool) $v->is_active,
            'display_order' => (int) $v->display_order,
        ])->values();

        return [
            'id' => $product->id,
            'name' => $product->name,
            'description' => $product->description,
            'image_url' => $product->image_url,
            'before_price' => $product->before_price !== null ? (float) $product->before_price : null,
            'price' => (float) $product->price,
            'currency' => $product->currency,
            'stock' => $product->stock !== null ? (int) $product->stock : null,
            'is_active' => (bool) $product->is_active,
            'display_order' => (int) $product->display_order,
            'variants' => $variants,
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
        ];
    }
}
