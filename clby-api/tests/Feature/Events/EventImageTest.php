<?php

namespace Tests\Feature\Events;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Event cover images: POST /admin/events/image (permission, gym scope,
 * validation) and image_url round-tripping through the admin + member
 * event payloads.
 */
class EventImageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['filesystems.default' => 'local']);
        if (Schema::hasTable('events')) return;

        Schema::create('profiles', function ($t) {
            $t->uuid('id')->primary(); $t->string('email'); $t->string('full_name')->nullable();
            $t->string('role')->default('member'); $t->uuid('gym_id')->nullable();
            $t->boolean('is_active')->default(true); $t->boolean('email_verified')->default(false);
            $t->timestampsTz();
        });
        Schema::create('gym_members', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('user_id')->nullable();
            $t->timestampTz('deleted_at')->nullable();
        });
        Schema::create('staff_members', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('user_id')->nullable();
            $t->string('status')->default('active'); $t->timestampTz('deleted_at')->nullable();
        });
        Schema::create('staff_roles', function ($t) { $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name'); });
        Schema::create('staff_member_roles', function ($t) { $t->uuid('staff_id'); $t->uuid('role_id'); });
        Schema::create('staff_role_permissions', function ($t) {
            $t->uuid('role_id'); $t->string('module'); $t->string('action')->default('view');
        });
        Schema::create('staff_activity_logs', function ($t) {
            $t->uuid('id')->nullable(); $t->uuid('gym_id')->nullable(); $t->uuid('staff_id')->nullable();
            $t->string('staff_name')->nullable(); $t->string('action')->nullable(); $t->string('action_type')->nullable();
            $t->string('module')->nullable(); $t->text('description')->nullable(); $t->string('entity')->nullable();
            $t->string('entity_id')->nullable(); $t->text('details')->nullable(); $t->string('ip_address')->nullable();
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('membership_plans', function ($t) { $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name')->nullable(); });
        Schema::create('member_memberships', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_member_id'); $t->uuid('plan_id')->nullable();
            $t->string('status')->default('active');
        });
        Schema::create('events', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('title');
            $t->text('description')->nullable(); $t->string('location')->nullable();
            $t->string('image_url', 1024)->nullable();
            $t->timestampTz('starts_at'); $t->timestampTz('ends_at')->nullable();
            $t->timestampTz('registration_deadline')->nullable();
            $t->integer('capacity')->nullable(); $t->boolean('is_paid')->default(false);
            $t->integer('price_cents')->nullable(); $t->string('currency', 5)->default('EGP');
            $t->boolean('is_published')->default(false); $t->string('configuration_label', 100)->nullable();
            $t->uuid('created_by')->nullable(); $t->timestampsTz();
        });
        Schema::create('event_configurations', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('event_id'); $t->string('name');
            $t->integer('sort_order')->default(0); $t->timestampsTz();
        });
        Schema::create('event_plan_targets', function ($t) { $t->uuid('event_id'); $t->uuid('plan_id'); });
        Schema::create('event_registrations', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('event_id'); $t->uuid('gym_member_id');
            $t->uuid('registered_by')->nullable(); $t->string('status', 16)->default('confirmed');
            $t->string('payment_status', 12)->default('na'); $t->boolean('attended')->default(false);
            $t->uuid('event_configuration_id')->nullable(); $t->string('configuration_name')->nullable();
            $t->timestampsTz();
        });
    }

    private function user(string $role, string $gymId, array $modules = []): User
    {
        $user = User::forceCreate([
            'id' => (string) Str::uuid(), 'email' => Str::random(8) . '@t.com', 'role' => $role,
            'gym_id' => $gymId, 'is_active' => true, 'email_verified' => true,
        ]);
        if ($role === 'staff') {
            $staffId = (string) Str::uuid();
            DB::table('staff_members')->insert(['id' => $staffId, 'gym_id' => $gymId, 'user_id' => $user->id]);
            $roleId = (string) Str::uuid();
            DB::table('staff_roles')->insert(['id' => $roleId, 'gym_id' => $gymId, 'name' => 'Desk']);
            DB::table('staff_member_roles')->insert(['staff_id' => $staffId, 'role_id' => $roleId]);
            foreach ($modules as $m) {
                DB::table('staff_role_permissions')->insert(['role_id' => $roleId, 'module' => $m]);
            }
        }
        if ($role === 'member') {
            DB::table('gym_members')->insert(['id' => (string) Str::uuid(), 'gym_id' => $gymId, 'user_id' => $user->id]);
        }
        return $user;
    }

    private function event(string $gymId, array $attrs = []): string
    {
        $id = (string) Str::uuid();
        DB::table('events')->insert($attrs + [
            'id' => $id, 'gym_id' => $gymId, 'title' => 'Open mat',
            'starts_at' => now()->addDays(3), 'is_published' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return $id;
    }

    private function upload(?UploadedFile $file = null)
    {
        return $this->post('/api/admin/events/image', ['file' => $file ?? UploadedFile::fake()->image('cover.jpg', 1200, 675)], ['Accept' => 'application/json']);
    }

    // ── Upload endpoint ───────────────────────────────────────────────────────

    public function test_gym_admin_uploads_into_their_gym_folder(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('gym_admin', $gym));

        $res = $this->upload()->assertOk();
        $url = $res->json('url');
        $this->assertStringContainsString("/storage/{$gym}/events/", $url);

        $files = Storage::disk('local')->allFiles("{$gym}/events");
        $this->assertCount(1, $files);
    }

    public function test_staff_with_events_permission_can_upload(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('staff', $gym, ['events']));
        $this->upload()->assertOk()->assertJsonStructure(['url']);
    }

    public function test_staff_without_events_permission_is_forbidden(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('staff', $gym, ['store']));
        $this->upload()->assertForbidden();
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_member_cannot_upload(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('member', $gym));
        $this->upload()->assertForbidden();
    }

    public function test_guest_cannot_upload(): void
    {
        $this->upload()->assertUnauthorized();
    }

    public function test_rejects_non_images(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('gym_admin', $gym));

        $this->upload(UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf'))
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $svg = UploadedFile::fake()->createWithContent('x.svg',
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $this->upload($svg)->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->post('/api/admin/events/image', [], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_rejects_images_over_5mb(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('gym_admin', $gym));
        $this->upload(UploadedFile::fake()->image('big.jpg')->size(6000))
            ->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    public function test_accepts_png_webp_and_gif(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('gym_admin', $gym));
        $this->upload(UploadedFile::fake()->image('a.png'))->assertOk();
        $this->upload(UploadedFile::fake()->image('a.webp'))->assertOk();
        $this->upload(UploadedFile::fake()->image('a.gif'))->assertOk();
    }

    // ── image_url on the event ────────────────────────────────────────────────

    public function test_admin_sets_replaces_and_clears_the_image(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('gym_admin', $gym));
        $id = $this->event($gym);

        $this->putJson("/api/admin/events/{$id}", ['image_url' => 'https://cdn.example.com/a.jpg'])->assertOk();
        $this->getJson('/api/admin/events')->assertOk()
            ->assertJsonPath('data.0.image_url', 'https://cdn.example.com/a.jpg');

        $this->putJson("/api/admin/events/{$id}", ['image_url' => 'https://cdn.example.com/b.jpg'])->assertOk();
        $this->assertSame('https://cdn.example.com/b.jpg', DB::table('events')->where('id', $id)->value('image_url'));

        $this->putJson("/api/admin/events/{$id}", ['image_url' => null])->assertOk();
        $this->assertNull(DB::table('events')->where('id', $id)->value('image_url'));
    }

    public function test_image_url_must_be_http_url(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('gym_admin', $gym));
        $id = $this->event($gym);

        $this->putJson("/api/admin/events/{$id}", ['image_url' => 'javascript:alert(1)'])
            ->assertUnprocessable()->assertJsonValidationErrors('image_url');
        $this->postJson('/api/admin/events', [
            'title' => 'X', 'starts_at' => now()->addDay()->toIso8601String(), 'image_url' => 'not a url',
        ])->assertUnprocessable()->assertJsonValidationErrors('image_url');
    }

    public function test_create_stores_image_url(): void
    {
        $gym = (string) Str::uuid();
        Sanctum::actingAs($this->user('gym_admin', $gym));
        $res = $this->postJson('/api/admin/events', [
            'title' => 'Seminar', 'starts_at' => now()->addDay()->toIso8601String(),
            'image_url' => 'https://cdn.example.com/s.jpg',
        ])->assertCreated();
        $this->assertSame('https://cdn.example.com/s.jpg',
            DB::table('events')->where('id', $res->json('data.id'))->value('image_url'));
    }

    public function test_cannot_set_image_on_another_gyms_event(): void
    {
        $gymA = (string) Str::uuid();
        $gymB = (string) Str::uuid();
        $foreign = $this->event($gymB, ['image_url' => 'https://cdn.example.com/b.jpg']);
        Sanctum::actingAs($this->user('gym_admin', $gymA));

        $this->putJson("/api/admin/events/{$foreign}", ['image_url' => 'https://evil.example.com/x.jpg'])
            ->assertNotFound();
        $this->assertSame('https://cdn.example.com/b.jpg', DB::table('events')->where('id', $foreign)->value('image_url'));
        $this->getJson('/api/admin/events')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_member_feed_includes_image_url(): void
    {
        $gym = (string) Str::uuid();
        $this->event($gym, ['image_url' => 'https://cdn.example.com/m.jpg', 'title' => 'With image']);
        $this->event($gym, ['title' => 'Without image', 'starts_at' => now()->addDays(5)]);
        Sanctum::actingAs($this->user('member', $gym));

        $res = $this->getJson('/api/events')->assertOk()->assertJsonCount(2, 'data');
        $this->assertSame('https://cdn.example.com/m.jpg', $res->json('data.0.image_url'));
        $this->assertArrayHasKey('image_url', $res->json('data.1'));
        $this->assertNull($res->json('data.1.image_url'));
    }
}
