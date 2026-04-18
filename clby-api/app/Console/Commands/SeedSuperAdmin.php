<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SeedSuperAdmin extends Command
{
    protected $signature = 'super-admin:seed
        {--email= : Super admin email}
        {--password= : Super admin password}
        {--name= : Super admin name}';

    protected $description = 'Create a super-admin account (platform-level, no gym association)';

    public function handle(): int
    {
        $email = $this->option('email') ?? $this->ask('Super admin email');
        $password = $this->option('password') ?? $this->secret('Super admin password');
        $name = $this->option('name') ?? $this->ask('Full name', 'Super Admin');

        // Check if already exists
        $existing = DB::table('profiles')->where('email', $email)->first();
        if ($existing) {
            if ($existing->role === 'super_admin') {
                $this->warn("Super admin already exists: {$email}");
                return 0;
            }
            $this->error("A user with email {$email} already exists with role: {$existing->role}");
            return 1;
        }

        $profileId = Str::uuid()->toString();

        // Insert into auth.users first (FK target)
        DB::table('auth.users')->insertOrIgnore([
            'id' => $profileId,
            'email' => $email,
            'encrypted_password' => Hash::make($password),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('profiles')->insert([
            'id' => $profileId,
            'email' => $email,
            'password' => Hash::make($password),
            'full_name' => $name,
            'gym_id' => null,
            'role' => 'super_admin',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->info("Super admin created: {$email}");
        $this->info("Login at the super-admin dashboard to manage gyms.");

        return 0;
    }
}
