<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SeedGym extends Command
{
    protected $signature = 'gym:seed
        {name : Gym name}
        {--email= : Admin email}
        {--password= : Admin password}
        {--phone= : Gym phone}
        {--timezone=Africa/Cairo : Timezone}
        {--currency=EGP : Default currency}';

    protected $description = 'Seed a new gym with admin account (run once per instance)';

    public function handle(): int
    {
        $gymName = $this->argument('name');
        $adminEmail = $this->option('email') ?? $this->ask('Admin email');
        $adminPassword = $this->option('password') ?? $this->secret('Admin password');
        $phone = $this->option('phone');
        $timezone = $this->option('timezone');
        $currency = $this->option('currency');

        // Check if gym already exists
        $existingGym = DB::table('gyms')->first();
        if ($existingGym) {
            $this->warn("A gym already exists: {$existingGym->name} ({$existingGym->id})");
            if (! $this->confirm('Continue and create another gym?', false)) {
                return 0;
            }
        }

        $gymId = Str::uuid()->toString();
        $profileId = Str::uuid()->toString();

        return DB::transaction(function () use ($gymId, $profileId, $gymName, $adminEmail, $adminPassword, $phone, $timezone, $currency) {
            // 1. Create gym
            DB::table('gyms')->insert([
                'id' => $gymId,
                'name' => $gymName,
                'timezone' => $timezone,
                'language' => 'en',
                'currency' => $currency,
                'is_active' => true,
                'max_branches' => 1000,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->info("✓ Gym created: {$gymName} ({$gymId})");

            // 2. Create auth.users stub
            DB::table('auth.users')->insertOrIgnore([
                'id' => $profileId,
                'email' => $adminEmail,
                'encrypted_password' => Hash::make($adminPassword),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 3. Create admin profile
            DB::table('profiles')->insert([
                'id' => $profileId,
                'email' => $adminEmail,
                'password' => Hash::make($adminPassword),
                'full_name' => 'Gym Admin',
                'phone' => $phone,
                'gym_id' => $gymId,
                'role' => 'gym_admin',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $this->info("✓ Admin created: {$adminEmail}");

            // 4. Create gym member record for admin
            DB::table('gym_members')->insert([
                'id' => Str::uuid()->toString(),
                'gym_id' => $gymId,
                'user_id' => $profileId,
                'member_number' => null,
                'status' => 'active',
                'joined_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 5. Create default branch + studio
            $branchId = Str::uuid()->toString();
            DB::table('branches')->insert([
                'id' => $branchId,
                'gym_id' => $gymId,
                'name' => 'Main Branch',
                'is_active' => true,
                'created_at' => now(),
            ]);

            DB::table('studios')->insert([
                'id' => Str::uuid()->toString(),
                'gym_id' => $gymId,
                'branch_id' => $branchId,
                'name' => 'Main Studio',
                'capacity' => 30,
                'created_at' => now(),
            ]);
            $this->info("✓ Default branch + studio created");

            // 6. Create schedule settings
            DB::table('schedule_settings')->insert([
                'id' => Str::uuid()->toString(),
                'gym_id' => $gymId,
                'is_published' => false,
                'last_updated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->newLine();
            $this->info("🏋️ Gym ready!");
            $this->info("   Gym ID:  {$gymId}");
            $this->info("   Admin:   {$adminEmail}");
            $this->info("   Login at: /login");

            return 0;
        });
    }
}
