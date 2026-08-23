<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Self-registration and email verification.
 *
 * Covers the flow where picking a gym at signup creates the gym_members row
 * immediately — so unverified members show up in the admin dashboard and
 * staff can verify them by hand — while the security gates that keep an
 * unverified member out of tenant data stay closed.
 *
 * Same approach as the contract-terms and sales suites: the core schema is
 * legacy Supabase with no Laravel migrations, so the supporting tables are
 * built by hand. `auth.users` is schema-qualified in Postgres; SQLite reaches
 * it by ATTACHing a second in-memory database under the name `auth`.
 */
class RegistrationFlowTest extends TestCase
{
    private string $gymId = '11111111-1111-1111-1111-111111111111';
    private string $otherGymId = '22222222-2222-2222-2222-222222222222';

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    private function buildSchema(): void
    {
        // `auth.users` lives in its own Postgres schema. ATTACH gives SQLite
        // a database named `auth` so the same qualified name resolves.
        DB::statement("ATTACH DATABASE ':memory:' AS auth");
        DB::statement('CREATE TABLE auth.users (
            id TEXT PRIMARY KEY,
            email TEXT,
            encrypted_password TEXT,
            created_at TEXT,
            updated_at TEXT
        )');

        Schema::create('gyms', function ($t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->boolean('is_active')->default(true);
            $t->timestampsTz();
        });

        Schema::create('profiles', function ($t) {
            $t->uuid('id')->primary();
            $t->string('email');
            $t->string('password')->nullable();
            $t->string('full_name')->nullable();
            $t->string('phone')->nullable();
            $t->string('username')->nullable();
            $t->date('date_of_birth')->nullable();
            $t->string('gender')->nullable();
            $t->string('role')->default('member');
            $t->uuid('gym_id')->nullable();
            $t->uuid('pending_gym_id')->nullable();
            $t->boolean('email_verified')->default(false);
            $t->boolean('is_active')->default(true);
            $t->softDeletesTz();
            $t->timestampsTz();
        });

        Schema::create('gym_members', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->uuid('user_id');
            $t->integer('member_number')->nullable();
            $t->string('status')->default('active');
            $t->text('notes')->nullable();
            $t->timestampTz('joined_at')->nullable();
            $t->softDeletesTz();
            $t->timestampsTz();
            $t->unique(['gym_id', 'member_number']);
        });

        Schema::create('email_verification_tokens', function ($t) {
            $t->uuid('user_id')->primary();
            $t->string('token');
            $t->timestampTz('expires_at');
            $t->timestampTz('created_at')->nullable();
        });

        Schema::create('personal_access_tokens', function ($t) {
            $t->id();
            $t->string('tokenable_type');
            $t->uuid('tokenable_id');
            $t->string('name');
            $t->string('token', 64)->unique();
            $t->text('abilities')->nullable();
            $t->timestampTz('last_used_at')->nullable();
            $t->timestampTz('expires_at')->nullable();
            $t->timestampsTz();
        });

        DB::table('gyms')->insert([
            ['id' => $this->gymId,      'name' => 'Test Gym',  'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => $this->otherGymId, 'name' => 'Other Gym', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'email' => 'newmember@example.test',
            'password' => 'secret12345',
            'password_confirmation' => 'secret12345',
            'full_name' => 'New Member',
            'gym_id' => $this->gymId,
        ], $overrides);
    }

    // ── the flow ────────────────────────────────────────────────────────────

    public function test_registration_assigns_the_gym_before_verification(): void
    {
        $res = $this->postJson('/api/auth/register', $this->payload());
        $res->assertStatus(201);

        $profile = DB::table('profiles')->where('email', 'newmember@example.test')->first();
        $this->assertSame($this->gymId, $profile->gym_id, 'gym_id must be set at registration');
        $this->assertFalse((bool) $profile->email_verified, 'must still be unverified');

        // The membership row is what makes them visible to the admin dashboard.
        $this->assertDatabaseHas('gym_members', [
            'user_id' => $profile->id,
            'gym_id'  => $this->gymId,
            'status'  => 'active',
        ]);

        // pending_gym_id is cleared by the assignment, so a null here is the
        // signal that the assignment genuinely ran now and was not deferred to
        // verification. Asserting gym_id alone cannot tell the two apart,
        // because assignGymMember writes gym_id itself.
        $this->assertNull(
            $profile->pending_gym_id,
            'assignment must have run at registration, not been deferred',
        );
    }

    public function test_member_number_is_not_allocated_at_signup(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);

        $profile = DB::table('profiles')->where('email', 'newmember@example.test')->first();
        $member = DB::table('gym_members')->where('user_id', $profile->id)->first();

        // Numbers are assigned when a membership is paid for (see the
        // allocators in PaymentController / PaymobController, which only run
        // while member_number IS NULL). Allocating here would both burn
        // numbers on unverified signups and stop those allocators firing.
        $this->assertNull($member->member_number);
    }

    public function test_registration_without_a_gym_leaves_the_user_unaffiliated(): void
    {
        $this->postJson('/api/auth/register', $this->payload(['gym_id' => null]))
            ->assertStatus(201);

        $profile = DB::table('profiles')->where('email', 'newmember@example.test')->first();
        $this->assertNull($profile->gym_id);
        $this->assertSame(0, DB::table('gym_members')->where('user_id', $profile->id)->count());
    }

    public function test_registration_rejects_an_unknown_gym(): void
    {
        $this->postJson('/api/auth/register', $this->payload([
            'gym_id' => '99999999-9999-9999-9999-999999999999',
        ]))->assertStatus(422)->assertJsonValidationErrors('gym_id');
    }

    // ── security gates stay closed ──────────────────────────────────────────

    public function test_unverified_member_cannot_log_in(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);

        $this->postJson('/api/auth/login', [
            'email' => 'newmember@example.test',
            'password' => 'secret12345',
        ])->assertStatus(403)->assertJson(['code' => 'email_not_verified']);
    }

    public function test_verified_member_middleware_blocks_unverified_user(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);
        $user = User::where('email', 'newmember@example.test')->first();

        $request = \Illuminate\Http\Request::create('/api/classes', 'GET');
        $request->setUserResolver(fn () => $user);

        $response = (new \App\Http\Middleware\RequireVerifiedEmail())
            ->handle($request, fn () => response()->json(['leaked' => true]));

        $this->assertSame(403, $response->getStatusCode());
        $this->assertSame('email_not_verified', json_decode($response->getContent(), true)['code']);
    }

    // ── white-label enforcement ─────────────────────────────────────────────

    public function test_login_from_the_wrong_branded_app_is_rejected(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);
        DB::table('profiles')->where('email', 'newmember@example.test')
            ->update(['email_verified' => true]);

        $this->postJson('/api/auth/login', [
            'email' => 'newmember@example.test',
            'password' => 'secret12345',
            'gym_id' => $this->otherGymId,
        ])->assertStatus(401);
    }

    public function test_login_from_the_matching_branded_app_succeeds(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);
        DB::table('profiles')->where('email', 'newmember@example.test')
            ->update(['email_verified' => true]);

        $this->postJson('/api/auth/login', [
            'email' => 'newmember@example.test',
            'password' => 'secret12345',
            'gym_id' => $this->gymId,
        ])->assertStatus(200)->assertJsonStructure(['user', 'token']);
    }

    public function test_stale_pending_gym_id_cannot_admit_an_enrolled_member_elsewhere(): void
    {
        // A member enrolled in gymId, but carrying a stale pending_gym_id for
        // otherGymId. The legacy fallback must not let them into the other
        // gym's branded app.
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);
        DB::table('profiles')->where('email', 'newmember@example.test')->update([
            'email_verified'  => true,
            'pending_gym_id'  => $this->otherGymId,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'newmember@example.test',
            'password' => 'secret12345',
            'gym_id' => $this->otherGymId,
        ])->assertStatus(401);
    }

    // ── verification ────────────────────────────────────────────────────────

    public function test_token_verification_marks_verified_without_duplicating_membership(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);
        $profile = DB::table('profiles')->where('email', 'newmember@example.test')->first();

        $raw = Str::random(64);
        DB::table('email_verification_tokens')->updateOrInsert(
            ['user_id' => $profile->id],
            ['token' => hash('sha256', $raw), 'expires_at' => now()->addDay(), 'created_at' => now()],
        );

        $this->postJson('/api/auth/verify-email', ['token' => $raw])->assertStatus(200);

        $this->assertTrue((bool) DB::table('profiles')->where('id', $profile->id)->value('email_verified'));
        // The row already existed from registration — verification must not add a second.
        $this->assertSame(1, DB::table('gym_members')->where('user_id', $profile->id)->count());
        // Token is single-use.
        $this->assertSame(0, DB::table('email_verification_tokens')->where('user_id', $profile->id)->count());
    }

    public function test_verification_rejects_an_invalid_token(): void
    {
        $this->postJson('/api/auth/verify-email', ['token' => 'not-a-real-token'])
            ->assertStatus(422);
    }

    public function test_verification_rejects_an_expired_token(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);
        $profile = DB::table('profiles')->where('email', 'newmember@example.test')->first();

        $raw = Str::random(64);
        DB::table('email_verification_tokens')->updateOrInsert(
            ['user_id' => $profile->id],
            ['token' => hash('sha256', $raw), 'expires_at' => now()->subDay(), 'created_at' => now()],
        );

        $this->postJson('/api/auth/verify-email', ['token' => $raw])->assertStatus(422);
    }

    public function test_legacy_profile_gets_its_membership_row_on_verification(): void
    {
        // Simulates a profile created before the gym was assigned at signup:
        // gym_id NULL with a pending_gym_id and no gym_members row.
        $userId = Str::uuid()->toString();
        DB::table('profiles')->insert([
            'id' => $userId,
            'email' => 'legacy@example.test',
            'password' => bcrypt('secret12345'),
            'full_name' => 'Legacy User',
            'role' => 'member',
            'gym_id' => null,
            'pending_gym_id' => $this->gymId,
            'email_verified' => false,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $raw = Str::random(64);
        DB::table('email_verification_tokens')->insert([
            'user_id' => $userId,
            'token' => hash('sha256', $raw),
            'expires_at' => now()->addDay(),
            'created_at' => now(),
        ]);

        $this->postJson('/api/auth/verify-email', ['token' => $raw])->assertStatus(200);

        $profile = DB::table('profiles')->where('id', $userId)->first();
        $this->assertSame($this->gymId, $profile->gym_id);
        $this->assertNull($profile->pending_gym_id);
        $this->assertSame(1, DB::table('gym_members')->where('user_id', $userId)->count());
    }

    // ── duplicate credentials ───────────────────────────────────────────────

    public function test_duplicate_email_is_a_field_level_error(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertStatus(201);

        $this->postJson('/api/auth/register', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_duplicate_phone_is_a_field_level_error(): void
    {
        $this->postJson('/api/auth/register', $this->payload(['phone' => '01000000001']))
            ->assertStatus(201);

        $this->postJson('/api/auth/register', $this->payload([
            'email' => 'another@example.test',
            'phone' => '01000000001',
        ]))->assertStatus(422)->assertJsonValidationErrors('phone');
    }
}
