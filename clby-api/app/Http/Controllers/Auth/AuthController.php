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
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    /**
     * Lowercase + trim the incoming email so auth lookups are
     * case-insensitive regardless of how the user typed it.
     */
    private function normalizeEmail(Request $request): void
    {
        if ($request->has('email')) {
            $request->merge([
                'email' => strtolower(trim((string) $request->input('email', ''))),
            ]);
        }
    }

    public function register(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);

        // SECURITY: `gym_id` is intentionally NOT accepted on self-registration.
        // Honoring a user-supplied gym_id here lets any internet user enroll as
        // a member of any gym in the platform (multi-tenant isolation bypass,
        // disclosed 2026-05-12). Gym membership is established through the
        // admin-invite path (POST /api/members/register, gated by
        // permission:members,create) instead. Self-registered profiles land
        // unaffiliated (gym_id = NULL) until a gym admin attaches them.
        $validated = $request->validate([
            'email' => [
                'required',
                'email',
                Rule::unique('profiles', 'email')->where(
                    fn ($q) => $q->whereRaw('LOWER(email) = ?', [strtolower((string) $request->input('email'))])
                ),
            ],
            'password' => ['required', 'confirmed', Password::min(8)],
            'full_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|string|in:male,female,other',
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

        // Create profile (forceCreate so id + role pass through $fillable).
        // gym_id stays NULL — see register() docblock.
        $user = User::forceCreate([
            'id' => $userId,
            'email' => $validated['email'],
            'password' => $validated['password'],
            'full_name' => $validated['full_name'],
            'phone' => $validated['phone'] ?? null,
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'gender' => $validated['gender'] ?? null,
            'gym_id' => null,
            'role' => 'member',
        ]);

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

    /**
     * Unauthenticated resend: looks the user up by email. Always returns 200
     * regardless of outcome, to avoid leaking which emails are registered.
     */
    public function resendVerificationPublic(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);

        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::whereRaw('LOWER(email) = ?', [$validated['email']])->first();
        if ($user && ! $user->email_verified) {
            $this->sendVerificationEmail($user);
        }

        return response()->json([
            'message' => 'If that email exists and is unverified, a confirmation link has been sent.',
        ]);
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
        $this->normalizeEmail($request);

        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::whereRaw('LOWER(email) = ?', [$validated['email']])
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 401);
        }

        // Members must verify their email before logging in. Admin roles are
        // created by super-admins / onboarding and don't go through the
        // self-signup email flow, so exempt them.
        $requiresVerification = in_array($user->role, ['member', null], true);
        if ($requiresVerification && ! $user->email_verified) {
            return response()->json([
                'message' => 'Please verify your email before signing in. Check your inbox for the confirmation link.',
                'code' => 'email_not_verified',
            ], 403);
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
            'photo_url' => 'sometimes|nullable|string|max:1024',
            'fcm_token' => 'sometimes|nullable|string',
        ]);

        $request->user()->update($validated);

        return response()->json($request->user()->fresh());
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);

        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::whereRaw('LOWER(email) = ?', [$validated['email']])->first();

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

        // Invalidate every existing session for this user. If a stolen
        // token is what triggered the reset, leaving it valid would
        // defeat the entire flow.
        $user->tokens()->delete();

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

        // Revoke every other active session — keep the current token so
        // the user stays logged in on this device. If their account had
        // been compromised on another device, that session is now dead.
        $currentTokenId = $request->user()->currentAccessToken()?->id;
        $user->tokens()
            ->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))
            ->delete();

        return response()->json(['message' => 'Password changed successfully.']);
    }
}
