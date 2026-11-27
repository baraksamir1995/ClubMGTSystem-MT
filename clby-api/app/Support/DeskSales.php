<?php

namespace App\Support;

use App\Models\Payment;
use Illuminate\Support\Facades\DB;

/**
 * Staff-recorded sales of store products and event seats, plus their undo.
 *
 * One home for the logic shared by:
 *   - ProductController::sell          (Store → front-desk sale)
 *   - PaymentController::store         (Record Payment modal, product / event)
 *   - PaymentController::destroy       (delete a payment → undo)
 *   - PaymobController::refund         (full refund → undo)
 *
 * Every method that writes must be called inside a DB transaction; the
 * sale methods take row locks (product / variant / event) so concurrent
 * sales can't oversell stock or overfill an event.
 *
 * Sale methods return ['payment' => Payment] on success, or
 * ['error' => string, 'code' => string, 'status' => int].
 */
final class DeskSales
{
    /**
     * Sell a product line: take stock and create a paid payment linked to the
     * product / variant / quantity (payments.metadata, see ProductStock).
     *
     * $attrs: gym_member_id?, branch_id?, payment_method?, notes?, paid_at?,
     *         amount? (staff override; list price otherwise), promo_code_id?
     */
    public static function sellProduct(string $gymId, string $productId, ?string $variantId, int $quantity, array $attrs, string $actorId): array
    {
        $line = ProductStock::resolveLine($gymId, $productId, $variantId, $quantity, lock: true);
        if (isset($line['error'])) return $line;

        $tracked = ($line['variant']->stock ?? $line['product']->stock) !== null;
        if (! ProductStock::take($line['meta'])) {
            // resolveLine already checked under lock; this is belt and braces.
            return ['error' => 'Not enough stock for this item.', 'code' => 'out_of_stock', 'status' => 422];
        }

        $listPrice = $line['amount_cents'] / 100;
        $payment = Payment::create(self::paymentRow($gymId, $attrs, $listPrice) + [
            'currency' => $line['product']->currency ?? 'EGP',
            'service_type' => 'product',
            'service_name' => $line['name'],
            'metadata' => $line['meta'] + ['stock_decremented' => $tracked, 'sold_by' => $actorId],
        ]);

        return ['payment' => $payment];
    }

    /**
     * Register a member for a PAID event and record its payment. Same rules as
     * the member app (plan targeting, deadline, past, duplicate, capacity) via
     * EventRegistrationRules, with the event row locked for the capacity
     * check. A pending_payment row (abandoned app checkout) is reused.
     *
     * $attrs: as sellProduct.
     */
    public static function registerForEvent(string $gymId, string $eventId, string $memberId, ?string $configurationId, array $attrs, string $actorId): array
    {
        $event = DB::table('events')
            ->where('id', $eventId)->where('gym_id', $gymId)->where('is_published', true)
            ->lockForUpdate()->first();
        if (! $event) {
            return ['error' => 'Event not found.', 'code' => 'event_unavailable', 'status' => 404];
        }
        if (! $event->is_paid || (int) $event->price_cents <= 0) {
            return ['error' => 'This event is free — register the member from the event roster instead.', 'code' => 'event_not_priced', 'status' => 422];
        }
        if ($err = EventRegistrationRules::check($event, $memberId)) {
            // plan_required is a 403 for a member acting on their own behalf;
            // for staff recording a payment it is a validation failure.
            return ['status' => 422] + $err;
        }

        $config = EventConfigurations::resolveSelection($eventId, $configurationId);
        if (isset($config['error'])) return $config + ['status' => 422];

        $registrationId = EventRegistrationRules::upsert($event, $memberId, $actorId, 'confirmed', 'paid', $config);

        $payment = Payment::create(self::paymentRow($gymId, ['gym_member_id' => $memberId] + $attrs, ((int) $event->price_cents) / 100) + [
            'currency' => $event->currency ?? 'EGP',
            'event_registration_id' => $registrationId,
            'service_type' => 'event',
            'service_name' => $config['name'] ? "{$event->title} — {$config['name']}" : $event->title,
            'metadata' => ['event_id' => $event->id, 'event_title' => $event->title, 'recorded_by' => $actorId],
        ]);

        return ['payment' => $payment];
    }

    /**
     * Undo the fulfilment of a product / event payment: put the stock back
     * (once — guarded by metadata.stock_restored) and cancel the linked event
     * registration. Returns the metadata to persist, or null when unchanged.
     * Used by a full refund ('refunded') and by deleting the payment
     * ('unpaid' — the money record is gone, nothing was paid back).
     */
    public static function reverse(Payment $payment, string $registrationPaymentStatus = 'refunded'): ?array
    {
        $newMeta = null;
        $meta = $payment->metadata ?? [];
        if ($payment->service_type === 'product'
            && ! empty($meta['stock_decremented']) && empty($meta['stock_restored'])) {
            ProductStock::restore($meta);
            $newMeta = array_merge($meta, ['stock_restored' => true]);
        }
        if ($payment->event_registration_id) {
            DB::table('event_registrations')
                ->where('id', $payment->event_registration_id)
                ->where('gym_id', $payment->gym_id)
                ->update(['status' => 'cancelled', 'payment_status' => $registrationPaymentStatus, 'updated_at' => now()]);
        }
        return $newMeta;
    }

    /** Columns shared by both sale kinds. Amount = staff override or list price. */
    private static function paymentRow(string $gymId, array $attrs, float $listPrice): array
    {
        $amount = array_key_exists('amount', $attrs) && $attrs['amount'] !== null
            ? round((float) $attrs['amount'], 2)
            : $listPrice;
        return [
            'gym_id' => $gymId,
            'gym_member_id' => $attrs['gym_member_id'] ?? null,
            'branch_id' => $attrs['branch_id'] ?? null,
            'amount' => number_format($amount, 2, '.', ''),
            'original_amount' => number_format($listPrice, 2, '.', ''),
            'discount_amount' => number_format(max(0, $listPrice - $amount), 2, '.', ''),
            'promo_code_id' => $attrs['promo_code_id'] ?? null,
            'payment_method' => $attrs['payment_method'] ?? 'cash',
            'status' => 'paid',
            'paid_at' => $attrs['paid_at'] ?? now(),
            'source' => 'admin',
            'notes' => $attrs['notes'] ?? null,
        ];
    }
}
