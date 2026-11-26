<?php

namespace Tests\Feature\Attendance;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Base for attendance / offline-sync feature tests.
 *
 * The core schema is legacy Supabase (no Laravel create-migrations), so
 * the minimal tables are hand-built on sqlite here and the real
 * offline-attendance migrations are run on top — doubling as a
 * portability check for them. Postgres-only SQL (plpgsql functions,
 * advisory locks, partial indexes) is not exercised here.
 */
abstract class AttendanceTestCase extends TestCase
{
    protected const OFFLINE_MIGRATIONS = [
        '2026_11_26_200000_create_attendance_devices_table.php',
        '2026_11_26_200100_create_attendance_events_table.php',
        '2026_11_26_200200_add_offline_columns_to_attendance_logs.php',
        '2026_11_26_200300_add_offline_columns_to_service_session_logs.php',
        '2026_11_26_200400_attendance_devices_per_user.php',
        '2026_11_26_200500_create_attendance_event_conflicts_table.php',
        '2026_11_27_100000_create_gym_signing_keys_table.php',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    private function buildSchema(): void
    {
        if (Schema::hasTable('profiles')) {
            return;
        }

        Schema::create('gyms', function ($t) {
            $t->uuid('id')->primary(); $t->string('name'); $t->string('timezone')->default('UTC'); $t->timestampsTz();
        });
        Schema::create('branches', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name');
            $t->boolean('is_active')->default(true); $t->uuid('qr_token')->nullable(); $t->timestampTz('created_at')->nullable();
        });
        Schema::create('profiles', function ($t) {
            $t->uuid('id')->primary(); $t->string('email'); $t->string('password')->nullable();
            $t->string('full_name')->nullable(); $t->string('phone')->nullable(); $t->string('photo_url')->nullable();
            $t->string('role')->default('member'); $t->uuid('gym_id')->nullable();
            $t->boolean('is_active')->default(true); $t->boolean('email_verified')->default(true);
            $t->boolean('must_reset_password')->default(false);
            $t->timestampTz('deleted_at')->nullable(); $t->timestampsTz();
        });
        Schema::create('staff_members', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('user_id')->nullable();
            $t->string('status')->default('active'); $t->timestampTz('deleted_at')->nullable();
        });
        Schema::create('staff_roles', function ($t) { $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name'); });
        Schema::create('staff_member_roles', function ($t) { $t->uuid('staff_id'); $t->uuid('role_id'); });
        Schema::create('staff_role_permissions', function ($t) { $t->uuid('role_id'); $t->string('module'); $t->string('action')->default('view'); });
        Schema::create('staff_activity_logs', function ($t) {
            $t->uuid('id')->nullable(); $t->uuid('gym_id')->nullable(); $t->uuid('staff_id')->nullable();
            $t->string('staff_name')->nullable(); $t->string('action')->nullable(); $t->string('action_type')->nullable();
            $t->string('module')->nullable(); $t->text('description')->nullable(); $t->string('entity')->nullable();
            $t->string('entity_id')->nullable(); $t->text('details')->nullable(); $t->string('ip_address')->nullable();
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('gym_members', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('user_id')->nullable();
            $t->integer('member_number')->nullable(); $t->string('status')->default('active');
            $t->timestampTz('joined_at')->nullable(); $t->timestampTz('deleted_at')->nullable();
        });
        Schema::create('membership_plans', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name')->default('Plan');
            $t->string('plan_type'); $t->integer('session_count')->nullable();
        });
        Schema::create('member_memberships', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id')->nullable(); $t->uuid('gym_member_id'); $t->uuid('plan_id')->nullable();
            $t->string('status')->default('active'); $t->string('payment_status')->default('paid');
            $t->timestampTz('start_date')->nullable(); $t->timestampTz('end_date')->nullable();
            $t->integer('sessions_total')->nullable(); $t->integer('sessions_used')->default(0); $t->integer('sessions_remaining')->nullable();
            $t->string('source_type')->default('subscription'); $t->string('freeze_status')->nullable();
            $t->text('allowed_branch_ids')->nullable();
            $t->timestampsTz();
        });
        Schema::create('classes', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('trainer_id')->nullable(); $t->string('name');
        });
        Schema::create('studios', function ($t) { $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->string('name'); });
        Schema::create('class_sessions', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('class_id'); $t->uuid('branch_id')->nullable();
            $t->uuid('studio_id')->nullable(); $t->date('session_date'); $t->time('start_time'); $t->time('end_time');
            $t->string('status')->default('scheduled');
        });
        Schema::create('attendance_logs', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('gym_member_id');
            $t->timestampTz('check_in_at'); $t->string('method')->nullable(); $t->string('access_point')->nullable();
            $t->uuid('class_session_id')->nullable(); $t->uuid('studio_id')->nullable(); $t->uuid('branch_id')->nullable();
            $t->string('specialist_name')->nullable(); $t->timestampTz('check_out_at')->nullable();
            $t->timestampsTz();
        });
        Schema::create('trainer_profiles', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('profile_id')->nullable(); $t->uuid('gym_id'); $t->string('name')->nullable();
            $t->string('trainer_type')->nullable(); $t->string('photo_url')->nullable(); $t->boolean('is_active')->default(true);
        });
        Schema::create('member_service_assignments', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('gym_member_id'); $t->uuid('service_package_id')->nullable();
            $t->uuid('trainer_id')->nullable(); $t->string('package_name')->default('PT 10'); $t->string('service_type')->default('personal_training');
            $t->integer('sessions_total'); $t->integer('sessions_used')->default(0); $t->string('status')->default('active');
            $t->timestampTz('assigned_at')->nullable(); $t->timestampTz('expires_at')->nullable(); $t->timestampTz('created_at')->nullable();
        });
        Schema::create('service_session_logs', function ($t) {
            $t->uuid('id')->primary(); $t->uuid('gym_id'); $t->uuid('assignment_id'); $t->uuid('trainer_id');
            $t->uuid('gym_member_id'); $t->timestampTz('delivered_at'); $t->text('note')->nullable(); $t->timestampsTz();
        });

        foreach (self::OFFLINE_MIGRATIONS as $file) {
            $path = base_path('database/migrations/' . $file);
            if (is_file($path)) {
                (require $path)->up();
            }
        }
    }

    /* ── factories ───────────────────────────────────────────────── */

    protected function makeGym(string $tz = 'UTC'): string
    {
        $id = (string) Str::uuid();
        DB::table('gyms')->insert(['id' => $id, 'name' => 'Gym ' . substr($id, 0, 4), 'timezone' => $tz, 'created_at' => now(), 'updated_at' => now()]);
        return $id;
    }

    /** @return array{0:string,1:string} [branchId, qrToken] */
    protected function makeBranch(string $gymId, string $name = 'Main', bool $active = true): array
    {
        $id = (string) Str::uuid();
        $token = (string) Str::uuid();
        DB::table('branches')->insert(['id' => $id, 'gym_id' => $gymId, 'name' => $name, 'is_active' => $active, 'qr_token' => $token, 'created_at' => now()]);
        return [$id, $token];
    }

    protected function makeUser(string $gymId, string $role, string $name = 'User'): User
    {
        return User::forceCreate([
            'id' => (string) Str::uuid(), 'email' => Str::random(10) . '@t.com', 'full_name' => $name,
            'role' => $role, 'gym_id' => $gymId, 'is_active' => true, 'email_verified' => true,
            'phone' => '+201001234567',
        ]);
    }

    protected function makeAdmin(string $gymId): User
    {
        return $this->makeUser($gymId, 'gym_admin', 'Admin');
    }

    /** Staff (or trainer) with the given modules. */
    protected function makeStaff(string $gymId, array $modules = ['attendance'], string $role = 'staff'): User
    {
        $user = $this->makeUser($gymId, $role, 'Staff ' . $role);
        $staffId = (string) Str::uuid();
        DB::table('staff_members')->insert(['id' => $staffId, 'gym_id' => $gymId, 'user_id' => $user->id, 'status' => 'active']);
        $roleId = (string) Str::uuid();
        DB::table('staff_roles')->insert(['id' => $roleId, 'gym_id' => $gymId, 'name' => 'Desk']);
        DB::table('staff_member_roles')->insert(['staff_id' => $staffId, 'role_id' => $roleId]);
        foreach ($modules as $m) {
            DB::table('staff_role_permissions')->insert(['role_id' => $roleId, 'module' => $m]);
        }
        return $user;
    }

    /** @return array{0:User,1:string} [user, gymMemberId] */
    protected function makeMember(string $gymId, string $name = 'Member'): array
    {
        $user = $this->makeUser($gymId, 'member', $name);
        $mid = (string) Str::uuid();
        static $n = 100;
        DB::table('gym_members')->insert(['id' => $mid, 'gym_id' => $gymId, 'user_id' => $user->id, 'member_number' => ++$n, 'status' => 'active']);
        return [$user, $mid];
    }

    protected function makeMembership(string $gymId, string $memberId, string $planType = 'duration', array $extra = []): string
    {
        $plan = (string) Str::uuid();
        DB::table('membership_plans')->insert(['id' => $plan, 'gym_id' => $gymId, 'name' => ucfirst($planType) . ' plan', 'plan_type' => $planType]);
        $id = (string) Str::uuid();
        DB::table('member_memberships')->insert($extra + [
            'id' => $id, 'gym_id' => $gymId, 'gym_member_id' => $memberId, 'plan_id' => $plan,
            'status' => 'active', 'payment_status' => 'paid',
            'start_date' => Carbon::now()->subDays(10), 'end_date' => Carbon::now()->addDays(20),
            'source_type' => 'subscription',
            'created_at' => Carbon::now()->subDays(10), 'updated_at' => Carbon::now()->subDays(10),
        ]);
        return $id;
    }

    protected function makeClassSession(string $gymId, ?string $branchId = null, ?string $studioId = null, string $name = 'Yoga'): string
    {
        $class = (string) Str::uuid();
        DB::table('classes')->insert(['id' => $class, 'gym_id' => $gymId, 'name' => $name]);
        $id = (string) Str::uuid();
        DB::table('class_sessions')->insert([
            'id' => $id, 'gym_id' => $gymId, 'class_id' => $class, 'branch_id' => $branchId, 'studio_id' => $studioId,
            'session_date' => Carbon::now()->toDateString(), 'start_time' => '10:00:00', 'end_time' => '11:00:00',
        ]);
        return $id;
    }

    protected function makeStudio(string $gymId): string
    {
        $id = (string) Str::uuid();
        DB::table('studios')->insert(['id' => $id, 'gym_id' => $gymId, 'name' => 'Studio A']);
        return $id;
    }

    /** @return array{0:User,1:string} [user, trainerProfileId] */
    protected function makeCoach(string $gymId, array $modules = []): array
    {
        $user = $modules ? $this->makeStaff($gymId, $modules, 'trainer') : $this->makeUser($gymId, 'trainer', 'Coach');
        $tp = (string) Str::uuid();
        DB::table('trainer_profiles')->insert(['id' => $tp, 'profile_id' => $user->id, 'gym_id' => $gymId, 'name' => 'Coach C', 'trainer_type' => 'personal_trainer', 'is_active' => true]);
        return [$user, $tp];
    }

    protected function makeAssignment(string $gymId, string $memberId, ?string $trainerId, array $extra = []): string
    {
        $id = (string) Str::uuid();
        DB::table('member_service_assignments')->insert($extra + [
            'id' => $id, 'gym_id' => $gymId, 'gym_member_id' => $memberId, 'trainer_id' => $trainerId,
            'sessions_total' => 10, 'sessions_used' => 0, 'status' => 'active',
            'assigned_at' => Carbon::now()->subDays(5), 'created_at' => Carbon::now()->subDays(5),
        ]);
        return $id;
    }

    protected function actingAsUser(User $user): static
    {
        Sanctum::actingAs($user);
        return $this;
    }
}
