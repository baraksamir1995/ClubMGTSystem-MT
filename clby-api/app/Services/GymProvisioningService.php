<?php

namespace App\Services;

use App\Models\Gym;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Creates a gym and everything it needs to be usable: the gym_admin owner
 * account (profiles + auth.users stub), a default branch + studio, and
 * schedule settings.
 *
 * Shared by the super-admin "Create gym" form (SuperAdminController::store)
 * and self-onboarding approval (GymRequestController::approve), so both
 * paths produce identical tenants. All writes run in one transaction; when
 * the caller already holds one (approval locks the request row first) this
 * nests as a savepoint and commits or rolls back with the caller.
 */
class GymProvisioningService
{
    /**
     * @param  array{
     *     name: string, admin_email: string, admin_name: string,
     *     admin_password?: string|null, admin_phone?: string|null,
     *     must_reset_password?: bool,
     *     city?: ?string, country?: ?string, phone?: ?string, timezone?: ?string,
     *     max_branches?: ?int, description?: ?string, address?: ?string,
     *     email?: ?string, logo_url?: ?string, category?: ?string,
     *     latitude?: ?float, longitude?: ?float, services?: ?array,
     * }  $data
     * @return array{gym: Gym, admin_id: string}
     */
    public function provision(array $data): array
    {
        $gymId = Str::uuid()->toString();
        $profileId = Str::uuid()->toString();
        $timezone = $data['timezone'] ?? 'Africa/Cairo';

        // Self-onboarded owners get no usable password: they set one through
        // the emailed setup link, and must_reset_password forces the
        // change-password screen if they ever get in another way.
        $passwordHash = Hash::make($data['admin_password'] ?? Str::random(64));

        return DB::transaction(function () use ($gymId, $profileId, $data, $timezone, $passwordHash) {
            // 1. Create gym
            DB::table('gyms')->insert([
                'id' => $gymId,
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'address' => $data['address'] ?? null,
                'city' => $data['city'] ?? null,
                'country' => $data['country'] ?? null,
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
                'logo_url' => $data['logo_url'] ?? null,
                'category' => $data['category'] ?? 'gym',
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'timezone' => $timezone,
                'language' => 'en',
                'is_active' => true,
                'max_branches' => $data['max_branches'] ?? 10,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $gym = Gym::find($gymId);

            // text[] column — go through the model cast for the literal format
            if (! empty($data['services'])) {
                $gym->update(['services' => array_values($data['services'])]);
            }

            // 2. Create auth.users stub (FK target)
            DB::table('auth.users')->insertOrIgnore([
                'id' => $profileId,
                'email' => $data['admin_email'],
                'encrypted_password' => $passwordHash,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 3. Create admin profile
            DB::table('profiles')->insert([
                'id' => $profileId,
                'email' => $data['admin_email'],
                'password' => $passwordHash,
                'full_name' => $data['admin_name'],
                'phone' => $data['admin_phone'] ?? null,
                'gym_id' => $gymId,
                'role' => 'gym_admin',
                'is_active' => true,
                'must_reset_password' => $data['must_reset_password'] ?? false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 4. Create default branch + studio
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

            // 5. Create schedule settings
            DB::table('schedule_settings')->insert([
                'id' => Str::uuid()->toString(),
                'gym_id' => $gymId,
                'is_published' => false,
                'last_updated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return ['gym' => $gym->fresh(), 'admin_id' => $profileId];
        });
    }
}
