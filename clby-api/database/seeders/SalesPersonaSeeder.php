<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Deterministic sales personas for end-to-end / browser testing.
 *
 *   SEED_GYM_ID=<gym> php artisan db:seed --class=SalesPersonaSeeder
 *
 * Creates (idempotent — safe to re-run; existing personas are updated):
 *   - a second branch ("Test Branch B") so branch scoping is observable
 *   - one sales role granting the `sales` module
 *   - a sales MANAGER over both branches
 *   - two sales AGENTS, one per branch
 *
 * All personas get a KNOWN password so a tester can log in directly.
 * Passwords are set with must_reset_password=false so login lands straight
 * in the dashboard (no change-password interstitial).
 *
 * The gym admin is NOT created here (already exists per gym); the printed
 * summary reminds the tester which admin to use.
 */
class SalesPersonaSeeder extends Seeder
{
    private const PASSWORD = 'Test1234!';

    private const PEOPLE = [
        ['full_name' => 'Manny Manager', 'email' => 'manager@sales.test', 'sales_role' => 'manager'],
        ['full_name' => 'Amir Agent',    'email' => 'agent1@sales.test',  'sales_role' => 'rep'],
        ['full_name' => 'Aya Agent',     'email' => 'agent2@sales.test',  'sales_role' => 'rep'],
    ];

    public function run(): void
    {
        $gymId = env('SEED_GYM_ID') ?: DB::table('sales_leads')->value('gym_id');
        if (! $gymId) {
            $this->command->warn('No gym found (set SEED_GYM_ID). Skipping.');
            return;
        }

        // Ensure a second branch so cross-branch scoping is testable.
        $branchA = DB::table('branches')->where('gym_id', $gymId)->orderBy('created_at')->first();
        if (! $branchA) {
            $this->command->warn("Gym {$gymId} has no branches. Skipping.");
            return;
        }
        $branchB = DB::table('branches')->where('gym_id', $gymId)->where('name', 'Test Branch B')->first();
        if (! $branchB) {
            $branchBId = Str::uuid()->toString();
            DB::table('branches')->insert([
                'id' => $branchBId, 'gym_id' => $gymId, 'name' => 'Test Branch B',
                'is_active' => true, 'created_at' => now(),
            ]);
            $branchB = (object) ['id' => $branchBId, 'name' => 'Test Branch B'];
        }

        // One role that grants the sales module (module-level access model).
        $roleId = DB::table('staff_roles')->where('gym_id', $gymId)->where('name', 'Sales (test)')->value('id');
        if (! $roleId) {
            $roleId = Str::uuid()->toString();
            DB::table('staff_roles')->insert(['id' => $roleId, 'gym_id' => $gymId, 'name' => 'Sales (test)']);
        }
        DB::table('staff_role_permissions')->updateOrInsert(
            ['role_id' => $roleId, 'module' => 'sales', 'action' => 'view'],
            ['action' => 'view'],
        );

        foreach (self::PEOPLE as $i => $person) {
            $homeBranch = $i === 2 ? $branchB->id : $branchA->id; // agent2 → branch B
            $this->upsertPerson($gymId, $roleId, $person, $branchA, $branchB, $homeBranch);
        }

        $this->printSummary($gymId, $branchA, $branchB);
    }

    private function upsertPerson(string $gymId, string $roleId, array $person, $branchA, $branchB, string $homeBranch): void
    {
        $profile = DB::table('profiles')->where('email', $person['email'])->first();
        $profileId = $profile->id ?? Str::uuid()->toString();

        $isManager = $person['sales_role'] === 'manager';

        // auth.users shim (FK target for staff_members.user_id).
        DB::table('auth.users')->updateOrInsert(
            ['id' => $profileId],
            [
                'email' => $person['email'],
                'encrypted_password' => Hash::make(self::PASSWORD),
                'updated_at' => now(),
            ] + (! $profile ? ['created_at' => now()] : []),
        );

        DB::table('profiles')->updateOrInsert(
            ['id' => $profileId],
            [
                'email' => $person['email'],
                'full_name' => $person['full_name'],
                'password' => Hash::make(self::PASSWORD),
                'gym_id' => $gymId,
                'role' => 'staff',
                'is_active' => true,
                'must_reset_password' => false,
                'updated_at' => now(),
            ] + (! $profile ? ['created_at' => now()] : []),
        );

        // staff_members row with the sales designation.
        $staff = DB::table('staff_members')->where('user_id', $profileId)->where('gym_id', $gymId)->first();
        $staffId = $staff->id ?? Str::uuid()->toString();
        DB::table('staff_members')->updateOrInsert(
            ['id' => $staffId],
            [
                'gym_id' => $gymId,
                'user_id' => $profileId,
                'full_name' => $person['full_name'],
                'email' => $person['email'],
                'status' => 'active',
                'deleted_at' => null,
                'sales_role' => $person['sales_role'],
                'branch_id' => $isManager ? null : $homeBranch,
                'manager_branch_ids' => $isManager ? json_encode([$branchA->id, $branchB->id]) : null,
                'updated_at' => now(),
            ] + (! $staff ? ['created_at' => now()] : []),
        );

        DB::table('staff_member_roles')->updateOrInsert(
            ['staff_id' => $staffId, 'role_id' => $roleId],
            ['staff_id' => $staffId, 'role_id' => $roleId],
        );
    }

    private function printSummary(string $gymId, $branchA, $branchB): void
    {
        $admin = DB::table('profiles')->where('gym_id', $gymId)->where('role', 'gym_admin')->value('email');
        $this->command->info('');
        $this->command->info('Sales personas ready for gym ' . $gymId);
        $this->command->info('  Branch A: ' . $branchA->name . ' (' . $branchA->id . ')');
        $this->command->info('  Branch B: ' . $branchB->name . ' (' . $branchB->id . ')');
        $this->command->info('  Admin (pre-existing, use its own password): ' . ($admin ?: 'none'));
        $this->command->table(
            ['Persona', 'Email', 'Password', 'Scope'],
            [
                ['Manager', 'manager@sales.test', self::PASSWORD, 'Both branches'],
                ['Agent 1', 'agent1@sales.test', self::PASSWORD, 'Branch A'],
                ['Agent 2', 'agent2@sales.test', self::PASSWORD, 'Branch B'],
            ],
        );
    }
}
