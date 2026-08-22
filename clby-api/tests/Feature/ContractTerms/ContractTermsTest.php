<?php

namespace Tests\Feature\ContractTerms;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Gym-specific Contract Terms & Conditions.
 *
 * Same approach as the sales suite: the core schema is legacy Supabase
 * with no Laravel migrations, so the minimal supporting tables are built
 * by hand and the real terms migration runs on top — which also
 * portability-checks the migration.
 */
class ContractTermsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    private function buildSchema(): void
    {
        if (Schema::hasTable('gym_contract_terms')) {
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
        Schema::create('gym_members', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->uuid('user_id')->nullable();
            $t->timestampTz('deleted_at')->nullable();
        });
        Schema::create('staff_members', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->uuid('user_id')->nullable();
            $t->timestampTz('deleted_at')->nullable();
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
        Schema::create('payments', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id')->nullable();
            $t->uuid('gym_member_id')->nullable();
            $t->decimal('amount', 10, 2)->default(0);
            $t->string('status')->default('paid');
            $t->uuid('contract_terms_id')->nullable();
            $t->timestampsTz();
        });

        // The real terms table, built by the real migration.
        Schema::create('gym_contract_terms', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->text('contract_terms_conditions');
            $t->integer('terms_version');
            $t->uuid('updated_by')->nullable();
            $t->timestampsTz();
            $t->unique(['gym_id', 'terms_version']);
        });
    }

    /* ── factories ───────────────────────────────────────────────── */

    private function makeGym(string $name = 'Gym'): string
    {
        $id = (string) Str::uuid();
        DB::table('gyms')->insert(['id' => $id, 'name' => $name, 'created_at' => now(), 'updated_at' => now()]);
        return $id;
    }

    private function makeAdmin(string $gymId): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'email' => Str::random(8) . '@test.com',
            'full_name' => 'Admin',
            'role' => 'gym_admin',
            'gym_id' => $gymId,
            'is_active' => true,
        ]);
    }

    private function makeMember(string $gymId): array
    {
        $user = User::forceCreate([
            'id' => (string) Str::uuid(),
            'email' => Str::random(8) . '@test.com',
            'full_name' => 'Member',
            'role' => 'member',
            'gym_id' => $gymId,
            'is_active' => true,
            'email_verified' => true,
        ]);
        $memberId = (string) Str::uuid();
        DB::table('gym_members')->insert([
            'id' => $memberId, 'gym_id' => $gymId, 'user_id' => $user->id,
        ]);
        return [$user, $memberId];
    }

    private function makePayment(string $gymId, ?string $memberId = null, ?string $termsId = null): string
    {
        $id = (string) Str::uuid();
        DB::table('payments')->insert([
            'id' => $id, 'gym_id' => $gymId, 'gym_member_id' => $memberId,
            'amount' => 100, 'status' => 'paid', 'contract_terms_id' => $termsId,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return $id;
    }

    private function publish(string $gymId, string $body, int $version, ?string $by = null): string
    {
        $id = (string) Str::uuid();
        DB::table('gym_contract_terms')->insert([
            'id' => $id, 'gym_id' => $gymId,
            'contract_terms_conditions' => $body,
            'terms_version' => $version, 'updated_by' => $by,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return $id;
    }

    /* ── TC01 / TC06: configure + update ─────────────────────────── */

    public function test_admin_publishes_terms_and_they_persist(): void
    {
        $gym = $this->makeGym('A');
        Sanctum::actingAs($this->makeAdmin($gym));

        $res = $this->putJson('/api/contract-terms', [
            'contract_terms_conditions' => 'Gym A terms v1',
        ]);

        $res->assertOk()
            ->assertJsonPath('data.contract_terms_conditions', 'Gym A terms v1')
            ->assertJsonPath('data.terms_version', 1);

        $this->getJson('/api/contract-terms')
            ->assertOk()
            ->assertJsonPath('data.contract_terms_conditions', 'Gym A terms v1');
    }

    public function test_republishing_creates_a_new_version(): void
    {
        $gym = $this->makeGym('A');
        Sanctum::actingAs($this->makeAdmin($gym));

        $this->putJson('/api/contract-terms', ['contract_terms_conditions' => 'v1'])
            ->assertJsonPath('data.terms_version', 1);
        $this->putJson('/api/contract-terms', ['contract_terms_conditions' => 'v2'])
            ->assertJsonPath('data.terms_version', 2);

        // Both versions retained; current = highest.
        $this->assertSame(2, DB::table('gym_contract_terms')->where('gym_id', $gym)->count());
        $this->getJson('/api/contract-terms')
            ->assertJsonPath('data.contract_terms_conditions', 'v2');
    }

    public function test_empty_terms_are_rejected(): void
    {
        $gym = $this->makeGym('A');
        Sanctum::actingAs($this->makeAdmin($gym));

        $this->putJson('/api/contract-terms', ['contract_terms_conditions' => '   '])
            ->assertStatus(422);
        $this->putJson('/api/contract-terms', [])->assertStatus(422);
    }

    /* ── TC07: missing terms ─────────────────────────────────────── */

    public function test_gym_without_terms_returns_null_not_an_error(): void
    {
        $gym = $this->makeGym('A');
        Sanctum::actingAs($this->makeAdmin($gym));

        $this->getJson('/api/contract-terms')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    /* ── TC02 / TC05: profile scoping + multi-gym isolation ──────── */

    public function test_each_gym_sees_only_its_own_terms(): void
    {
        $gymA = $this->makeGym('A');
        $gymB = $this->makeGym('B');
        $this->publish($gymA, 'A TERMS', 1);
        $this->publish($gymB, 'B TERMS', 1);

        [$memberA] = $this->makeMember($gymA);
        Sanctum::actingAs($memberA);
        $this->getJson('/api/contract-terms')
            ->assertJsonPath('data.contract_terms_conditions', 'A TERMS');

        [$memberB] = $this->makeMember($gymB);
        Sanctum::actingAs($memberB);
        $this->getJson('/api/contract-terms')
            ->assertJsonPath('data.contract_terms_conditions', 'B TERMS');
    }

    public function test_updating_one_gyms_terms_does_not_affect_another(): void
    {
        $gymA = $this->makeGym('A');
        $gymB = $this->makeGym('B');
        $this->publish($gymB, 'B ORIGINAL', 1);

        Sanctum::actingAs($this->makeAdmin($gymA));
        $this->putJson('/api/contract-terms', ['contract_terms_conditions' => 'A NEW'])->assertOk();

        $this->assertSame('B ORIGINAL', DB::table('gym_contract_terms')
            ->where('gym_id', $gymB)->orderByDesc('terms_version')->value('contract_terms_conditions'));
    }

    /* ── TC03 / TC04: invoice scoping ────────────────────────────── */

    public function test_member_reads_terms_for_their_own_invoice(): void
    {
        $gym = $this->makeGym('A');
        $this->publish($gym, 'A TERMS', 1);
        [$member, $memberId] = $this->makeMember($gym);
        $payment = $this->makePayment($gym, $memberId);

        Sanctum::actingAs($member);
        $this->getJson("/api/payments/$payment/contract-terms")
            ->assertOk()
            ->assertJsonPath('data.contract_terms_conditions', 'A TERMS');
    }

    public function test_invoice_terms_come_from_the_invoices_gym(): void
    {
        $gymA = $this->makeGym('A');
        $gymB = $this->makeGym('B');
        $this->publish($gymA, 'A TERMS', 1);
        $this->publish($gymB, 'B TERMS', 1);

        // Admin of gym B reading a gym B invoice gets B's terms, even
        // though gym A also has terms.
        $paymentB = $this->makePayment($gymB);
        Sanctum::actingAs($this->makeAdmin($gymB));
        $this->getJson("/api/payments/$paymentB/contract-terms")
            ->assertOk()
            ->assertJsonPath('data.contract_terms_conditions', 'B TERMS');
    }

    /* ── TC11: version pinning ───────────────────────────────────── */

    public function test_invoice_pinned_to_v1_still_shows_v1_after_v2_published(): void
    {
        $gym = $this->makeGym('A');
        $v1 = $this->publish($gym, 'TERMS V1', 1);
        [$member, $memberId] = $this->makeMember($gym);
        $payment = $this->makePayment($gym, $memberId, $v1);

        // Gym moves on to v2.
        $this->publish($gym, 'TERMS V2', 2);

        Sanctum::actingAs($member);

        // The invoice still shows what it was issued under…
        $this->getJson("/api/payments/$payment/contract-terms")
            ->assertOk()
            ->assertJsonPath('data.contract_terms_conditions', 'TERMS V1')
            ->assertJsonPath('data.terms_version', 1)
            ->assertJsonPath('is_pinned_version', true);

        // …while the profile shows the gym's current terms.
        $this->getJson('/api/contract-terms')
            ->assertJsonPath('data.contract_terms_conditions', 'TERMS V2');
    }

    public function test_unpinned_invoice_falls_back_to_current_terms(): void
    {
        $gym = $this->makeGym('A');
        $this->publish($gym, 'TERMS V1', 1);
        [$member, $memberId] = $this->makeMember($gym);
        $payment = $this->makePayment($gym, $memberId, null);

        Sanctum::actingAs($member);
        $this->getJson("/api/payments/$payment/contract-terms")
            ->assertOk()
            ->assertJsonPath('data.contract_terms_conditions', 'TERMS V1')
            ->assertJsonPath('is_pinned_version', false);
    }

    /* ── TC10: cross-tenant security ─────────────────────────────── */

    public function test_member_cannot_read_another_gyms_invoice_terms(): void
    {
        $gymA = $this->makeGym('A');
        $gymB = $this->makeGym('B');
        $this->publish($gymA, 'A TERMS', 1);
        $this->publish($gymB, 'B SECRET TERMS', 1);

        [$memberA] = $this->makeMember($gymA);
        $paymentB = $this->makePayment($gymB);

        Sanctum::actingAs($memberA);
        $res = $this->getJson("/api/payments/$paymentB/contract-terms");
        $res->assertStatus(404);
        $this->assertStringNotContainsString('B SECRET TERMS', $res->getContent());
    }

    public function test_member_cannot_read_another_members_invoice_terms(): void
    {
        $gym = $this->makeGym('A');
        $this->publish($gym, 'A TERMS', 1);
        [$mine] = $this->makeMember($gym);
        [, $othersId] = $this->makeMember($gym);
        $othersPayment = $this->makePayment($gym, $othersId);

        Sanctum::actingAs($mine);
        $this->getJson("/api/payments/$othersPayment/contract-terms")->assertStatus(404);
    }

    public function test_admin_cannot_read_another_gyms_invoice_terms(): void
    {
        $gymA = $this->makeGym('A');
        $gymB = $this->makeGym('B');
        $this->publish($gymB, 'B SECRET TERMS', 1);
        $paymentB = $this->makePayment($gymB);

        Sanctum::actingAs($this->makeAdmin($gymA));
        $this->getJson("/api/payments/$paymentB/contract-terms")->assertStatus(404);
    }

    public function test_publishing_is_scoped_to_the_callers_own_gym(): void
    {
        $gymA = $this->makeGym('A');
        $gymB = $this->makeGym('B');

        Sanctum::actingAs($this->makeAdmin($gymA));
        // There is no gym_id input to manipulate; sending one is ignored.
        $this->putJson('/api/contract-terms', [
            'contract_terms_conditions' => 'written by A',
            'gym_id' => $gymB,
        ])->assertOk();

        $this->assertSame(0, DB::table('gym_contract_terms')->where('gym_id', $gymB)->count());
        $this->assertSame(1, DB::table('gym_contract_terms')->where('gym_id', $gymA)->count());
    }
}
