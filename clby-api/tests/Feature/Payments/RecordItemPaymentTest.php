<?php

namespace Tests\Feature\Payments;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Record Payment for a store product / event seat (POST /payments with
 * service_type product|event), the catalog that feeds the modal, and the
 * undo paths (DELETE /payments/{id}, full refund).
 *
 * Legacy Supabase tables are hand-built (sqlite); the real store/events
 * migration runs on top.
 */
class RecordItemPaymentTest extends TestCase
{
    private string $gym;
    private User $admin;
    private string $member;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();

        $this->gym = $this->makeGym();
        $this->admin = $this->makeUser($this->gym, 'gym_admin');
        $this->member = $this->makeMember($this->gym);
        Sanctum::actingAs($this->admin);
    }

    private function buildSchema(): void
    {
        if (Schema::hasTable('products')) return;

        Schema::create('gyms', function ($t) {
            $t->uuid('id')->primary(); $t->string('name'); $t->string('timezone')->nullable(); $t->timestampsTz();
        });
        Schema::create('profiles', function ($t) {
            $t->uuid('id')->primary(); $t->string('email'); $t->string('full_name')->nullable();
            $t->string('role')->default('member'); $t->uuid('gym_id')->nullable();
            $t->boolean('is_active')->default(true); $t->boolean('email_verified')->default(false);
            $t->timestampsTz();
        });
        Schema::create('gym_members', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('user_id')->nullable();
            $t->integer('member_number')->nullable(); $t->string('status')->default('active');
            $t->timestampTz('deleted_at')->nullable();
        });
        Schema::create('branches', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name');
        });
        Schema::create('membership_plans', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name')->default('Plan');
        });
        Schema::create('member_memberships', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id')->nullable(); $t->uuid('gym_member_id');
            $t->uuid('plan_id')->nullable(); $t->string('status')->default('active');
            $t->date('start_date')->nullable(); $t->date('end_date')->nullable();
        });
        Schema::create('member_service_assignments', function ($t) {
            $t->uuid('id')->primary(); $t->timestampTz('assigned_at')->nullable(); $t->timestampTz('expires_at')->nullable();
        });
        Schema::create('payments', function ($t) {
            $t->uuid('id')->primary();
            foreach (['membership_id', 'service_assignment_id', 'member_id', 'gym_id', 'gym_member_id',
                      'promo_code_id', 'plan_promotion_id', 'branch_id'] as $c) {
                $t->uuid($c)->nullable();
            }
            foreach (['amount', 'original_amount', 'discount_amount', 'refund_amount', 'refunded_amount'] as $c) {
                $t->decimal($c, 10, 2)->nullable();
            }
            foreach (['currency', 'method', 'payment_method', 'status', 'invoice_number', 'refund_reason',
                      'transaction_id', 'source', 'service_type', 'service_name', 'specialist_name',
                      'payment_link_url', 'paymob_transaction_id'] as $c) {
                $t->string($c)->nullable();
            }
            $t->text('notes')->nullable(); $t->text('metadata')->nullable();
            $t->timestampTz('paid_at')->nullable(); $t->timestampTz('refunded_at')->nullable();
            $t->timestampsTz();
        });
        Schema::create('staff_activity_logs', function ($t) {
            $t->uuid('id')->nullable(); $t->uuid('gym_id')->nullable(); $t->uuid('staff_id')->nullable();
            $t->string('staff_name')->nullable(); $t->string('action')->nullable(); $t->string('action_type')->nullable();
            $t->string('module')->nullable(); $t->text('description')->nullable(); $t->string('entity')->nullable();
            $t->string('entity_id')->nullable(); $t->text('details')->nullable(); $t->string('ip_address')->nullable();
            $t->timestampTz('created_at')->nullable();
        });

        (require database_path('migrations/2026_11_26_110000_create_store_and_events.php'))->up();
    }

    /* ── factories ───────────────────────────────────────────────── */

    private function makeGym(): string
    {
        $id = (string) Str::uuid();
        DB::table('gyms')->insert(['id' => $id, 'name' => 'Gym', 'created_at' => now(), 'updated_at' => now()]);
        return $id;
    }

    private function makeUser(string $gymId, string $role): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(), 'email' => Str::random(8) . '@t.com', 'full_name' => ucfirst($role),
            'role' => $role, 'gym_id' => $gymId, 'is_active' => true, 'email_verified' => true,
        ]);
    }

    private function makeMember(string $gymId): string
    {
        $user = $this->makeUser($gymId, 'member');
        $id = (string) Str::uuid();
        DB::table('gym_members')->insert(['id' => $id, 'gym_id' => $gymId, 'user_id' => $user->id]);
        return $id;
    }

    private function makeProduct(?int $stock = 5, array $variants = [], ?string $gymId = null, float $price = 300): string
    {
        $id = (string) Str::uuid();
        DB::table('products')->insert([
            'id' => $id, 'gym_id' => $gymId ?? $this->gym, 'name' => 'Club Tee', 'price' => $price,
            'currency' => 'EGP', 'stock' => $stock, 'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        foreach ($variants as $name => $vStock) {
            DB::table('product_variants')->insert([
                'id' => (string) Str::uuid(), 'product_id' => $id, 'gym_id' => $gymId ?? $this->gym,
                'name' => $name, 'price' => 320, 'stock' => $vStock, 'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        return $id;
    }

    private function variantId(string $productId, string $name): string
    {
        return DB::table('product_variants')->where('product_id', $productId)->where('name', $name)->value('id');
    }

    private function makeEvent(array $over = []): string
    {
        $id = (string) Str::uuid();
        DB::table('events')->insert(array_merge([
            'id' => $id, 'gym_id' => $this->gym, 'title' => 'Open Day', 'starts_at' => now()->addDays(3),
            'is_paid' => true, 'price_cents' => 15000, 'currency' => 'EGP', 'is_published' => true,
            'capacity' => null, 'created_at' => now(), 'updated_at' => now(),
        ], $over));
        return $id;
    }

    private function recordProduct(string $productId, array $over = [])
    {
        return $this->postJson('/api/payments', array_merge([
            'gym_member_id' => $this->member, 'amount' => 600, 'payment_method' => 'cash', 'status' => 'paid',
            'service_type' => 'product', 'product_id' => $productId, 'quantity' => 2,
        ], $over));
    }

    private function recordEvent(string $eventId, array $over = [])
    {
        return $this->postJson('/api/payments', array_merge([
            'gym_member_id' => $this->member, 'amount' => 150, 'payment_method' => 'cash', 'status' => 'paid',
            'service_type' => 'event', 'event_id' => $eventId,
        ], $over));
    }

    /* ── products ────────────────────────────────────────────────── */

    public function test_product_payment_takes_stock_and_links_the_line(): void
    {
        $product = $this->makeProduct(stock: 5);

        $res = $this->recordProduct($product)->assertCreated();
        $payment = DB::table('payments')->where('id', $res->json('data.id'))->first();

        $this->assertSame(3, (int) DB::table('products')->where('id', $product)->value('stock'));
        $this->assertSame('product', $payment->service_type);
        $this->assertSame('Club Tee ×2', $payment->service_name);
        $this->assertSame('paid', $payment->status);
        $this->assertSame($this->member, $payment->gym_member_id);
        $this->assertEquals(600, (float) $payment->amount);
        $meta = json_decode($payment->metadata, true);
        $this->assertSame($product, $meta['product_id']);
        $this->assertSame(2, $meta['quantity']);
        $this->assertTrue($meta['stock_decremented']);
    }

    public function test_discounted_amount_keeps_list_price_as_original(): void
    {
        $product = $this->makeProduct(stock: 5);
        $id = $this->recordProduct($product, ['amount' => 500])->assertCreated()->json('data.id');
        $p = DB::table('payments')->where('id', $id)->first();
        $this->assertEquals(500, (float) $p->amount);
        $this->assertEquals(600, (float) $p->original_amount);
        $this->assertEquals(100, (float) $p->discount_amount);
    }

    public function test_out_of_stock_is_422_and_writes_nothing(): void
    {
        $product = $this->makeProduct(stock: 1);

        $this->recordProduct($product)->assertStatus(422)->assertJson(['code' => 'out_of_stock']);
        $this->assertSame(1, (int) DB::table('products')->where('id', $product)->value('stock'));
        $this->assertSame(0, DB::table('payments')->count());
    }

    public function test_variant_product_requires_a_variant_and_takes_its_stock(): void
    {
        $product = $this->makeProduct(stock: null, variants: ['S' => 0, 'M' => 4]);

        $this->recordProduct($product)->assertStatus(422)->assertJson(['code' => 'variant_required']);
        $this->recordProduct($product, ['variant_id' => $this->variantId($product, 'S'), 'quantity' => 1])
            ->assertStatus(422)->assertJson(['code' => 'out_of_stock']);

        $m = $this->variantId($product, 'M');
        $id = $this->recordProduct($product, ['variant_id' => $m, 'quantity' => 1, 'amount' => 320])
            ->assertCreated()->json('data.id');

        $this->assertSame(3, (int) DB::table('product_variants')->where('id', $m)->value('stock'));
        $p = DB::table('payments')->where('id', $id)->first();
        $this->assertSame('Club Tee — M', $p->service_name);
        $this->assertSame($m, json_decode($p->metadata, true)['variant_id']);
    }

    public function test_product_payment_must_be_paid(): void
    {
        $product = $this->makeProduct();
        $this->recordProduct($product, ['status' => 'pending'])
            ->assertStatus(422)->assertJson(['code' => 'status_must_be_paid']);
        $this->recordProduct($product, ['product_id' => null])
            ->assertStatus(422)->assertJson(['code' => 'product_required']);
    }

    /* ── events ──────────────────────────────────────────────────── */

    public function test_event_payment_registers_the_member(): void
    {
        $event = $this->makeEvent();

        $res = $this->recordEvent($event)->assertCreated();
        $payment = DB::table('payments')->where('id', $res->json('data.id'))->first();
        $reg = DB::table('event_registrations')->where('event_id', $event)->where('gym_member_id', $this->member)->first();

        $this->assertSame('confirmed', $reg->status);
        $this->assertSame('paid', $reg->payment_status);
        $this->assertSame($reg->id, $payment->event_registration_id);
        $this->assertSame('event', $payment->service_type);
        $this->assertSame('Open Day', $payment->service_name);
        $this->assertEquals(150, (float) $payment->original_amount);
    }

    public function test_event_reuses_an_abandoned_app_checkout_row(): void
    {
        $event = $this->makeEvent(['capacity' => 1]);
        DB::table('event_registrations')->insert([
            'id' => (string) Str::uuid(), 'gym_id' => $this->gym, 'event_id' => $event, 'gym_member_id' => $this->member,
            'status' => 'pending_payment', 'payment_status' => 'unpaid', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->recordEvent($event)->assertCreated();
        $this->assertSame(1, DB::table('event_registrations')->where('event_id', $event)->count());
        $this->assertSame('confirmed', DB::table('event_registrations')->where('event_id', $event)->value('status'));
    }

    public function test_full_event_is_422(): void
    {
        $event = $this->makeEvent(['capacity' => 1]);
        DB::table('event_registrations')->insert([
            'id' => (string) Str::uuid(), 'gym_id' => $this->gym, 'event_id' => $event,
            'gym_member_id' => $this->makeMember($this->gym), 'status' => 'confirmed', 'payment_status' => 'paid',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->recordEvent($event)->assertStatus(422)->assertJson(['code' => 'event_full']);
        $this->assertSame(0, DB::table('payments')->count());
    }

    public function test_ineligible_member_is_422(): void
    {
        $plan = (string) Str::uuid();
        DB::table('membership_plans')->insert(['id' => $plan, 'gym_id' => $this->gym]);
        $event = $this->makeEvent();
        DB::table('event_plan_targets')->insert(['event_id' => $event, 'plan_id' => $plan]);

        $this->recordEvent($event)->assertStatus(422)->assertJson(['code' => 'plan_required']);

        // Holding the plan makes them eligible.
        DB::table('member_memberships')->insert([
            'id' => (string) Str::uuid(), 'gym_member_id' => $this->member, 'plan_id' => $plan, 'status' => 'active',
        ]);
        $this->recordEvent($event)->assertCreated();
    }

    public function test_past_and_closed_events_are_422(): void
    {
        $past = $this->makeEvent(['starts_at' => now()->subDays(2)]);
        $this->recordEvent($past)->assertStatus(422)->assertJson(['code' => 'event_past']);

        $closed = $this->makeEvent(['registration_deadline' => now()->subHour()]);
        $this->recordEvent($closed)->assertStatus(422)->assertJson(['code' => 'registration_closed']);
    }

    public function test_duplicate_registration_is_422(): void
    {
        $event = $this->makeEvent();
        $this->recordEvent($event)->assertCreated();
        $this->recordEvent($event)->assertStatus(422)->assertJson(['code' => 'already_registered']);
        $this->assertSame(1, DB::table('payments')->count());
    }

    public function test_free_event_is_422(): void
    {
        $event = $this->makeEvent(['is_paid' => false, 'price_cents' => null]);
        $this->recordEvent($event)->assertStatus(422)->assertJson(['code' => 'event_not_priced']);
    }

    public function test_event_with_options_requires_one(): void
    {
        $event = $this->makeEvent(['configuration_label' => 'Level']);
        $cfg = (string) Str::uuid();
        DB::table('event_configurations')->insert(['id' => $cfg, 'event_id' => $event, 'name' => 'Beginner', 'sort_order' => 0]);

        $this->recordEvent($event)->assertStatus(422)->assertJson(['code' => 'configuration_required']);
        $id = $this->recordEvent($event, ['event_configuration_id' => $cfg])->assertCreated()->json('data.id');
        $this->assertSame('Open Day — Beginner', DB::table('payments')->where('id', $id)->value('service_name'));
    }

    /* ── gym scoping ─────────────────────────────────────────────── */

    public function test_cross_gym_ids_are_rejected(): void
    {
        $other = $this->makeGym();
        $foreignProduct = $this->makeProduct(stock: 5, gymId: $other);
        $foreignEvent = $this->makeEvent(['gym_id' => $other]);
        $foreignMember = $this->makeMember($other);

        $this->recordProduct($foreignProduct)->assertStatus(404)->assertJson(['code' => 'product_unavailable']);
        $this->recordEvent($foreignEvent)->assertStatus(404)->assertJson(['code' => 'event_unavailable']);
        $this->recordProduct($this->makeProduct(), ['gym_member_id' => $foreignMember])
            ->assertStatus(404)->assertJson(['code' => 'member_not_found']);

        $this->assertSame(5, (int) DB::table('products')->where('id', $foreignProduct)->value('stock'));
        $this->assertSame(0, DB::table('payments')->count());
        $this->assertSame(0, DB::table('event_registrations')->count());
    }

    public function test_member_role_cannot_record(): void
    {
        $memberUser = User::where('role', 'member')->first();
        Sanctum::actingAs($memberUser);
        $this->recordProduct($this->makeProduct())->assertStatus(403);
        $this->getJson('/api/payment-catalog')->assertStatus(403);
    }

    /* ── undo ────────────────────────────────────────────────────── */

    public function test_delete_restores_stock_and_cancels_registration(): void
    {
        $product = $this->makeProduct(stock: 5);
        $event = $this->makeEvent();
        $productPayment = $this->recordProduct($product)->json('data.id');
        $eventPayment = $this->recordEvent($event)->json('data.id');

        $this->deleteJson("/api/payments/{$productPayment}")->assertOk();
        $this->deleteJson("/api/payments/{$eventPayment}")->assertOk();

        $this->assertSame(5, (int) DB::table('products')->where('id', $product)->value('stock'));
        $this->assertSame(0, DB::table('payments')->count());
        $reg = DB::table('event_registrations')->where('event_id', $event)->first();
        $this->assertSame('cancelled', $reg->status);
        $this->assertSame('unpaid', $reg->payment_status);

        // Seat is free again: the member can be re-registered.
        $this->recordEvent($event)->assertCreated();
    }

    public function test_full_refund_restores_stock_once_then_delete_does_not_double_restore(): void
    {
        $product = $this->makeProduct(stock: 5);
        $event = $this->makeEvent();
        $productPayment = $this->recordProduct($product)->json('data.id');
        $eventPayment = $this->recordEvent($event)->json('data.id');

        $this->postJson('/api/paymob/refund', [
            'payment_id' => $productPayment, 'reason' => 'Wrong size', 'refund_type' => 'full', 'refund_amount' => 600,
        ])->assertOk();
        $this->postJson('/api/paymob/refund', [
            'payment_id' => $eventPayment, 'reason' => 'Cannot attend', 'refund_type' => 'full', 'refund_amount' => 150,
        ])->assertOk();

        $this->assertSame(5, (int) DB::table('products')->where('id', $product)->value('stock'));
        $this->assertSame('refunded', DB::table('payments')->where('id', $productPayment)->value('status'));
        $reg = DB::table('event_registrations')->where('event_id', $event)->first();
        $this->assertSame(['cancelled', 'refunded'], [$reg->status, $reg->payment_status]);

        $this->deleteJson("/api/payments/{$productPayment}")->assertOk();
        $this->assertSame(5, (int) DB::table('products')->where('id', $product)->value('stock'));
    }

    public function test_partial_refund_keeps_stock(): void
    {
        $product = $this->makeProduct(stock: 5);
        $id = $this->recordProduct($product)->json('data.id');
        $this->postJson('/api/paymob/refund', [
            'payment_id' => $id, 'reason' => 'Goodwill', 'refund_type' => 'partial', 'refund_amount' => 100,
        ])->assertOk();
        $this->assertSame(3, (int) DB::table('products')->where('id', $product)->value('stock'));
    }

    public function test_desk_sell_endpoint_still_works_through_shared_code(): void
    {
        $product = $this->makeProduct(stock: 2);
        $this->postJson("/api/products/{$product}/sell", ['quantity' => 2])->assertCreated()
            ->assertJsonPath('data.service_type', 'product');
        $this->assertSame(0, (int) DB::table('products')->where('id', $product)->value('stock'));
        $this->postJson("/api/products/{$product}/sell", [])->assertStatus(422)->assertJson(['code' => 'out_of_stock']);
    }

    /* ── listing + catalog ──────────────────────────────────────── */

    public function test_member_payment_listing_shows_type_and_title(): void
    {
        $this->recordProduct($this->makeProduct())->assertCreated();
        $this->recordEvent($this->makeEvent())->assertCreated();

        $rows = collect($this->getJson("/api/payments?gym_member_id={$this->member}")->assertOk()->json('data'));
        $this->assertEqualsCanonicalizing(['product', 'event'], $rows->pluck('service_type')->all());
        $this->assertEqualsCanonicalizing(['Club Tee ×2', 'Open Day'], $rows->pluck('title')->all());
        $this->assertIsNotString($rows->first()['amount']); // JSON number, not "600.00"

        // The member sees the same rows from the app (own payments).
        Sanctum::actingAs(User::find(DB::table('gym_members')->where('id', $this->member)->value('user_id')));
        $mine = collect($this->getJson('/api/payments')->assertOk()->json('data'));
        $this->assertEqualsCanonicalizing(['Club Tee ×2', 'Open Day'], $mine->pluck('title')->all());
    }

    public function test_catalog_lists_sellable_items_with_event_eligibility(): void
    {
        $inStock = $this->makeProduct(stock: 3);
        $this->makeProduct(stock: 0);                                  // sold out → hidden
        $variant = $this->makeProduct(stock: null, variants: ['S' => 0, 'M' => 2]);

        $open = $this->makeEvent(['title' => 'Open']);
        $full = $this->makeEvent(['title' => 'Full', 'capacity' => 1]);
        DB::table('event_registrations')->insert([
            'id' => (string) Str::uuid(), 'gym_id' => $this->gym, 'event_id' => $full,
            'gym_member_id' => $this->makeMember($this->gym), 'status' => 'confirmed', 'payment_status' => 'paid',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->makeEvent(['title' => 'Free', 'is_paid' => false, 'price_cents' => null]);   // hidden
        $this->makeEvent(['title' => 'Draft', 'is_published' => false]);                   // hidden
        $this->makeEvent(['title' => 'Past', 'starts_at' => now()->subDay()]);             // hidden

        $data = $this->getJson("/api/payment-catalog?gym_member_id={$this->member}")->assertOk()->json('data');

        $this->assertEqualsCanonicalizing([$inStock, $variant], array_column($data['products'], 'id'));
        $v = collect($data['products'])->firstWhere('id', $variant);
        $this->assertCount(2, $v['variants']);

        $events = collect($data['events'])->keyBy('title');
        $this->assertEqualsCanonicalizing(['Open', 'Full'], $events->keys()->all());
        $this->assertNull($events['Open']['unavailable_reason']);
        $this->assertEquals(150, $events['Open']['price']);
        $this->assertSame('event_full', $events['Full']['unavailable_reason']);

        // Already registered shows up as a reason too.
        $this->recordEvent($open)->assertCreated();
        $data = $this->getJson("/api/payment-catalog?gym_member_id={$this->member}")->json('data');
        $this->assertSame('already_registered', collect($data['events'])->firstWhere('id', $open)['unavailable_reason']);
    }
}
