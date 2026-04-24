<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\EmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email|unique:profiles,email',
            'password' => ['required', 'confirmed', Password::min(8)],
            'full_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|string|in:male,female,other',
            'gym_id' => 'nullable|uuid|exists:gyms,id',
        ]);

        $userId = Str::uuid()->toString();

        // Insert into auth.users first (FK target)
        DB::table('auth.users')->insert([
            'id' => $userId,
            'email' => $validated['email'],
            'encrypted_password' => Hash::make($validated['password']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Create profile
        $user = User::create([
            'id' => $userId,
            'email' => $validated['email'],
            'password' => $validated['password'],
            'full_name' => $validated['full_name'],
            'phone' => $validated['phone'] ?? null,
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'gym_id' => $validated['gym_id'] ?? null,
            'role' => 'member',
        ]);

        // Create gym_members record — no member_number yet (assigned when membership is paid)
        if (! empty($validated['gym_id'])) {
            DB::table('gym_members')->insert([
                'id' => Str::uuid()->toString(),
                'gym_id' => $validated['gym_id'],
                'user_id' => $userId,
                'member_number' => null,
                'status' => 'active',
                'joined_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        // Send verification email
        $this->sendVerificationEmail($user);

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    private function sendVerificationEmail(User $user): void
    {
        $verifyToken = Str::random(64);

        DB::table('email_verification_tokens')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'token' => hash('sha256', $verifyToken),
                'expires_at' => now()->addDays(7),
                'created_at' => now(),
            ]
        );

        try {
            (new EmailService())->sendConfirmation($user->email, $verifyToken);
        } catch (\Throwable $e) {
            Log::error('sendVerificationEmail failed', [
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function resendVerificationEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->email_verified) {
            return response()->json(['message' => 'Email already verified.']);
        }

        $this->sendVerificationEmail($user);

        return response()->json(['message' => 'Verification email sent.']);
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $record = DB::table('email_verification_tokens')
            ->where('token', hash('sha256', $validated['token']))
            ->where('expires_at', '>', now())
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Invalid or expired token.'], 422);
        }

        DB::table('profiles')
            ->where('id', $record->user_id)
            ->update(['email_verified' => true, 'updated_at' => now()]);

        DB::table('email_verification_tokens')->where('user_id', $record->user_id)->delete();

        return response()->json(['message' => 'Email verified successfully.']);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 401);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|nullable|string|max:20',
            'date_of_birth' => 'sometimes|nullable|date',
            'gender' => 'sometimes|nullable|string|in:male,female,other',
            'address' => 'sometimes|nullable|string|max:500',
            'emergency_contact_name' => 'sometimes|nullable|string|max:255',
            'emergency_contact_phone' => 'sometimes|nullable|string|max:20',
            'preferred_language' => 'sometimes|string|in:en,ar',
            'notification_preferences' => 'sometimes|array',
        ]);

        $request->user()->update($validated);

        return response()->json($request->user()->fresh());
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user) {
            // Don't reveal if email exists
            return response()->json(['message' => 'If that email exists, a reset link has been sent.']);
        }

        $token = Str::random(64);
        $tokenHash = hash('sha256', $token);

        // Table schema: email (PK), token, created_at — no user_id, no expires_at
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => $tokenHash,
                'created_at' => now(),
            ]
        );

        try {
            (new EmailService())->sendPasswordReset($user->email, $token);
        } catch (\Throwable $e) {
            Log::error('forgotPassword email send failed', [
                'email' => $user->email,
                'error' => $e->getMessage(),
            ]);
            // Swallow — don't reveal email-delivery issues to clients
        }

        return response()->json(['message' => 'If that email exists, a reset link has been sent.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        // Tokens older than 1 hour are considered expired
        $record = DB::table('password_reset_tokens')
            ->where('token', hash('sha256', $validated['token']))
            ->where('created_at', '>', now()->subHour())
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Invalid or expired token.'], 422);
        }

        $user = User::where('email', $record->email)->first();
        if (! $user) {
            return response()->json(['message' => 'Invalid token.'], 422);
        }
        $user->update([
            'password' => $validated['password'],
            'must_reset_password' => false,
        ]);

        // Also update auth.users
        DB::table('auth.users')
            ->where('id', $user->id)
            ->update(['encrypted_password' => Hash::make($validated['password'])]);

        DB::table('password_reset_tokens')->where('email', $user->email)->delete();

        return response()->json(['message' => 'Password reset successfully.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        // If must_reset_password is set, skip current password check
        if ($user->must_reset_password) {
            $validated = $request->validate([
                'password' => ['required', 'confirmed', Password::min(8)],
            ]);
        } else {
            $validated = $request->validate([
                'current_password' => 'required|string',
                'password' => ['required', 'confirmed', Password::min(8)],
            ]);

            if (! Hash::check($validated['current_password'], $user->password)) {
                return response()->json(['message' => 'Current password is incorrect.'], 422);
            }
        }

        $user->update(['password' => $validated['password'], 'must_reset_password' => false]);

        DB::table('auth.users')
            ->where('id', $user->id)
            ->update(['encrypted_password' => Hash::make($validated['password'])]);

        return response()->json(['message' => 'Password changed successfully.']);
    }
}
