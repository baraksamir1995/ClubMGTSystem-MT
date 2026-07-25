<?php

namespace Tests\Feature\Sales;

use App\Models\Sales\SalesLead;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Base for sales-module feature tests.
 *
 * The core schema is legacy Supabase (no Laravel migrations), so
 * RefreshDatabase can't rebuild it on the sqlite test connection.
 * Instead we create the minimal supporting tables by hand and run the
 * real sales migration on top — which doubles as a portability check
 * for the migration itself.
 */
abstract class SalesTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    private function buildSchema(): void
    {
        if (Schema::hasTable('profiles')) {
            return; // connection reused within a test
        }

        Schema::create('gyms', function ($t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('timezone')->nullable();
            $t->timestampsTz();
        });
        Schema::create('branches', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->string('name');
            $t->boolean('is_active')->default(true);
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('profiles', function ($t) {
            $t->uuid('id')->primary();
            $t->string('email');
            $t->string('password')->nullable();
            $t->string('full_name')->nullable();
            $t->string('role')->default('member');
            $t->uuid('gym_id')->nullable();
            $t->boolean('is_active')->default(true);
            $t->boolean('must_reset_password')->default(false);
            $t->timestampsTz();
        });
        Schema::create('staff_members', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->uuid('user_id')->nullable();
            $t->string('full_name');
            $t->string('email');
            $t->boolean('is_active')->default(true);
            $t->string('status')->default('active');
            $t->timestampTz('deleted_at')->nullable();
            $t->timestampsTz();
        });
        Schema::create('staff_roles', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->string('name');
        });
        Schema::create('staff_member_roles', function ($t) {
            $t->uuid('staff_id');
            $t->uuid('role_id');
        });
        Schema::create('staff_role_permissions', function ($t) {
            $t->uuid('role_id');
            $t->string('module');
            $t->string('action')->default('view');
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
            $t->string('ip_address')->nullable();
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('membership_plans', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->string('name');
            $t->decimal('price', 10, 2)->default(0);
        });
        Schema::create('gym_members', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id');
            $t->uuid('user_id')->nullable();
        });

        // The real sales migration (portability-checked here).
        $migration = require base_path('database/migrations/2026_07_15_100000_create_sales_pipeline_tables.php');
        $migration->up();
    }

    /* ── factories ───────────────────────────────────────────────── */

    protected function makeGym(): string
    {
        $id = (string) Str::uuid();
        DB::table('gyms')->insert(['id' => $id, 'name' => 'Test Gym ' . substr($id, 0, 4), 'created_at' => now(), 'updated_at' => now()]);
        return $id;
    }

    protected function makeBranch(string $gymId, string $name = 'Main'): string
    {
        $id = (string) Str::uuid();
        DB::table('branches')->insert(['id' => $id, 'gym_id' => $gymId, 'name' => $name, 'is_active' => true, 'created_at' => now()]);
        return $id;
    }

    protected function makeAdmin(string $gymId): User
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

    /**
     * Staff member holding the `sales` module. $salesRole null = rep by
     * default; 'manager' elevates. Returns the auth user (profile).
     */
    protected function makeSalesStaff(string $gymId, ?string $branchId = null, ?string $salesRole = null, ?array $managerBranchIds = null): User
    {
        $user = User::forceCreate([
            'id' => (string) Str::uuid(),
            'email' => Str::random(8) . '@test.com',
            'full_name' => 'Sales ' . ($salesRole ?? 'rep'),
            'role' => 'staff',
            'gym_id' => $gymId,
            'is_active' => true,
        ]);

        $staffId = (string) Str::uuid();
        DB::table('staff_members')->insert([
            'id' => $staffId, 'gym_id' => $gymId, 'user_id' => $user->id,
            'full_name' => $user->full_name, 'email' => $user->email,
            'is_active' => true, 'status' => 'active',
            'sales_role' => $salesRole, 'branch_id' => $branchId,
            'manager_branch_ids' => $managerBranchIds ? json_encode($managerBranchIds) : null,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $roleId = (string) Str::uuid();
        DB::table('staff_roles')->insert(['id' => $roleId, 'gym_id' => $gymId, 'name' => 'Sales']);
        DB::table('staff_member_roles')->insert(['staff_id' => $staffId, 'role_id' => $roleId]);
        DB::table('staff_role_permissions')->insert(['role_id' => $roleId, 'module' => 'sales', 'action' => 'view']);

        return $user;
    }

    protected function makeLead(string $gymId, array $attrs = []): SalesLead
    {
        static $n = 0;
        $n++;
        return SalesLead::create([
            'gym_id' => $gymId,
            'name' => 'Lead ' . $n,
            'phone' => '+2010' . str_pad((string) (90000000 + $n), 8, '0', STR_PAD_LEFT),
            'stage' => 'new',
            ...$attrs,
        ]);
    }

    protected function actingAsUser(User $user): static
    {
        Sanctum::actingAs($user);
        return $this;
    }
}
