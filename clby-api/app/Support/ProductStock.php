<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Store pricing + stock rules shared by every way a product can be sold:
 * in-app Paymob checkout (PaymobController), front-desk sale
 * (ProductController::sell) and refunds.
 *
 * The backend is the only source of truth for price and stock. `stock`
 * NULL means "not tracked" (unlimited). When a product has active
 * variants, a variant must be chosen and stock is tracked per variant.
 *
 * Payment metadata written for a product sale (payments.metadata):
 *   product_id, product_name, variant_id?, variant_name?, quantity,
 *   unit_price_cents, stock_decremented?, stock_error?, stock_restored?
 */
final class ProductStock
{
    /**
     * Resolve a purchasable line for the caller's gym.
     *
     * @return array{product: object, variant: ?object, unit_cents: int, amount_cents: int, name: string, meta: array}
     *         | array{error: string, code: string, status: int}
     */
    public static function resolveLine(string $gymId, string $productId, ?string $variantId, int $quantity, bool $lock = false): array
    {
        $productQ = DB::table('products')
            ->where('id', $productId)
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->whereNull('deleted_at');
        if ($lock) $productQ->lockForUpdate();
        $product = $productQ->first();
        if (! $product) {
            return ['error' => 'Product not available.', 'code' => 'product_unavailable', 'status' => 404];
        }

        $variantsQ = DB::table('product_variants')
            ->where('product_id', $product->id)
            ->where('gym_id', $gymId)
            ->where('is_active', true)
            ->whereNull('deleted_at');
        if ($lock) $variantsQ->lockForUpdate();
        $variants = $variantsQ->get();

        $variant = null;
        if ($variants->isNotEmpty()) {
            $variant = $variants->firstWhere('id', $variantId ?? '');
            if (! $variant) {
                return ['error' => 'Please choose an option for this product.', 'code' => 'variant_required', 'status' => 422];
            }
            $stock = $variant->stock;
            $unitCents = (int) round((float) $variant->price * 100);
        } else {
            $stock = $product->stock;
            $unitCents = (int) round((float) $product->price * 100);
        }

        if ($stock !== null && (int) $stock < $quantity) {
            return ['error' => 'Not enough stock for this item.', 'code' => 'out_of_stock', 'status' => 422];
        }

        $name = $variant ? "{$product->name} — {$variant->name}" : $product->name;
        if ($quantity > 1) $name .= " ×{$quantity}";

        return [
            'product' => $product,
            'variant' => $variant,
            'unit_cents' => $unitCents,
            'amount_cents' => $unitCents * $quantity,
            'name' => $name,
            'meta' => array_filter([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'variant_id' => $variant->id ?? null,
                'variant_name' => $variant->name ?? null,
                'quantity' => $quantity,
                'unit_price_cents' => $unitCents,
            ], fn ($v) => $v !== null),
        ];
    }

    /**
     * Atomically take stock for a sale described by payment metadata.
     * Returns true when stock was taken or the item is untracked, false
     * when a tracked item no longer has enough stock (never goes negative).
     * Call inside a transaction.
     */
    public static function take(array $meta): bool
    {
        [$table, $id] = self::target($meta);
        if (! $id) return true;
        $qty = max(1, (int) ($meta['quantity'] ?? 1));

        $affected = DB::update(
            "UPDATE {$table} SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock IS NOT NULL AND stock >= ?",
            [$qty, now(), $id, $qty]
        );
        if ($affected > 0) return true;

        // Untracked (stock NULL) counts as success.
        return DB::table($table)->where('id', $id)->value('stock') === null;
    }

    /** Put stock back (full refund of a sale that took stock). Call inside a transaction. */
    public static function restore(array $meta): void
    {
        [$table, $id] = self::target($meta);
        if (! $id) return;
        $qty = max(1, (int) ($meta['quantity'] ?? 1));
        DB::update(
            "UPDATE {$table} SET stock = stock + ?, updated_at = ? WHERE id = ? AND stock IS NOT NULL",
            [$qty, now(), $id]
        );
    }

    /** @return array{0: string, 1: ?string} */
    private static function target(array $meta): array
    {
        if (! empty($meta['variant_id'])) return ['product_variants', (string) $meta['variant_id']];
        return ['products', isset($meta['product_id']) ? (string) $meta['product_id'] : null];
    }
}
