<?php

namespace Tests\Feature\GymRequests;

use App\Jobs\SendGymRequestEmail;
use App\Models\GymRequest;
use App\Models\User;
use App\Services\EmailService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Gym self-onboarding: public submission → super-admin approve / decline →
 * provisioning + notification emails.
 *
 * Same approach as the registration and settlement suites: the legacy
 * Supabase tables are built by hand, and the real gym_requests and
 * password_reset_tokens migrations run on top (portability check).
 */
class GymSelfOnboardingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
        config(['services.admin_dashboard.url' => 'https://admin.example.test']);
        // Logo is mandatory on submit; keep uploads off real storage.
        Storage::fake('local');
        config(['filesystems.default' => 'local']);
    }

    private function buildSchema(): void
    {
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
            $t->text('description')->nullable();
            $t->text('address')->nullable();
            $t->string('city')->nullable();
            $t->string('country')->nullable();
            $t->string('phone')->nullable();
            $t->string('email')->nullable();
            $t->string('website')->nullable();
            $t->string('logo_url')->nullable();
            $t->string('cover_image_url')->nullable();
            $t->string('timezone')->default('UTC');
            $t->string('language')->default('en');
            $t->uuid('owner_id')->nullable();
            $t->boolean('is_active')->default(true);
            $t->integer('max_branches')->default(1);
            $t->string('category')->nullable()->default('gym');
            $t->double('latitude')->nullable();
            $t->double('longitude')->nullable();
            $t->text('services')->nullable();
            $t->timestampsTz();
        });
        Schema::create('profiles', function ($t) {
            $t->uuid('id')->primary();
            $t->string('email');
            $t->string('password')->nullable();
            $t->string('full_name')->nullable();
            $t->string('phone')->nullable()->unique();   // profiles_phone_unique on prod
            $t->string('username')->nullable();
            $t->string('role')->default('member');
            $t->uuid('gym_id')->nullable();
            $t->boolean('is_active')->default(true);
            $t->boolean('email_verified')->default(false);
            $t->boolean('must_reset_password')->default(false);
            $t->softDeletesTz();
            $t->timestampsTz();
        });
        Schema::create('branches', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->string('name');
            $t->boolean('is_active')->default(true);
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('studios', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->uuid('branch_id');
            $t->string('name');
            $t->integer('capacity')->nullable();
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('schedule_settings', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->boolean('is_published')->default(false);
            $t->timestampTz('last_updated_at')->nullable();
            $t->timestampsTz();
        });
        Schema::create('password_reset_tokens', function ($t) {
            $t->string('email')->primary();
            $t->string('token');
            $t->timestamp('created_at')->nullable();
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

        (require database_path('migrations/2026_10_23_100000_create_gym_requests_table.php'))->up();
        (require database_path('migrations/2026_10_23_100100_add_expires_at_to_password_reset_tokens.php'))->up();
    }

    /* ── factories ───────────────────────────────────────────────── */

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'gym_name' => 'Iron Temple',
            'description' => 'Strength & conditioning',
            'address' => '12 Nile St',
            'city' => 'Cairo',
            'country' => 'Egypt',
            'phone' => '01012345678',
            'business_email' => 'hello@irontemple.test',
            'category' => 'gym',
            'services' => ['Personal training', 'Sauna'],
            'branches_count' => 2,
            'timezone' => 'Africa/Cairo',
            'owner_name' => 'Sara Owner',
            'owner_email' => 'Sara@IronTemple.test',
            'owner_phone' => '01098765432',
            'logo' => UploadedFile::fake()->image('logo.png', 64, 64),
        ], $overrides);
    }

    private function submit(array $overrides = []): string
    {
        $res = $this->postJson('/api/gym-requests', $this->payload($overrides))->assertCreated();
        return $res->json('data.id');
    }

    private function user(string $role, ?string $gymId = null): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(),
            'email' => Str::random(8) . '@staff.test',
            'full_name' => ucfirst($role),
            'role' => $role,
            'gym_id' => $gymId,
            'is_active' => true,
        ]);
    }

    private function actingAsSuperAdmin(): User
    {
        $u = $this->user('super_admin');
        Sanctum::actingAs($u);
        return $u;
    }

    /* ── public submission ──────────────────────────────────────── */

    public function test_valid_submission_creates_pending_request_without_provisioning(): void
    {
        Queue::fake();

        $res = $this->postJson('/api/gym-requests', $this->payload())->assertCreated();

        $res->assertJsonPath('data.status', 'pending');
        $this->assertStringStartsWith('GR-', $res->json('data.reference'));
        // Public response exposes no gym/owner details.
        $this->assertNull($res->json('data.owner_email'));

        $row = GymRequest::find($res->json('data.id'));
        $this->assertSame('sara@irontemple.test', $row->owner_email);
        $this->assertSame(['Personal training', 'Sauna'], $row->services);

        $this->assertSame(0, DB::table('gyms')->count());
        $this->assertSame(0, DB::table('profiles')->count());
        $this->assertTrue(DB::table('gym_request_events')->where('event', 'submitted')->exists());

        Queue::assertPushed(SendGymRequestEmail::class, fn ($j) => $j->type === 'received' && $j->gymRequestId === $row->id);
    }

    public function test_submission_with_logo_stores_it(): void
    {
        Queue::fake();
        Storage::fake('local');
        config(['filesystems.default' => 'local']);

        $id = $this->postJson('/api/gym-requests', $this->payload([
            'logo' => UploadedFile::fake()->image('logo.png', 200, 200),
        ]))->assertCreated()->json('data.id');

        $this->assertNotNull(GymRequest::find($id)->logo_url);
    }

    public function test_invalid_submission_is_rejected_server_side(): void
    {
        $this->postJson('/api/gym-requests', $this->payload([
            'gym_name' => '',
            'owner_email' => 'not-an-email',
            'category' => 'casino',
        ]))->assertStatus(422)->assertJsonValidationErrors(['gym_name', 'owner_email', 'category']);

        $this->postJson('/api/gym-requests', $this->payload(['company_website' => 'http://spam']))
            ->assertStatus(422);

        $this->assertSame(0, GymRequest::count());
    }

    public function test_public_payload_cannot_set_status_or_review_fields(): void
    {
        Queue::fake();
        $id = $this->postJson('/api/gym-requests', $this->payload([
            'status' => 'approved',
            'reviewed_by' => (string) Str::uuid(),
            'provisioned_gym_id' => (string) Str::uuid(),
        ]))->assertCreated()->json('data.id');

        $row = GymRequest::find($id);
        $this->assertSame('pending', $row->status);
        $this->assertNull($row->reviewed_by);
        $this->assertNull($row->provisioned_gym_id);
    }

    public function test_duplicate_submissions_are_controlled(): void
    {
        Queue::fake();
        $key = (string) Str::uuid();

        $first = $this->postJson('/api/gym-requests', $this->payload(['submission_key' => $key]))->assertCreated();
        // Retried POST with the same idempotency key → same request.
        $this->postJson('/api/gym-requests', $this->payload(['submission_key' => $key]))
            ->assertOk()->assertJsonPath('data.id', $first->json('data.id'));
        // New key, same owner email while pending → conflict.
        $this->postJson('/api/gym-requests', $this->payload(['submission_key' => (string) Str::uuid()]))
            ->assertStatus(409);

        $this->assertSame(1, GymRequest::count());
        Queue::assertPushed(SendGymRequestEmail::class, 1);
    }

    public function test_existing_account_email_is_rejected(): void
    {
        $this->user('member')->forceFill(['email' => 'sara@irontemple.test'])->save();

        $this->postJson('/api/gym-requests', $this->payload())
            ->assertStatus(422)->assertJsonValidationErrors(['owner_email']);
    }

    public function test_declined_email_can_submit_again(): void
    {
        Queue::fake();
        $first = $this->submit();
        $this->actingAsSuperAdmin();
        $this->postJson("/api/super-admin/gym-requests/{$first}/decline")->assertOk();

        $second = $this->postJson('/api/gym-requests', $this->payload())
            ->assertCreated()->assertJsonPath('data.status', 'pending')->json('data.id');

        $this->assertNotSame($first, $second);
        $this->assertSame('declined', GymRequest::find($first)->status);
        $this->postJson("/api/super-admin/gym-requests/{$second}/approve")->assertOk();
    }

    /* ── authorization ──────────────────────────────────────────── */

    public function test_only_super_admin_can_review(): void
    {
        Queue::fake();
        $id = $this->submit();

        // Unauthenticated
        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertUnauthorized();
        $this->getJson('/api/super-admin/gym-requests')->assertUnauthorized();

        // Gym admin of some other gym
        Sanctum::actingAs($this->user('gym_admin', (string) Str::uuid()));
        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertForbidden();
        $this->postJson("/api/super-admin/gym-requests/{$id}/decline")->assertForbidden();
        $this->getJson("/api/super-admin/gym-requests/{$id}")->assertForbidden();

        $this->assertSame('pending', GymRequest::find($id)->status);
        $this->assertSame(0, DB::table('gyms')->count());
    }

    /* ── approval ───────────────────────────────────────────────── */

    public function test_approve_provisions_gym_and_owner(): void
    {
        Queue::fake();
        $id = $this->submit();
        $admin = $this->actingAsSuperAdmin();

        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")
            ->assertOk()->assertJsonPath('data.status', 'approved');

        $req = GymRequest::find($id);
        $gym = DB::table('gyms')->where('id', $req->provisioned_gym_id)->first();
        $this->assertNotNull($gym);
        $this->assertSame('Iron Temple', $gym->name);
        $this->assertSame('hello@irontemple.test', $gym->email);
        $this->assertTrue((bool) $gym->is_active);
        $this->assertSame(10, (int) $gym->max_branches);

        $owner = DB::table('profiles')->where('id', $req->owner_profile_id)->first();
        $this->assertSame('sara@irontemple.test', $owner->email);
        $this->assertSame('gym_admin', $owner->role);
        $this->assertSame($gym->id, $owner->gym_id);
        $this->assertTrue((bool) $owner->must_reset_password);

        $this->assertSame(1, DB::table('branches')->where('gym_id', $gym->id)->count());
        $this->assertSame(1, DB::table('studios')->where('gym_id', $gym->id)->count());
        $this->assertSame(1, DB::table('schedule_settings')->where('gym_id', $gym->id)->count());
        $this->assertSame($admin->id, $req->reviewed_by);
        $this->assertNotNull($req->reviewed_at);

        // Now visible in the mobile gym list.
        $this->getJson('/api/gyms')->assertOk()->assertJsonPath('data.0.id', $gym->id);

        Queue::assertPushed(SendGymRequestEmail::class, fn ($j) => $j->type === 'approved');
    }

    public function test_pending_and_declined_requests_never_reach_public_gym_list(): void
    {
        Queue::fake();
        $this->submit();
        $declined = $this->submit(['owner_email' => 'other@x.test']);
        $this->actingAsSuperAdmin();
        $this->postJson("/api/super-admin/gym-requests/{$declined}/decline")->assertOk();

        $this->getJson('/api/gyms')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_repeated_approval_is_idempotent(): void
    {
        Queue::fake();
        $id = $this->submit();
        $this->actingAsSuperAdmin();

        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertOk();
        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")
            ->assertOk()->assertJsonPath('already_approved', true);

        $this->assertSame(1, DB::table('gyms')->count());
        $this->assertSame(1, DB::table('profiles')->where('role', 'gym_admin')->count());
        Queue::assertPushed(SendGymRequestEmail::class, fn ($j) => $j->type === 'approved', 1);
    }

    public function test_provisioning_conflict_is_recorded_and_recoverable(): void
    {
        Queue::fake();
        $id = $this->submit();
        // The owner email gets taken after submission (e.g. member signup).
        $squatter = $this->user('member');
        $squatter->forceFill(['email' => 'sara@irontemple.test'])->save();
        $this->actingAsSuperAdmin();

        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertStatus(422);

        $req = GymRequest::find($id);
        $this->assertSame('pending', $req->status);
        $this->assertSame(1, $req->provisioning_attempts);
        $this->assertNotNull($req->last_provisioning_error);
        $this->assertSame(0, DB::table('gyms')->count());
        $this->assertTrue(DB::table('gym_request_events')->where('event', 'provisioning_failed')->exists());

        // Conflict resolved → approve again succeeds, exactly once.
        DB::table('profiles')->where('id', $squatter->id)->delete();
        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertOk();
        $this->assertSame(1, DB::table('gyms')->count());
        $this->assertNull(GymRequest::find($id)->last_provisioning_error);
    }

    public function test_mid_provisioning_failure_rolls_back_everything(): void
    {
        Queue::fake();
        $id = $this->submit();
        $this->actingAsSuperAdmin();
        // Break a later provisioning step: gym + profile inserts succeed,
        // then studios fails. Nothing may survive.
        Schema::drop('studios');

        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertStatus(500);

        $this->assertSame('pending', GymRequest::find($id)->status);
        $this->assertSame(0, DB::table('gyms')->count());
        $this->assertSame(0, DB::table('profiles')->where('role', 'gym_admin')->count());
        $this->assertSame(0, DB::table('branches')->count());
        Queue::assertNotPushed(SendGymRequestEmail::class, fn ($j) => $j->type === 'approved');
    }

    /* ── decline / reopen ───────────────────────────────────────── */

    public function test_decline_flow_and_explicit_reopen(): void
    {
        Queue::fake();
        $id = $this->submit();
        $admin = $this->actingAsSuperAdmin();

        $this->postJson("/api/super-admin/gym-requests/{$id}/decline", ['reason' => 'Incomplete info', 'share_reason' => true])
            ->assertOk()->assertJsonPath('data.status', 'declined');

        $req = GymRequest::find($id);
        $this->assertSame('Incomplete info', $req->decline_reason);
        $this->assertTrue($req->share_decline_reason);
        $this->assertSame($admin->id, $req->reviewed_by);
        Queue::assertPushed(SendGymRequestEmail::class, fn ($j) => $j->type === 'declined');

        // Declined can't be approved directly, and nothing is provisioned.
        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertStatus(409);
        $this->assertSame(0, DB::table('gyms')->count());

        // Repeat decline is a no-op.
        $this->postJson("/api/super-admin/gym-requests/{$id}/decline")
            ->assertOk()->assertJsonPath('already_declined', true);
        Queue::assertPushed(SendGymRequestEmail::class, fn ($j) => $j->type === 'declined', 1);

        // Explicit reopen → pending → approvable.
        $this->postJson("/api/super-admin/gym-requests/{$id}/reopen")->assertOk()->assertJsonPath('data.status', 'pending');
        $this->assertNull(GymRequest::find($id)->decline_reason);
        $this->assertTrue(DB::table('gym_request_events')->where('event', 'reopened')->exists());
        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertOk();

        // Approved requests can't be declined or reopened.
        $this->postJson("/api/super-admin/gym-requests/{$id}/decline")->assertStatus(409);
        $this->postJson("/api/super-admin/gym-requests/{$id}/reopen")->assertStatus(409);
    }

    public function test_listing_supports_search_status_filter_and_pagination(): void
    {
        Queue::fake();
        $a = $this->submit(['gym_name' => 'Alpha Box', 'owner_email' => 'a@x.test']);
        $this->submit(['gym_name' => 'Beta Yoga', 'owner_email' => 'b@x.test']);
        $this->submit(['gym_name' => 'Gamma Gym', 'owner_email' => 'c@x.test']);
        $this->actingAsSuperAdmin();
        $this->postJson("/api/super-admin/gym-requests/{$a}/decline")->assertOk();

        $this->getJson('/api/super-admin/gym-requests?search=beta')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.gym_name', 'Beta Yoga');
        $this->getJson('/api/super-admin/gym-requests?status=declined')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('counts.pending', 2);
        $this->getJson('/api/super-admin/gym-requests?per_page=2&sort=gym_name&dir=asc')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('data.0.gym_name', 'Alpha Box');

        $this->getJson("/api/super-admin/gym-requests/{$a}")
            ->assertOk()->assertJsonPath('data.owner_email', 'a@x.test')
            ->assertJsonPath('events.0.event', 'submitted');
    }

    /* ── emails ─────────────────────────────────────────────────── */

    private function approvedRequest(): GymRequest
    {
        Queue::fake();
        $id = $this->submit();
        $this->actingAsSuperAdmin();
        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertOk();
        return GymRequest::find($id);
    }

    public function test_approval_email_issues_setup_link_once(): void
    {
        $req = $this->approvedRequest();

        $sent = [];
        $this->mock(EmailService::class)
            ->shouldReceive('sendGymRequestApproved')
            ->andReturnUsing(function (...$args) use (&$sent) { $sent[] = $args; });

        (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class));
        (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class)); // retry → no-op

        $this->assertCount(1, $sent);
        [$to, , $gymName, $setupUrl, $dashboardUrl] = $sent[0];
        $this->assertSame('sara@irontemple.test', $to);
        $this->assertSame('Iron Temple', $gymName);
        $this->assertSame('https://admin.example.test/login', $dashboardUrl);
        $this->assertStringStartsWith('https://admin.example.test/set-password?token=', $setupUrl);

        $row = DB::table('password_reset_tokens')->where('email', 'sara@irontemple.test')->first();
        $token = Str::after($setupUrl, 'token=');
        $this->assertSame(hash('sha256', $token), $row->token);   // only the hash is stored
        $this->assertNotNull(GymRequest::find($req->id)->decision_email_sent_at);
    }

    public function test_setup_link_lets_owner_set_password_and_outlives_a_reset_token(): void
    {
        $req = $this->approvedRequest();
        $setupUrl = null;
        $this->mock(EmailService::class)
            ->shouldReceive('sendGymRequestApproved')
            ->andReturnUsing(function ($to, $name, $gym, $url) use (&$setupUrl) { $setupUrl = $url; });
        (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class));
        $token = Str::after($setupUrl, 'token=');

        // Still valid 3 days later (a forgot-password token dies after 1h).
        $this->travel(3)->days();
        $this->postJson('/api/auth/reset-password', [
            'token' => $token, 'password' => 'NewPass123', 'password_confirmation' => 'NewPass123',
        ])->assertOk();

        $owner = User::find($req->owner_profile_id);
        $this->assertFalse($owner->must_reset_password);
        $this->postJson('/api/auth/login', ['email' => 'sara@irontemple.test', 'password' => 'NewPass123'])
            ->assertOk();

        // Single use.
        $this->postJson('/api/auth/reset-password', [
            'token' => $token, 'password' => 'Other123x', 'password_confirmation' => 'Other123x',
        ])->assertStatus(422);
    }

    public function test_setup_link_expires(): void
    {
        $req = $this->approvedRequest();
        $setupUrl = null;
        $this->mock(EmailService::class)
            ->shouldReceive('sendGymRequestApproved')
            ->andReturnUsing(function ($to, $name, $gym, $url) use (&$setupUrl) { $setupUrl = $url; });
        (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class));

        $this->travel(SendGymRequestEmail::SETUP_LINK_DAYS + 1)->days();
        $this->postJson('/api/auth/reset-password', [
            'token' => Str::after($setupUrl, 'token='), 'password' => 'NewPass123', 'password_confirmation' => 'NewPass123',
        ])->assertStatus(422);
    }

    public function test_email_failure_keeps_gym_approved_and_is_retryable(): void
    {
        $req = $this->approvedRequest();

        $this->mock(EmailService::class)
            ->shouldReceive('sendGymRequestApproved')->once()
            ->andThrow(new \RuntimeException('Failed to send email: 503'));
        try {
            (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class));
            $this->fail('expected the job to rethrow for queue retry');
        } catch (\RuntimeException) {
        }

        $req->refresh();
        $this->assertSame('approved', $req->status);
        $this->assertTrue(DB::table('gyms')->where('id', $req->provisioned_gym_id)->value('is_active') == true);
        $this->assertNull($req->decision_email_sent_at);
        $this->assertStringContainsString('503', $req->last_email_error);
        $this->assertTrue(DB::table('gym_request_events')->where('event', 'email_failed')->exists());

        // Retry succeeds without touching provisioning.
        $this->mock(EmailService::class)->shouldReceive('sendGymRequestApproved')->once();
        (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class));

        $req->refresh();
        $this->assertNotNull($req->decision_email_sent_at);
        $this->assertNull($req->last_email_error);
        $this->assertSame(1, DB::table('gyms')->count());
        $this->assertSame(1, DB::table('profiles')->where('role', 'gym_admin')->count());
    }

    public function test_missing_dashboard_url_fails_the_email_not_the_approval(): void
    {
        $req = $this->approvedRequest();
        config(['services.admin_dashboard.url' => null]);

        $this->expectException(\RuntimeException::class);
        try {
            (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class));
        } finally {
            $this->assertSame('approved', $req->fresh()->status);
            $this->assertStringContainsString('ADMIN_DASHBOARD_URL', $req->fresh()->last_email_error);
            $this->assertSame(0, DB::table('password_reset_tokens')->count());
        }
    }

    public function test_resend_email_forces_a_fresh_send(): void
    {
        $req = $this->approvedRequest();
        $this->mock(EmailService::class)->shouldReceive('sendGymRequestApproved')->twice();
        (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class));
        $firstHash = DB::table('password_reset_tokens')->value('token');

        $this->postJson("/api/super-admin/gym-requests/{$req->id}/resend-email")
            ->assertOk()->assertJsonPath('type', 'approved');
        Queue::assertPushed(SendGymRequestEmail::class, fn ($j) => $j->type === 'approved' && $j->force);

        (new SendGymRequestEmail($req->id, 'approved', force: true))->handle(app(EmailService::class));
        $this->assertNotSame($firstHash, DB::table('password_reset_tokens')->value('token'));
    }

    public function test_decline_email_shares_reason_only_when_chosen(): void
    {
        Queue::fake();
        $shared = $this->submit(['owner_email' => 's@x.test']);
        $private = $this->submit(['owner_email' => 'p@x.test']);
        $this->actingAsSuperAdmin();
        $this->postJson("/api/super-admin/gym-requests/{$shared}/decline", ['reason' => 'Outside service area', 'share_reason' => true]);
        $this->postJson("/api/super-admin/gym-requests/{$private}/decline", ['reason' => 'Internal: suspected spam']);

        $reasons = [];
        $this->mock(EmailService::class)
            ->shouldReceive('sendGymRequestDeclined')
            ->andReturnUsing(function ($to, $name, $gym, $reason) use (&$reasons) { $reasons[$to] = $reason; });
        (new SendGymRequestEmail($shared, 'declined'))->handle(app(EmailService::class));
        (new SendGymRequestEmail($private, 'declined'))->handle(app(EmailService::class));

        $this->assertSame('Outside service area', $reasons['s@x.test']);
        $this->assertNull($reasons['p@x.test']);
    }

    public function test_stale_job_for_a_changed_status_is_skipped(): void
    {
        Queue::fake();
        $id = $this->submit();
        // An "approved" email job for a request that is still pending
        // (e.g. a stray re-dispatch) must not send anything.
        $this->mock(EmailService::class)->shouldNotReceive('sendGymRequestApproved');
        (new SendGymRequestEmail($id, 'approved'))->handle(app(EmailService::class));
        $this->assertNull(GymRequest::find($id)->decision_email_sent_at);
    }

    /* ── review fixes ───────────────────────────────────────────── */

    public function test_failed_resend_keeps_the_previous_setup_link_working(): void
    {
        $req = $this->approvedRequest();
        $url = null;
        $this->mock(EmailService::class)->shouldReceive('sendGymRequestApproved')
            ->andReturnUsing(function ($to, $name, $gym, $setupUrl) use (&$url) { $url = $setupUrl; });
        (new SendGymRequestEmail($req->id, 'approved'))->handle(app(EmailService::class));
        $firstToken = Str::after($url, 'token=');

        // Forced resend whose delivery fails.
        $this->mock(EmailService::class)->shouldReceive('sendGymRequestApproved')
            ->andThrow(new \RuntimeException('Failed to send email: 503'));
        try {
            (new SendGymRequestEmail($req->id, 'approved', force: true))->handle(app(EmailService::class));
        } catch (\RuntimeException) {
        }

        $this->postJson('/api/auth/reset-password', [
            'token' => $firstToken, 'password' => 'NewPass123', 'password_confirmation' => 'NewPass123',
        ])->assertOk();
    }

    public function test_no_setup_link_once_owner_has_set_a_password(): void
    {
        $req = $this->approvedRequest();
        DB::table('profiles')->where('id', $req->owner_profile_id)->update(['must_reset_password' => false]);

        $this->postJson("/api/super-admin/gym-requests/{$req->id}/resend-email")->assertStatus(409);
        Queue::assertNotPushed(SendGymRequestEmail::class, fn ($j) => $j->force);
        $this->getJson("/api/super-admin/gym-requests/{$req->id}")->assertJsonPath('data.owner_setup_complete', true);

        // Even a job that slips through mints nothing.
        $this->mock(EmailService::class)->shouldNotReceive('sendGymRequestApproved');
        (new SendGymRequestEmail($req->id, 'approved', force: true))->handle(app(EmailService::class));
        $this->assertSame(0, DB::table('password_reset_tokens')->count());
        $this->assertNull($req->fresh()->decision_email_sent_at);
        $this->assertTrue(DB::table('gym_request_events')->where('event', 'email_skipped')->exists());
    }

    public function test_delayed_received_email_is_dropped_after_a_decision(): void
    {
        Queue::fake();
        $id = $this->submit();
        $this->actingAsSuperAdmin();
        $this->postJson("/api/super-admin/gym-requests/{$id}/decline")->assertOk();

        $this->mock(EmailService::class)->shouldNotReceive('sendGymRequestReceived');
        (new SendGymRequestEmail($id, 'received'))->handle(app(EmailService::class));
    }

    public function test_email_job_waits_for_commit(): void
    {
        $this->assertTrue((new SendGymRequestEmail((string) Str::uuid(), 'received'))->afterCommit);
    }

    public function test_logo_is_removed_when_the_insert_fails(): void
    {
        Queue::fake();
        Storage::fake('local');
        config(['filesystems.default' => 'local']);
        GymRequest::creating(fn () => throw new \RuntimeException('insert failed'));

        $this->postJson('/api/gym-requests', $this->payload([
            'logo' => UploadedFile::fake()->image('logo.png', 50, 50),
        ]))->assertStatus(500);

        $this->assertSame([], Storage::disk('local')->allFiles('gym-requests'));
    }

    public function test_forwarded_client_ip_is_trusted_only_with_the_proxy_secret(): void
    {
        Queue::fake();
        config(['services.landing.proxy_secret' => 's3cret']);

        $trusted = $this->withHeaders(['X-CLBY-Proxy-Secret' => 's3cret', 'X-CLBY-Client-IP' => '203.0.113.7'])
            ->postJson('/api/gym-requests', $this->payload(['owner_email' => 't@x.test']))->json('data.id');
        $spoofed = $this->withHeaders(['X-CLBY-Proxy-Secret' => 'wrong', 'X-CLBY-Client-IP' => '198.51.100.9'])
            ->postJson('/api/gym-requests', $this->payload(['owner_email' => 's@x.test']))->json('data.id');

        $this->assertSame('203.0.113.7', DB::table('gym_requests')->where('id', $trusted)->value('submitted_ip'));
        $this->assertNotSame('198.51.100.9', DB::table('gym_requests')->where('id', $spoofed)->value('submitted_ip'));
    }

    /* ── logo + edit + conflicts ────────────────────────────────── */

    public function test_logo_is_required_on_submit(): void
    {
        $this->postJson('/api/gym-requests', $this->payload(['logo' => null]))
            ->assertStatus(422)->assertJsonValidationErrors(['logo']);
        $this->assertSame(0, GymRequest::count());
    }

    public function test_owner_phone_already_on_an_account_is_rejected_at_submit(): void
    {
        $this->user('member')->forceFill(['phone' => '01098765432'])->save();

        $this->postJson('/api/gym-requests', $this->payload())
            ->assertStatus(422)->assertJsonValidationErrors(['owner_phone']);
    }

    public function test_phone_conflict_at_approval_is_readable_and_fixable_by_editing(): void
    {
        Queue::fake();
        $id = $this->submit();
        // Phone taken after submission.
        $this->user('member')->forceFill(['phone' => '01098765432'])->save();
        $admin = $this->actingAsSuperAdmin();

        $res = $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertStatus(422);
        $this->assertStringContainsString('mobile number already exists', $res->json('message'));
        $this->assertStringNotContainsString('SQLSTATE', GymRequest::find($id)->last_provisioning_error);

        // Editing to another taken number is refused…
        $this->user('member')->forceFill(['phone' => '01222222222'])->save();
        $this->patchJson("/api/super-admin/gym-requests/{$id}", ['owner_phone' => '01222222222'])
            ->assertStatus(422)->assertJsonValidationErrors(['owner_phone']);
        // …a free one is saved and audited, and approval then succeeds.
        $this->patchJson("/api/super-admin/gym-requests/{$id}", ['owner_phone' => '01111111111', 'gym_name' => 'Iron Temple 2'])
            ->assertOk()->assertJsonPath('data.owner_phone', '01111111111');
        $event = DB::table('gym_request_events')->where('event', 'edited')->first();
        $this->assertSame($admin->id, $event->actor_id);
        $this->assertSame('01098765432', json_decode($event->details, true)['changes']['owner_phone']['from']);

        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertOk();
        $this->assertSame('Iron Temple 2', DB::table('gyms')->value('name'));
        $this->assertSame('01111111111', DB::table('profiles')->where('role', 'gym_admin')->value('phone'));
    }

    public function test_unexpected_unique_violation_message_has_no_sql(): void
    {
        Queue::fake();
        $id = $this->submit();
        $this->actingAsSuperAdmin();
        // Collide inside provisioning with something the pre-checks don't cover.
        DB::statement('CREATE UNIQUE INDEX branches_name_unique ON branches (name)');
        DB::table('branches')->insert(['id' => (string) Str::uuid(), 'gym_id' => (string) Str::uuid(), 'name' => 'Main Branch']);

        $res = $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertStatus(500);
        $this->assertStringNotContainsString('SQLSTATE', $res->json('message'));
        $this->assertStringContainsString('already exists', $res->json('message'));
        $this->assertSame(0, DB::table('gyms')->count());
    }

    public function test_edit_only_for_pending_and_super_admin(): void
    {
        Queue::fake();
        $id = $this->submit();

        Sanctum::actingAs($this->user('gym_admin', (string) Str::uuid()));
        $this->patchJson("/api/super-admin/gym-requests/{$id}", ['gym_name' => 'Hijack'])->assertForbidden();

        $this->actingAsSuperAdmin();
        $this->patchJson("/api/super-admin/gym-requests/{$id}", ['gym_name' => ''])->assertStatus(422);
        $this->patchJson("/api/super-admin/gym-requests/{$id}", ['status' => 'approved'])->assertOk();
        $this->assertSame('pending', GymRequest::find($id)->status);

        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertOk();
        $this->patchJson("/api/super-admin/gym-requests/{$id}", ['gym_name' => 'Late edit'])->assertStatus(409);
        $this->postJson("/api/super-admin/gym-requests/{$id}/logo", ['logo' => UploadedFile::fake()->image('x.png')])->assertStatus(409);
    }

    public function test_logo_can_be_replaced_and_is_required_to_approve(): void
    {
        Queue::fake();
        $id = $this->submit();
        DB::table('gym_requests')->where('id', $id)->update(['logo_url' => null]); // legacy request without logo
        $this->actingAsSuperAdmin();

        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'no gym logo'));

        $this->postJson("/api/super-admin/gym-requests/{$id}/logo", ['logo' => UploadedFile::fake()->image('new.png', 80, 80)])
            ->assertOk();
        $url = GymRequest::find($id)->logo_url;
        $this->assertNotNull($url);

        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertOk();
        $this->assertSame($url, DB::table('gyms')->value('logo_url'));
    }

    /* ── existing create-gym path still works ───────────────────── */

    public function test_super_admin_can_deactivate_and_reactivate_a_gym(): void
    {
        Queue::fake();
        $id = $this->submit();
        $this->actingAsSuperAdmin();
        $this->postJson("/api/super-admin/gym-requests/{$id}/approve")->assertOk();
        $gymId = GymRequest::find($id)->provisioned_gym_id;

        $this->postJson("/api/super-admin/gyms/{$gymId}/toggle-active")->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertFalse((bool) DB::table('gyms')->where('id', $gymId)->value('is_active'));
        $this->getJson('/api/gyms')->assertJsonCount(0, 'data');

        $this->postJson("/api/super-admin/gyms/{$gymId}/toggle-active")->assertOk()->assertJsonPath('data.is_active', true);
        $this->getJson('/api/gyms')->assertJsonCount(1, 'data');
    }

    public function test_super_admin_create_gym_uses_shared_provisioning(): void
    {
        $this->actingAsSuperAdmin();
        $this->postJson('/api/super-admin/gyms', [
            'name' => 'Manual Gym',
            'admin_email' => 'manual@x.test',
            'admin_password' => 'secret12',
            'admin_name' => 'Manual Admin',
            'city' => 'Giza',
        ])->assertCreated()->assertJsonPath('data.name', 'Manual Gym');

        $owner = DB::table('profiles')->where('email', 'manual@x.test')->first();
        $this->assertSame('gym_admin', $owner->role);
        $this->assertFalse((bool) $owner->must_reset_password);
        $this->assertSame(1, DB::table('studios')->where('gym_id', $owner->gym_id)->count());
    }
}
