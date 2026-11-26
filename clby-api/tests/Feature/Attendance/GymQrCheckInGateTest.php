<?php

namespace Tests\Feature\Attendance;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * POST /attendance/qr server-side gate (security fix 2026-11-26).
 *
 * Only the DENY paths are exercised: they return before the Postgres-only
 * log_gym_attendance_by_token function runs, which sqlite can't host. The
 * allowed path was verified end-to-end against Postgres.
 */
class GymQrCheckInGateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        if (Schema::hasTable('branches')) return;

        Schema::create('gyms', function ($t) { $t->uuid('id')->primary(); $t->string('name'); $t->timestampsTz(); });
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
        Schema::create('branches', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name');
            $t->boolean('is_active')->default(true); $t->uuid('qr_token')->nullable();
        });
        Schema::create('membership_plans', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('plan_type');
        });
        Schema::create('member_memberships', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('gym_member_id'); $t->uuid('plan_id')->nullable();
            $t->string('status')->default('active'); $t->string('payment_status')->default('paid');
            $t->string('source_type')->default('subscription'); $t->string('freeze_status')->nullable();
            $t->text('allowed_branch_ids')->nullable();
        });
        Schema::create('attendance_logs', function ($t) { $t->uuid('id')->primary(); $t->uuid('gym_member_id'); $t->uuid('gym_id'); });
        Schema::create('staff_activity_logs', function ($t) {
            $t->uuid('id')->nullable(); $t->uuid('gym_id')->nullable(); $t->uuid('staff_id')->nullable();
            $t->string('staff_name')->nullable(); $t->string('action')->nullable(); $t->string('action_type')->nullable();
            $t->string('module')->nullable(); $t->text('description')->nullable(); $t->string('entity')->nullable();
            $t->string('entity_id')->nullable(); $t->text('details')->nullable(); $t->string('ip_address')->nullable();
            $t->timestampTz('created_at')->nullable();
        });
    }

    private function gym(): array
    {
        $gym = (string) Str::uuid();
        DB::table('gyms')->insert(['id' => $gym, 'name' => 'G', 'created_at' => now(), 'updated_at' => now()]);
        $branch = (string) Str::uuid();
        $token = (string) Str::uuid();
        DB::table('branches')->insert(['id' => $branch, 'gym_id' => $gym, 'name' => 'Main', 'qr_token' => $token]);
        return [$gym, $branch, $token];
    }

    private function member(string $gym, ?string $planType = 'duration', array $extra = []): array
    {
        $user = User::forceCreate([
            'id' => (string) Str::uuid(), 'email' => Str::random(8) . '@t.com', 'role' => 'member',
            'gym_id' => $gym, 'is_active' => true, 'email_verified' => true,
        ]);
        $mid = (string) Str::uuid();
        DB::table('gym_members')->insert(['id' => $mid, 'gym_id' => $gym, 'user_id' => $user->id]);
        if ($planType) {
            $plan = (string) Str::uuid();
            DB::table('membership_plans')->insert(['id' => $plan, 'gym_id' => $gym, 'plan_type' => $planType]);
            DB::table('member_memberships')->insert($extra + [
                'id' => (string) Str::uuid(), 'gym_id' => $gym, 'gym_member_id' => $mid, 'plan_id' => $plan,
            ]);
        }
        return [$user, $mid];
    }

    private function scan(User $user, string $memberId, string $token)
    {
        Sanctum::actingAs($user);
        return $this->postJson('/api/attendance/qr', ['gym_member_id' => $memberId, 'token' => $token]);
    }

    public function test_member_cannot_check_in_with_another_gyms_qr(): void
    {
        [$gymA] = $this->gym();
        [, , $tokenB] = $this->gym();
        [$user, $mid] = $this->member($gymA);

        $this->scan($user, $mid, $tokenB)
            ->assertOk()
            ->assertJsonPath('data.status', 'denied')
            ->assertJsonPath('data.reason', 'not_a_member');
        $this->assertSame(0, DB::table('attendance_logs')->count());
    }

    public function test_frozen_membership_is_denied(): void
    {
        [$gym, , $token] = $this->gym();
        [$user, $mid] = $this->member($gym, 'duration', ['freeze_status' => 'frozen']);
        $this->scan($user, $mid, $token)->assertJsonPath('data.reason', 'membership_frozen');
    }

    public function test_sessions_only_plan_has_no_gym_access(): void
    {
        [$gym, , $token] = $this->gym();
        [$user, $mid] = $this->member($gym, 'sessions');
        $this->scan($user, $mid, $token)->assertJsonPath('data.reason', 'gym_access_not_included');
    }

    public function test_branch_outside_plan_is_denied(): void
    {
        [$gym, , $token] = $this->gym();
        [$user, $mid] = $this->member($gym, 'duration', ['allowed_branch_ids' => '{' . Str::uuid() . '}']);
        $this->scan($user, $mid, $token)->assertJsonPath('data.reason', 'branch_not_included');
    }

    public function test_transferred_only_member_is_studio_only(): void
    {
        [$gym, , $token] = $this->gym();
        [$user, $mid] = $this->member($gym, 'sessions', ['source_type' => 'transfer']);
        $this->scan($user, $mid, $token)->assertJsonPath('data.reason', 'gym_access_not_included');
    }

    public function test_member_cannot_check_in_someone_else(): void
    {
        [$gym, , $token] = $this->gym();
        [$caller] = $this->member($gym, 'duration', ['freeze_status' => 'frozen']);
        [, $otherMid] = $this->member($gym); // valid plan
        // Member ids are forced to self, so asking for the (valid) other
        // member is evaluated as the frozen caller.
        $this->scan($caller, $otherMid, $token)->assertJsonPath('data.reason', 'membership_frozen');
        $this->assertSame(0, DB::table('attendance_logs')->count());
    }
}
