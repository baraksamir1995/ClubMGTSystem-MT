# Store & Events — API contract

Ported from the Ippon fork (2026-11-26), adapted to CLBY. On for every gym.
Sections self-hide in the app when a gym has no products / events.

All routes are under `/api`, Sanctum bearer auth, scoped to the caller's gym.
Errors are `{ error, code? }` (422 validation errors use Laravel's `{ message, errors }`).

## Store

### Product shape (admin + member)

```json
{
  "id": "uuid", "name": "Club Tee", "description": null, "image_url": null,
  "before_price": 350.0, "price": 300.0, "currency": "EGP",
  "stock": 12,            // null = not tracked (unlimited). Ignored when variants exist.
  "is_active": true, "display_order": 0,
  "variants": [
    { "id": "uuid", "name": "M", "image_url": null, "before_price": null,
      "price": 300.0, "stock": 2, "is_active": true, "display_order": 0 }
  ],
  "created_at": "...", "updated_at": "..."
}
```

If a product has active variants, a variant MUST be chosen and price/stock come from the variant.

### Admin (gym-admin)

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET | `/products` | store,view | `{ data: Product[] }` — all products incl. inactive |
| POST | `/products` | store,create | Product fields + `variants[]` → Product (201) |
| PATCH | `/products/{id}` | store,edit | partial; when `variants` is sent it is the full list (rows with `id` updated, without created, missing soft-deleted) |
| DELETE | `/products/{id}` | store,delete | soft delete |
| POST | `/products/image` | store,edit | multipart `file` (image ≤5MB) → `{ url }` |
| POST | `/products/{id}/sell` | payments,create | Front-desk sale: `{ variant_id?, quantity? (1-100), gym_member_id? (walk-in if omitted), payment_method? (cash\|card\|bank_transfer\|instapay\|wallet\|other, default cash), notes?, branch_id? }` → `{ data: Payment }` (201). Errors: `variant_required`, `out_of_stock`, `product_unavailable` |

### Recording a product / event payment (dashboard: Payments → Record Payment)

The dashboard sells products and event seats only through the Record Payment
modal (Store and Events are sub-tabs of Services; the Store page has no sell
button). `/products/{id}/sell` stays as an API endpoint and shares the code
(`App\Support\DeskSales`).

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET | `/payment-catalog?gym_member_id=` | payments,create | `{ data: { products: [{ id, name, image_url, price, currency, stock, variants: [{ id, name, price, stock }] }], events: [{ id, title, starts_at, price, currency, seats_left, configuration_label, configurations: [{id,name}], unavailable_reason }] } }`. Products: active with stock left (sold-out variants listed with `stock: 0`). Events: published, paid, not finished; `unavailable_reason` = `plan_required` \| `registration_closed` \| `already_registered` \| `event_full` \| null for that member |
| POST | `/payments` | payments,create | `service_type: "product"` + `{ gym_member_id, amount, product_id, variant_id?, quantity? (1-100), payment_method?, branch_id?, notes?, status: "paid" }` → takes stock and creates the payment (metadata as above) in one transaction. `service_type: "event"` + `{ gym_member_id, amount, event_id, event_configuration_id? … }` → creates a `confirmed`/`paid` registration (reusing an abandoned `pending_payment` row) and the payment with `event_registration_id`, event row locked for the capacity check. `amount` may differ from the list price (`original_amount` = list price, `discount_amount` = difference); currency is the item's. Errors `{ error, code }`: 404 `member_not_found`, `branch_not_found`, `product_unavailable`, `event_unavailable`; 422 `status_must_be_paid`, `product_required`, `event_required`, `variant_required`, `out_of_stock`, `event_not_priced`, `plan_required`, `registration_closed`, `event_past`, `already_registered`, `event_full`, `configuration_required`, `configuration_invalid` |

Undo: a full refund (`/paymob/refund`) or `DELETE /payments/{id}` puts product
stock back (once — `metadata.stock_restored`) and cancels the linked event
registration (`payment_status` = `refunded` on refund, `unpaid` on delete).
Partial refunds change neither.

Member history (`GET /payments`, own or `?gym_member_id=` for staff) rows now also carry
`title` (the service name, e.g. `Club Tee — M ×2`, `Open Day`) and numeric amounts.

### Member (mobile)

| Method | Path | Notes |
|---|---|---|
| GET | `/store/products?search=&per_page=&page=` | Laravel paginator; active products with active variants only |
| POST | `/paymob/intention` | `{ item_type: "product", plan_id: <product id>, variant_id?, quantity? (1-10), member_id, purchase_note? (≤500), payment_method? }` → same response as other purchases (`payment_id`, `client_secret`, `public_key`, `checkout_url`). Price is server-side. Errors: `variant_required`, `out_of_stock`, `product_unavailable` |

Stock is taken when the Paymob webhook confirms payment (not at checkout).
A full refund puts the stock back. Product payments have
`service_type = "product"` and `metadata = { product_id, product_name,
variant_id?, variant_name?, quantity, unit_price_cents, stock_decremented?,
stock_error? ("insufficient_stock" = paid but sold out → staff must refund/restock),
stock_restored? }`. The customer's note is stored in `notes` as `Customer note: …`.

## Events

### Admin event shape (`GET /admin/events`)

```json
{
  "id": "uuid", "title": "Open Day", "description": null, "location": null, "image_url": null,
  "starts_at": "ISO", "ends_at": null, "registration_deadline": null,
  "capacity": 20,                   // null = unlimited
  "is_paid": false, "price_cents": null, "currency": "EGP",
  "is_published": true,
  "configuration_label": "Level",   // label for the pick-one options
  "configurations": [{ "id": "uuid", "name": "Beginner", "sort_order": 0 }],
  "plan_targets": [{ "id": "plan uuid", "name": "VIP" }],   // [] = every member
  "registrations_count": 3, "pending_count": 1, "attended_count": 0
}
```

| Method | Path | Permission | Body / notes |
|---|---|---|---|
| GET | `/admin/events` | events,view | `{ data: Event[] }` newest first |
| POST | `/admin/events` | events,create | `{ title, starts_at, ends_at?, registration_deadline?, description?, location?, image_url?, capacity?, is_paid?, price_cents? (≥100 when paid), currency?, is_published?, configuration_label?, configurations?: [{id?, name}], plan_ids?: uuid[] }` → `{ data: { id } }` |
| PUT | `/admin/events/{id}` | events,edit | partial; `plan_ids` / `configurations` replace when present (`[]` clears) |
| DELETE | `/admin/events/{id}` | events,delete | 422 `has_paid_registrations` if any paid registration |
| POST | `/admin/events/image` | events,edit | multipart `file` → `{ url }` |
| GET | `/admin/events/{id}/registrations` | events,view | `{ data: [{ id, gym_member_id, status, payment_status, attended, configuration_name, created_at, member_name, member_photo_url, member_phone, member_number }] }` |
| POST | `/admin/event-registrations/{id}/attended` | events,edit | `{ attended: bool }` |
| POST | `/admin/event-registrations/{id}/mark-paid` | payments,create | `{ payment_method?, branch_id? }` — records a paid payment and confirms a `pending_payment` registration |

Registration `status`: `confirmed` \| `pending_payment` \| `cancelled`.
`payment_status`: `na` (free) \| `unpaid` \| `paid` \| `refunded`.
Fully refunding an event payment (existing refund flow) cancels the registration.

### Member (mobile)

| Method | Path | Notes |
|---|---|---|
| GET | `/events` | Published events not yet finished, filtered by plan targeting. Each: event fields above (no admin counts) + `configurations: [{id,name}]`, `seats_left` (null = unlimited), `my_registration: { id, status, payment_status, configuration_name } \| null` |
| POST | `/events/{id}/register` | FREE events only: `{ event_configuration_id? }` → 201 `{ data: { id, status, configuration_name } }`. Errors (`code`): `payment_required` (use Paymob), `configuration_required`, `configuration_invalid`, `plan_required` (403), `registration_closed`, `event_past`, `already_registered`, `event_full` |
| POST | `/paymob/intention` | PAID events: `{ item_type: "event", plan_id: <event id>, member_id, event_configuration_id? }`. Holds the seat as `pending_payment` for 30 min; the webhook confirms. Same error codes as register |
| GET | `/me/event-registrations` | `{ data: [{ id, event_id, status, payment_status, attended, configuration_name, title, starts_at, ends_at, location, image_url }] }` (cancelled excluded) |
| POST | `/event-registrations/{id}/cancel` | own only; 422 `paid_registration` when paid (staff must refund) |

There is deliberately no client "confirm payment" endpoint (Ippon had one):
only the HMAC-verified webhook or staff can mark a registration paid. After
checkout the app should re-fetch `/events` (status may still be
`pending_payment` for a few seconds until the webhook lands).

## App Layout keys

`home`: adds `events` (upcoming events strip). `explore`: adds `store`, `events`.
