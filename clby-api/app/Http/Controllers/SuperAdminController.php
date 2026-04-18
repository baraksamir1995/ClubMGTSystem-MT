<?php

namespace App\Http\Controllers;

use App\Models\Gym;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SuperAdminController extends Controller
{
    /**
     * List all gyms with stats.
     */
    public function index(): JsonResponse
    {
        $gyms = Gym::withCount(['members', 'branches'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (Gym $g) => [
                'id' => $g->id,
                'name' => $g->name,
                'city' => $g->city,
                'country' => $g->country,
                'logo_url' => $g->logo_url,
                'is_active' => $g->is_active,
                'members_count' => $g->members_count,
                'branches_count' => $g->branches_count,
                'max_branches' => $g->max_branches,
                'created_at' => $g->created_at,
            ]);

        return response()->json(['data' => $gyms]);
    }

    /**
     * Show a single gym with its admin.
     */
    public function show(string $id): JsonResponse
    {
        $gym = Gym::withCount(['members', 'branches', 'classes', 'membershipPlans'])
            ->findOrFail($id);

        $admin = User::where('gym_id', $id)
            ->where('role', 'gym_admin')
            ->first(['id', 'full_name', 'email', 'phone', 'created_at']);

        return response()->json([
            'data' => $gym,
            'admin' => $admin,
        ]);
    }

    /**
     * Create a new gym with admin account, default branch, studio, and schedule settings.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'admin_email' => 'required|email|unique:profiles,email',
            'admin_password' => 'required|string|min:6',
            'admin_name' => 'required|string|max:255',
            'city' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:20',
            'timezone' => 'nullable|string|max:50',
            'currency' => 'nullable|string|max:10',
            'max_branches' => 'nullable|integer|min:1|max:100',
        ]);

        $gymId = Str::uuid()->toString();
        $profileId = Str::uuid()->toString();
        $timezone = $validated['timezone'] ?? 'Africa/Cairo';
        $currency = $validated['currency'] ?? 'EGP';

        $gym = DB::transaction(function () use ($gymId, $profileId, $validated, $timezone, $currency) {
            // 1. Create gym
            DB::table('gyms')->insert([
                'id' => $gymId,
                'name' => $validated['name'],
                'city' => $validated['city'] ?? null,
                'country' => $validated['country'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'timezone' => $timezone,
                'language' => 'en',
                'is_active' => true,
                'max_branches' => $validated['max_branches'] ?? 10,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $gym = Gym::find($gymId);

            // 2. Create auth.users stub (FK target)
            DB::table('auth.users')->insertOrIgnore([
                'id' => $profileId,
                'email' => $validated['admin_email'],
                'encrypted_password' => Hash::make($validated['admin_password']),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 3. Create admin profile
            DB::table('profiles')->insert([
                'id' => $profileId,
                'email' => $validated['admin_email'],
                'password' => Hash::make($validated['admin_password']),
                'full_name' => $validated['admin_name'],
                'gym_id' => $gymId,
                'role' => 'gym_admin',
                'is_active' => true,
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

            return $gym;
        });

        return response()->json(['data' => $gym], 201);
    }

    /**
     * Toggle gym active status.
     */
    public function toggleActive(string $id): JsonResponse
    {
        $gym = Gym::findOrFail($id);
        $gym->update(['is_active' => !$gym->is_active]);

        return response()->json(['data' => $gym]);
    }

    /**
     * Update gym settings (e.g. max_branches).
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $gym = Gym::findOrFail($id);

        $validated = $request->validate([
            'max_branches' => 'sometimes|integer|min:1|max:100',
            'name' => 'sometimes|string|max:255',
        ]);

        $gym->update($validated);

        return response()->json(['data' => $gym]);
    }

    /**
     * Delete a gym and all associated data.
     */
    public function destroy(string $id): JsonResponse
    {
        $gym = Gym::findOrFail($id);
        $gymName = $gym->name;

        DB::transaction(function () use ($id) {
            // Delete in dependency order
            DB::table('attendance_logs')->whereIn('gym_member_id', function ($q) use ($id) {
                $q->select('id')->from('gym_members')->where('gym_id', $id);
            })->delete();
            DB::table('payments')->where('gym_id', $id)->delete();
            DB::table('member_memberships')->whereIn('gym_member_id', function ($q) use ($id) {
                $q->select('id')->from('gym_members')->where('gym_id', $id);
            })->delete();
            DB::table('gym_members')->where('gym_id', $id)->delete();
            DB::table('class_sessions')->whereIn('class_id', function ($q) use ($id) {
                $q->select('id')->from('classes')->where('gym_id', $id);
            })->delete();
            DB::table('classes')->where('gym_id', $id)->delete();
            DB::table('studios')->where('gym_id', $id)->delete();
            DB::table('branches')->where('gym_id', $id)->delete();
            DB::table('membership_plans')->where('gym_id', $id)->delete();
            DB::table('schedule_settings')->where('gym_id', $id)->delete();
            DB::table('staff_members')->where('gym_id', $id)->delete();
            DB::table('trainer_profiles')->where('gym_id', $id)->delete();
            DB::table('profiles')->where('gym_id', $id)->delete();

            Gym::destroy($id);
        });

        return response()->json(['message' => "Gym '{$gymName}' deleted"]);
    }
}
