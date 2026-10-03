<?php

namespace Tests\Feature\Billing;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Pending-payment reminder + "I have paid" settlement confirmation for
 * platform SaaS invoices.
 *
 * Same approach as the contract-terms suite: the legacy Supabase tables
 * are built by hand and the real settlement migration runs on top, which
 * also portability-checks it.
 */
class SettlementWorkflowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    private function buildSchema(): void
    {
        if (Schema::hasTable('saas_invoice_settlement_requests')) {
            return;
        }

        Schema::create('gyms', function ($t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->timestampsTz();
        });
        Schema::create('profiles', function ($t) {
            $t->uuid('id')->primary();
            $t->string('email');
            $t->string('full_name')->nullable();
            $t->string('role')->default('member');
            $t->uuid('gym_id')->nullable();
            $t->boolean('is_active')->default(true);
            $t->boolean('email_verified')->default(false);
            $t->timestampsTz();
        });
        Schema::create('staff_activity_logs', function ($t) {
            $t->uuid('id')->nullable();
            $t->uuid('gym_id')->nullable();
            $t->uuid('staff_id')->nullable();
            $t->string('staff_name')->nullable();
            $t->string('action')->nullable();
            $t->string('action_type')->nullable();
            $t->string('module')->nullable();
            $t->text('description')->nullable();
            $t->string('entity')->nullable();
            $t->string('entity_id')->nullable();
            $t->text('details')->nullable();
            $t->string('ip_address')->nullable();
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('saas_tiers', function ($t) {
            $t->uuid('id')->primary();
            $t->string('name');
        });
        Schema::create('gym_saas_invoices', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id')->nullable();
            $t->uuid('saas_tier_id')->nullable();
            $t->decimal('amount', 10, 2)->nullable();
            $t->string('currency')->default('EGP');
            $t->string('status')->default('pending');
            $t->timestampTz('billing_period_start')->nullable();
            $t->timestampTz('billing_period_end')->nullable();
            $t->timestampTz('paid_at')->nullable();
            $t->timestampTz('created_at')->nullable();
        });

        (require database_path('migrations/2026_10_03_100000_create_saas_invoice_settlement_requests.php'))->up();
    }

    /* ── factories ───────────────────────────────────────────────── */

    private function makeGym(string $name = 'Gym'): string
    {
        $id = (string) Str::uuid();
        DB::table('gyms')->insert(['id' => $id, 'name' => $name, 'created_at' => now(), 'updated_at' => now()]);
        return $id;
    }

    private function makeUser(?string $gymId, string $role): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'email' => Str::random(8) . '@test.com',
            'full_name' => ucfirst($role),
            'role' => $role,
            'gym_id' => $gymId,
            'is_active' => true,
        ]);
    }

    private function makeInvoice(string $gymId, string $status = 'pending'): string
    {
        $id = (string) Str::uuid();
        DB::table('gym_saas_invoices')->insert([
            'id' => $id, 'gym_id' => $gymId, 'amount' => 1500, 'currency' => 'EGP',
            'status' => $status,
            'billing_period_start' => now()->startOfMonth(),
            'billing_period_end' => now()->endOfMonth(),
            'created_at' => now(),
        ]);
        return $id;
    }

    private function invoiceStatus(string $invoiceId): string
    {
        return DB::table('gym_saas_invoices')->where('id', $invoiceId)->value('status');
    }

    private function reminderIds(): array
    {
        return collect($this->getJson('/api/billing/reminders')->assertOk()->json('data'))->pluck('id')->all();
    }

    /* ── banner ──────────────────────────────────────────────────── */

    public function test_owner_sees_pending_reminder_without_amounts(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        $this->makeInvoice($gym, 'paid');
        Sanctum::actingAs($this->makeUser($gym, 'gym_admin'));

        $res = $this->getJson('/api/billing/reminders')->assertOk();

        $this->assertSame([$inv], collect($res->json('data'))->pluck('id')->all());
        $this->assertArrayNotHasKey('amount', $res->json('data.0'));
        $this->assertArrayNotHasKey('currency', $res->json('data.0'));
    }

    public function test_staff_cannot_see_or_act_on_reminders(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        Sanctum::actingAs($this->makeUser($gym, 'staff'));

        $this->getJson('/api/billing/reminders')->assertForbidden();
        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertForbidden();
        $this->assertSame('pending', $this->invoiceStatus($inv));
    }

    public function test_reminders_are_isolated_between_tenants(): void
    {
        $gymA = $this->makeGym('A');
        $gymB = $this->makeGym('B');
        $invB = $this->makeInvoice($gymB);
        Sanctum::actingAs($this->makeUser($gymA, 'gym_admin'));

        $this->assertSame([], $this->reminderIds());
        $this->postJson("/api/billing/reminders/{$invB}/settle")->assertNotFound();
        $this->postJson("/api/billing/reminders/{$invB}/dismiss")->assertNotFound();
        $this->assertSame('pending', $this->invoiceStatus($invB));
        $this->assertNull(DB::table('gym_saas_invoices')->where('id', $invB)->value('reminder_dismissed_until'));
    }

    /* ── I have paid ─────────────────────────────────────────────── */

    public function test_settle_opens_a_claim_without_marking_paid(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        Sanctum::actingAs($this->makeUser($gym, 'gym_admin'));

        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertOk();

        $this->assertSame('awaiting_confirmation', $this->invoiceStatus($inv));
        $this->assertNull(DB::table('gym_saas_invoices')->where('id', $inv)->value('paid_at'));
        $this->assertSame(1, DB::table('saas_invoice_settlement_requests')
            ->where('invoice_id', $inv)->where('status', 'pending')->count());
        // Awaiting review → no banner.
        $this->assertSame([], $this->reminderIds());
    }

    public function test_duplicate_settle_is_rejected(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        Sanctum::actingAs($this->makeUser($gym, 'gym_admin'));

        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertOk();
        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertStatus(409);

        $this->assertSame(1, DB::table('saas_invoice_settlement_requests')->where('invoice_id', $inv)->count());
    }

    /* ── dismiss ─────────────────────────────────────────────────── */

    public function test_dismiss_hides_for_24h_only_and_does_not_change_status(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        $other = $this->makeInvoice($gym);
        Sanctum::actingAs($this->makeUser($gym, 'gym_admin'));

        $this->postJson("/api/billing/reminders/{$inv}/dismiss")->assertOk();

        $this->assertSame('pending', $this->invoiceStatus($inv));
        $this->assertSame(0, DB::table('saas_invoice_settlement_requests')->count());
        // Independent reminders: the other invoice still shows.
        $this->assertSame([$other], $this->reminderIds());

        $this->travel(23)->hours();
        $this->assertSame([$other], $this->reminderIds());

        $this->travel(2)->hours();
        $this->assertEqualsCanonicalizing([$inv, $other], $this->reminderIds());
    }

    public function test_redismiss_restarts_the_window(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        Sanctum::actingAs($this->makeUser($gym, 'gym_admin'));

        $this->postJson("/api/billing/reminders/{$inv}/dismiss")->assertOk();
        $this->travel(25)->hours();
        $this->postJson("/api/billing/reminders/{$inv}/dismiss")->assertOk();
        $this->travel(23)->hours();

        $this->assertSame([], $this->reminderIds());
    }

    public function test_paid_during_dismissal_never_reappears(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        $owner = $this->makeUser($gym, 'gym_admin');

        Sanctum::actingAs($owner);
        $this->postJson("/api/billing/reminders/{$inv}/dismiss")->assertOk();

        Sanctum::actingAs($this->makeUser(null, 'super_admin'));
        $this->postJson("/api/super-admin/invoices/{$inv}/mark-paid")->assertOk();

        $this->travel(25)->hours();
        Sanctum::actingAs($owner);
        $this->assertSame([], $this->reminderIds());
    }

    /* ── super-admin review ──────────────────────────────────────── */

    public function test_confirm_marks_paid_and_approves_claim(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        $owner = $this->makeUser($gym, 'gym_admin');
        $super = $this->makeUser(null, 'super_admin');

        Sanctum::actingAs($owner);
        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertOk();

        Sanctum::actingAs($super);
        $this->getJson('/api/super-admin/invoices/awaiting-count')->assertJsonPath('data.awaiting', 1);
        $this->getJson('/api/super-admin/invoices')
            ->assertJsonPath('data.0.status', 'awaiting_confirmation')
            ->assertJsonPath('data.0.settlement_requested_by', 'Gym_admin');
        $this->postJson("/api/super-admin/invoices/{$inv}/confirm-settlement")->assertOk();

        $this->assertSame('paid', $this->invoiceStatus($inv));
        $claim = DB::table('saas_invoice_settlement_requests')->where('invoice_id', $inv)->first();
        $this->assertSame('approved', $claim->status);
        $this->assertSame($super->id, $claim->reviewed_by);

        Sanctum::actingAs($owner);
        $this->assertSame([], $this->reminderIds());
    }

    public function test_reject_restores_previous_status_and_reminder(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym, 'overdue');
        $owner = $this->makeUser($gym, 'gym_admin');

        Sanctum::actingAs($owner);
        $this->postJson("/api/billing/reminders/{$inv}/dismiss")->assertOk();
        $this->travel(25)->hours();
        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertOk();

        Sanctum::actingAs($this->makeUser(null, 'super_admin'));
        $this->postJson("/api/super-admin/invoices/{$inv}/reject-settlement")->assertOk();

        $this->assertSame('overdue', $this->invoiceStatus($inv));
        $this->assertSame('rejected', DB::table('saas_invoice_settlement_requests')->where('invoice_id', $inv)->value('status'));

        Sanctum::actingAs($owner);
        $this->assertSame([$inv], $this->reminderIds());
        // A fresh claim is allowed after rejection.
        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertOk();
    }

    public function test_review_requires_an_open_claim(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        Sanctum::actingAs($this->makeUser(null, 'super_admin'));

        $this->postJson("/api/super-admin/invoices/{$inv}/confirm-settlement")->assertStatus(409);
        $this->postJson("/api/super-admin/invoices/{$inv}/reject-settlement")->assertStatus(409);
        $this->assertSame('pending', $this->invoiceStatus($inv));
    }

    public function test_cancel_removes_reminder_and_closes_claim(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        $owner = $this->makeUser($gym, 'gym_admin');

        Sanctum::actingAs($owner);
        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertOk();

        Sanctum::actingAs($this->makeUser(null, 'super_admin'));
        $this->postJson("/api/super-admin/invoices/{$inv}/cancel")->assertOk();

        $this->assertSame('cancelled', $this->invoiceStatus($inv));
        $this->assertSame(0, DB::table('saas_invoice_settlement_requests')->where('status', 'pending')->count());

        Sanctum::actingAs($owner);
        $this->assertSame([], $this->reminderIds());
    }

    public function test_tenant_cannot_reach_super_admin_review(): void
    {
        $gym = $this->makeGym();
        $inv = $this->makeInvoice($gym);
        Sanctum::actingAs($this->makeUser($gym, 'gym_admin'));
        $this->postJson("/api/billing/reminders/{$inv}/settle")->assertOk();

        $this->postJson("/api/super-admin/invoices/{$inv}/confirm-settlement")->assertForbidden();
        $this->assertSame('awaiting_confirmation', $this->invoiceStatus($inv));
    }

    public function test_mark_paid_refuses_cancelled_and_already_paid(): void
    {
        $gym = $this->makeGym();
        $cancelled = $this->makeInvoice($gym, 'cancelled');
        $paid = $this->makeInvoice($gym, 'paid');
        $paidAt = now()->subDays(3)->startOfSecond();
        DB::table('gym_saas_invoices')->where('id', $paid)->update(['paid_at' => $paidAt]);
        Sanctum::actingAs($this->makeUser(null, 'super_admin'));

        $this->postJson("/api/super-admin/invoices/{$cancelled}/mark-paid")->assertStatus(422);
        $this->postJson("/api/super-admin/invoices/{$paid}/mark-paid")->assertStatus(409);

        $this->assertSame('cancelled', $this->invoiceStatus($cancelled));
        $this->assertNull(DB::table('gym_saas_invoices')->where('id', $cancelled)->value('paid_at'));
        $this->assertEquals($paidAt, \Carbon\Carbon::parse(DB::table('gym_saas_invoices')->where('id', $paid)->value('paid_at')));
    }
}
