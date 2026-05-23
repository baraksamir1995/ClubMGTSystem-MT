<?php

namespace App\Http\Controllers;

use App\Models\TrainerProfile;
use App\Services\StorageService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

use \App\Traits\LogsActivity;

class TrainerController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Pull the linked profiles row's username/email/phone too, so the
        // admin's Edit modal can display the Coachesapp login (read-only
        // username + a Reset Password input) without a second fetch.
        $query = TrainerProfile::where('gym_id', $gymId)
            ->with('user:id,full_name,email,phone,username');

        if ($request->query('active') === 'true') {
            $query->where('is_active', true);
        }
        if ($trainerType = $request->query('trainer_type')) {
            $query->where('trainer_type', $trainerType);
        }

        $trainers = $query->orderBy('created_at', 'desc')->get();

        // Convenience flat fields — the frontend reads these without
        // having to traverse `.user.username`.
        $shaped = $trainers->map(function ($t) {
            $arr = $t->toArray();
            $arr['username']  = $t->user->username ?? null;
            $arr['has_login'] = ! is_null($t->profile_id);
            return $arr;
        });

        return response()->json(['data' => $shaped]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'bio'            => 'nullable|string',
            'specialties'    => 'nullable|array',
            'certifications' => 'nullable|array',
            'photo_url'      => 'nullable|string',
            'trainer_type'   => 'nullable|string|max:50',
            'branch_id'      => 'nullable|uuid',
            'profile_id'     => 'nullable|uuid',
            // Optional login provisioning. If `password` is present we
            // also mint the profiles + auth.users rows and link them via
            // trainer_profiles.profile_id. `username` is the specialist's
            // mobile number (digits only); required whenever we're
            // provisioning a login.
            'password'       => 'nullable|string|min:6',
            'username'       => 'required_with:password|string|regex:/^[0-9]{4,15}$/',
        ]);

        $gymId    = $request->user()->gym_id;
        $password = $validated['password'] ?? null;

        // Simple path — no login wanted. Original behavior.
        if (! $password) {
            $payload = collect($validated)
                ->only(['name', 'bio', 'specialties', 'certifications', 'photo_url', 'trainer_type', 'branch_id', 'profile_id'])
                ->put('gym_id', $gymId)
                ->all();
            $trainer = TrainerProfile::create($payload);
            return response()->json(['data' => $trainer], 201);
        }

        // Login path — provision profiles + auth.users + trainer_profile
        // in one transaction. Synthetic email + numeric username so the
        // coach can sign in to the Coachesapp without the admin having
        // to invent an address.
        try {
            $result = DB::transaction(function () use ($validated, $gymId, $password) {
                $profileId = Str::uuid()->toString();
                $hashed    = Hash::make($password);
                // `username` is required-with-password by the validator,
                // so it is always present here. We treat it as the
                // specialist's mobile number — uniqueness is the
                // partial unique index on LOWER(username).
                $username  = $validated['username'];
                $gymKey    = substr(preg_replace('/[^a-z0-9]/i', '', $gymId), 0, 8);
                $email     = "pt-{$username}@{$gymKey}.coachesapp.local";

                DB::table('auth.users')->insert([
                    'id'                 => $profileId,
                    'email'              => $email,
                    'encrypted_password' => $hashed,
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
                DB::table('profiles')->insert([
                    'id'                  => $profileId,
                    'email'               => $email,
                    'username'            => $username,
                    'full_name'           => $validated['name'],
                    'password'            => $hashed,
                    'gym_id'              => $gymId,
                    'role'                => 'trainer',
                    'is_active'           => true,
                    'email_verified'      => true,
                    'must_reset_password' => false,
                    'account_status'      => 'active',
                    'created_at'          => now(),
                    'updated_at'          => now(),
                ]);

                $trainer = TrainerProfile::create([
                    'gym_id'         => $gymId,
                    'profile_id'     => $profileId,
                    'name'           => $validated['name'],
                    'bio'            => $validated['bio']            ?? null,
                    'specialties'    => $validated['specialties']    ?? null,
                    'certifications' => $validated['certifications'] ?? null,
                    'photo_url'      => $validated['photo_url']      ?? null,
                    'trainer_type'   => $validated['trainer_type']   ?? null,
                    'branch_id'      => $validated['branch_id']      ?? null,
                    'is_active'      => true,
                ]);

                return ['trainer' => $trainer, 'username' => $username, 'email' => $email];
            });
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23505') {
                $msg = $e->getMessage();
                if (str_contains($msg, 'profiles_username_lower_unique')) {
                    return response()->json([
                        'error' => 'That username is already taken.',
                        'code'  => 'username_taken',
                    ], 422);
                }
            }
            throw $e;
        }

        // Response carries the trainer plus the assigned login bits so
        // the admin UI can show them once in a "credentials" panel.
        $data = $result['trainer']->toArray();
        $data['username'] = $result['username'];
        $data['email']    = $result['email'];
        return response()->json(['data' => $data], 201);
    }


    public function update(Request $request, string $id): JsonResponse
    {
        $gymId   = $request->user()->gym_id;
        $trainer = TrainerProfile::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'name'           => 'sometimes|string|max:255',
            'bio'            => 'nullable|string',
            'specialties'    => 'nullable|array',
            'certifications' => 'nullable|array',
            'photo_url'      => 'nullable|string',
            'is_active'      => 'sometimes|boolean',
            'trainer_type'   => 'nullable|string|max:50',
            'branch_id'      => 'nullable|uuid',
            // Optional credential edits. `password` resets the login (if
            // the trainer has one); `username` updates the mobile-number
            // login ID.
            'password'       => 'nullable|string|min:6',
            'username'       => 'nullable|string|regex:/^[0-9]{4,15}$/',
        ]);

        $profileFields = collect($validated)
            ->only(['name', 'bio', 'specialties', 'certifications', 'photo_url', 'is_active', 'trainer_type', 'branch_id'])
            ->all();
        $newPassword = $validated['password'] ?? null;
        $newUsername = $validated['username'] ?? null;

        // Credential edits require a linked login. Surface a clear error
        // rather than silently dropping them.
        if (($newPassword || $newUsername) && ! $trainer->profile_id) {
            return response()->json([
                'error' => "This specialist doesn't have a Coachesapp login yet. Recreate them to add credentials.",
                'code'  => 'no_login',
            ], 422);
        }

        try {
            DB::transaction(function () use ($trainer, $profileFields, $newPassword, $newUsername) {
                if (! empty($profileFields)) {
                    $trainer->update($profileFields);
                }

                if (! $newPassword && ! $newUsername) {
                    return;
                }

                // Mirror the trainer's name onto the linked profiles row
                // when the name itself changed — keeps `/api/me` etc. in
                // sync without a second round-trip.
                $profileUpdates = [];
                if (isset($profileFields['name'])) {
                    $profileUpdates['full_name'] = $profileFields['name'];
                }
                if ($newPassword) {
                    $profileUpdates['password'] = Hash::make($newPassword);
                }
                if ($newUsername) {
                    $profileUpdates['username'] = $newUsername;
                }
                $profileUpdates['updated_at'] = Carbon::now()->toIso8601String();
                DB::table('profiles')
                    ->where('id', $trainer->profile_id)
                    ->update($profileUpdates);

                // auth.users mirror — keep encrypted_password in sync so
                // a Supabase-shim consumer doesn't drift from the
                // authoritative profiles.password.
                if ($newPassword) {
                    DB::table('auth.users')
                        ->where('id', $trainer->profile_id)
                        ->update([
                            'encrypted_password' => Hash::make($newPassword),
                            'updated_at'         => Carbon::now()->toIso8601String(),
                        ]);
                }
            });
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() === '23505' && str_contains($e->getMessage(), 'profiles_username_lower_unique')) {
                return response()->json([
                    'error' => 'That username is already taken.',
                    'code'  => 'username_taken',
                ], 422);
            }
            throw $e;
        }

        return response()->json(['data' => $trainer->fresh()]);
    }

    public function sessions(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Check trainer exists
        TrainerProfile::where('gym_id', $gymId)->findOrFail($id);

        $trainer = DB::table('trainer_profiles')->where('id', $id)->first();
        $trainerName = $trainer->name ?? '';

        $sessions = DB::table('class_sessions')
            ->join('classes', 'classes.id', '=', 'class_sessions.class_id')
            ->where('class_sessions.gym_id', $gymId)
            ->where(function ($q) use ($id, $trainerName) {
                $q->where('classes.trainer_id', $id)
                  ->orWhere('class_sessions.instructor', $trainerName);
            })
            ->select('class_sessions.*', 'classes.name as class_name', 'classes.class_type', 'classes.color')
            ->orderBy('class_sessions.session_date', 'desc')
            ->get();

        return response()->json(['data' => $sessions]);
    }

    public function reviews(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Get sessions taught by this trainer
        $trainer = TrainerProfile::where('gym_id', $gymId)->findOrFail($id);

        $ratings = DB::table('session_ratings')
            ->join('class_sessions', 'class_sessions.id', '=', 'session_ratings.session_id')
            ->join('classes', 'classes.id', '=', 'class_sessions.class_id')
            ->leftJoin('gym_members', 'gym_members.id', '=', 'session_ratings.gym_member_id')
            ->leftJoin('profiles', 'profiles.id', '=', 'gym_members.user_id')
            ->where('session_ratings.gym_id', $gymId)
            ->where(function ($q) use ($id, $trainer) {
                $q->where('classes.trainer_id', $id)
                  ->orWhere('class_sessions.instructor', $trainer->name);
            })
            ->select(
                'session_ratings.*',
                'classes.name as class_name',
                'profiles.full_name as member_name',
                'profiles.photo_url as member_photo_url',
            )
            ->orderBy('session_ratings.created_at', 'desc')
            ->get();

        return response()->json(['data' => $ratings]);
    }

    public function uploadPhoto(Request $request, StorageService $storage): JsonResponse
    {
        $request->validate(['file' => 'required|image|max:5120']);

        $gymId = $request->user()->gym_id;
        $result = $storage->upload($request->file('file'), 'trainers', $gymId);

        return response()->json(['data' => $result]);
    }
}
