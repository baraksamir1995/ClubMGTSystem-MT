<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\GymMember;
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
     * Minimum gap between password-reset emails to the same address.
     * Bounds inbox spam from the unauthenticated forgot-password endpoint
     * while staying well inside the token's 1-hour validity, so a user who
     * lost the first mail can retry without a long wait.
     */
    private const RESET_EMAIL_COOLDOWN_SECONDS = 300;

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

        // `gym_id` is applied immediately: the gym_members row is created at
        // registration, before email verification, so the member shows up in
        // the admin dashboard right away and staff can verify them manually
        // (POST /members/{id}/verify-email) when the confirmation email never
        // lands. `pending_gym_id` is still written alongside so the column
        // keeps its meaning for rows created before this change and for the
        // verification path's back-compat branch.
        //
        // Doing this does NOT grant an unverified user access to gym data —
        // two independent gates still apply:
        //   • login() rejects unverified members with 403 email_not_verified
        //   • the ~246 tenant routes carry `verified_member` middleware
        // Validation ensures the gym exists and is active so an attacker
        // can't enumerate arbitrary gym UUIDs silently.
        $validated = $request->validate([
            'email' => [
                'required',
                'email',
                // Pre-check at validation time — fast path, clean 422 with
                // field-level error. The DB unique index added in migration
                // 2026_05_12_140000 is the authoritative gate that closes
                // the concurrent-register race; if two requests both pass
                // this validator, the second insert raises SQLSTATE 23505
                // which we catch below.
                Rule::unique('profiles', 'email')->where(
                    fn ($q) => $q->whereRaw('LOWER(email) = ?', [strtolower((string) $request->input('email'))])
                ),
            ],
            'password' => ['required', 'confirmed', Password::min(8)],
            'full_name' => 'required|string|max:255',
            // Phone uniqueness is enforced by a partial unique index added
            // in 2026_05_12_180000. The Rule::unique here is the fast path
            // (clean 422 with field-level error); the DB index is the
            // race-condition gate, caught below as SQLSTATE 23505.
            'phone' => [
                'nullable', 'string', 'max:20',
                Rule::unique('profiles', 'phone')->where(fn ($q) => $q->whereNull('deleted_at')),
            ],
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|string|in:male,female,other',
            'gym_id' => ['nullable', 'uuid', Rule::exists('gyms', 'id')->where('is_active', true)],
        ]);

        $userId = Str::uuid()->toString();

        // Atomic insert across auth.users + profiles. Both tables now carry
        // a case-insensitive UNIQUE index on email; the transaction lets the
        // race-loser unwind its auth.users row when the profiles insert hits
        // the unique violation, so we don't leave orphan shim rows.
        try {
            $user = DB::transaction(function () use ($userId, $validated) {
                DB::table('auth.users')->insert([
                    'id' => $userId,
                    'email' => $validated['email'],
                    'encrypted_password' => Hash::make($validated['password']),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $selectedGymId = $validated['gym_id'] ?? null;

                $user = User::forceCreate([
                    'id' => $userId,
                    'email' => $validated['email'],
                    'password' => $validated['password'],
                    'full_name' => $validated['full_name'],
                    'phone' => $validated['phone'] ?? null,
                    'date_of_birth' => $validated['date_of_birth'] ?? null,
                    'gender' => $validated['gender'] ?? null,
                    'gym_id' => $selectedGymId,
                    // Kept in sync so the verification path is a no-op rather
                    // than a second assignment.
                    'pending_gym_id' => $selectedGymId,
                    'role' => 'member',
                ]);

                // Same transaction: a failure here must not leave a profile
                // claiming a gym it has no gym_members row for.
                if ($selectedGymId) {
                    $this->assignGymMember($userId, $selectedGymId);
                    // assignGymMember clears pending_gym_id and re-sets
                    // gym_id; refresh so the response reflects the DB.
                    $user->refresh();
                }

                return $user;
            });
        } catch (\Illuminate\Database\QueryException $e) {
            // 23505 = unique_violation. Race-loser path — present the same
            // 422 the validator would have if the requests had been serial.
            // Inspect the PG error message to figure out WHICH column raced.
            if ($e->getCode() === '23505') {
                $msg = $e->getMessage();
                // Only the credential constraints map to a field-level 422.
                // Anything else (e.g. a gym_members constraint raised by the
                // assignment inside the transaction) must NOT be reported as
                // "email already taken" — the account genuinely does not
                // exist, and telling the user it does leaves them stuck with
                // no way forward.
                $field = match (true) {
                    str_contains($msg, 'profiles_phone_unique')        => 'phone',
                    str_contains($msg, 'profiles_email_lower_unique'),
                    str_contains($msg, 'auth_users_email_lower_unique') => 'email',
                    default                                              => null,
                };

                if ($field !== null) {
                    $label = $field === 'phone' ? 'phone number' : 'email';
                    return response()->json([
                        'message' => "The {$label} has already been taken.",
                        'errors'  => [$field => ["The {$label} has already been taken."]],
                    ], 422);
                }

                Log::error('register: unexpected unique violation', [
                    'email' => $validated['email'],
                    'error' => $msg,
                ]);
                return response()->json([
                    'message' => 'Registration failed. Please try again.',
                ], 500);
            }
            throw $e;
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        // Send verification email
        $this->sendVerificationEmail($user);

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    /**
     * Create a gym_members row and set profiles.gym_id for a self-registered
     * user. Called inside a DB transaction.
     *
     * Runs at registration when the user picked a gym, so they appear in the
     * admin dashboard before verifying. Still called from the verification
     * paths for profiles created before that change (gym_id NULL with a
     * pending_gym_id), which is why both call sites guard on `! gym_id`.
     */
    private function assignGymMember(string $userId, string $gymId): void
    {
        $memberId = Str::uuid()->toString();

        DB::table('gym_members')->insert([
            'id'            => $memberId,
            'gym_id'        => $gymId,
            'user_id'       => $userId,
            // No member_number yet — same convention as MemberController::store.
            // It is allocated when a membership is actually paid for, by the
            // allocators in PaymentController / PaymobController (both of which
            // only fire while member_number IS NULL, and serialize on
            // pg_advisory_xact_lock(crc32(gym_id))). Allocating here would burn
            // numbers on unverified signups AND permanently prevent those
            // allocators from ever running for this member.
            'member_number' => null,
            'status'        => 'active',
            'joined_at'     => now(),
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        DB::table('profiles')
            ->where('id', $userId)
            ->update([
                'gym_id'         => $gymId,
                'pending_gym_id' => null,
                'updated_at'     => now(),
            ]);
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

        $profile = DB::table('profiles')->where('id', $record->user_id)->first();

        DB::transaction(function () use ($record, $profile) {
            DB::table('profiles')
                ->where('id', $record->user_id)
                ->update(['email_verified' => true, 'updated_at' => now()]);

            DB::table('email_verification_tokens')->where('user_id', $record->user_id)->delete();

            // Back-compat: profiles registered before the gym was assigned at
            // signup still need their gym_members row here. Rows created by
            // the current register() flow already have gym_id set, so this is
            // a no-op for them.
            if ($profile && $profile->pending_gym_id && ! $profile->gym_id) {
                $this->assignGymMember($record->user_id, $profile->pending_gym_id);
            }
        });

        return response()->json(['message' => 'Email verified successfully.']);
    }

    public function login(Request $request): JsonResponse
    {
        $this->normalizeEmail($request);

        // Accept either `email` (legacy / members + admins) or `username`
        // (numeric coach login). Whichever is supplied is matched against
        // both columns, case-insensitively — that way the coach app's
        // existing "USERNAME" field can keep sending the value as
        // `email` in its payload, and a properly-updated client can send
        // `username` explicitly.
        $validated = $request->validate([
            'email'    => 'sometimes|string',
            'username' => 'sometimes|string',
            'password' => 'required|string',
            'gym_id'   => 'sometimes|nullable|uuid',
        ]);
        $identifier = strtolower(trim(
            $validated['username'] ?? $validated['email'] ?? ''
        ));
        if ($identifier === '') {
            return response()->json([
                'message' => 'Username or email is required.',
                'errors'  => ['email' => ['Username or email is required.']],
            ], 422);
        }

        $user = User::where(function ($q) use ($identifier) {
            $q->whereRaw('LOWER(email) = ?', [$identifier])
              ->orWhereRaw('LOWER(username) = ?', [$identifier]);
        })
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 401);
        }

        // White-label gym enforcement: if the client specifies a gym_id, members
        // must belong to that gym. Admins/staff can log in from any flavor.
        if (! empty($validated['gym_id']) && in_array($user->role, ['member', null], true)) {
            // Enrolment is the gym_members row (self-registration now creates
            // it up front, as does every admin path).
            $isMember = GymMember::where('user_id', $user->id)
                ->where('gym_id', $validated['gym_id'])
                ->whereNull('deleted_at')
                ->exists();

            // Legacy fallback: profiles registered before the gym was assigned
            // at signup have no row until they verify. Only honour
            // pending_gym_id while that is actually the case — an unverified
            // profile with no membership row at all — so a stale
            // pending_gym_id can never admit an enrolled-elsewhere user into
            // another gym's branded app. Those users still hit the
            // email_not_verified gate immediately below.
            if (! $isMember
                && ! $user->email_verified
                && $user->pending_gym_id === $validated['gym_id']
                && ! GymMember::where('user_id', $user->id)->exists()) {
                $isMember = true;
            }
            if (! $isMember) {
                return response()->json([
                    'message' => 'Invalid credentials.',
                ], 401);
            }
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
        $userId = $request->user()->id;
        $validated = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            // Phone must be unique platform-wide (excluding self + soft-deleted).
            // DB-level partial unique index is the authoritative gate; this
            // validator is the fast-path 422 message.
            'phone' => [
                'sometimes', 'nullable', 'string', 'max:20',
                Rule::unique('profiles', 'phone')
                    ->ignore($userId)
                    ->where(fn ($q) => $q->whereNull('deleted_at')),
            ],
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

        // Audit trail. The endpoint is unauthenticated and was being used to
        // spam a real user's inbox (2026-08-23), and nothing else in the stack
        // records these: Traefik has no access log, the FPM log shows only
        // "POST /index.php", and this action writes no audit row. Log enough
        // to tell an ordinary retry apart from someone targeting an address.
        Log::warning('password reset requested', [
            'email'      => $validated['email'],
            'exists'     => $user !== null,
            'ip'         => $request->ip(),
            'forwarded'  => $request->header('X-Forwarded-For'),
            'user_agent' => $request->userAgent(),
        ]);

        if (! $user) {
            // Don't reveal if email exists
            return response()->json(['message' => 'If that email exists, a reset link has been sent.']);
        }

        // Per-address cooldown. The endpoint is unauthenticated, so without
        // this anyone who knows an address can spam that inbox with reset
        // mail — observed in production on 2026-08-23: six mails in ~16
        // minutes from repeated form submissions. `throttle:auth` is keyed on
        // the CALLER's IP, so it does nothing about a distributed or
        // retry-looping client hammering one victim's address.
        //
        // A fresh request inside the window is a silent no-op: the existing
        // token stays valid and the same generic message is returned, so this
        // leaks nothing about whether the address exists or was recently used.
        $existing = DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->where('created_at', '>', now()->subSeconds(self::RESET_EMAIL_COOLDOWN_SECONDS))
            ->first();

        if ($existing) {
            Log::warning('password reset suppressed by cooldown', [
                'email' => $user->email,
                'ip'    => $request->ip(),
            ]);
            return response()->json(['message' => 'If that email exists, a reset link has been sent.']);
        }

        // Opportunistic cleanup: rows outlive their usefulness because
        // resetPassword only deletes the one it consumes, so an unused token
        // lingers indefinitely (prod had one from 105 days earlier). They are
        // already unusable — resetPassword rejects anything over an hour old —
        // but there is no reason to keep the hashes around.
        DB::table('password_reset_tokens')
            ->where('created_at', '<', now()->subDay())
            ->delete();

        $token = Str::random(64);
        $tokenHash = hash('sha256', $token);

        // Table schema: email (PK), token, created_at — no user_id, no
        // expires_at column; resetPassword enforces the 1-hour lifetime by
        // comparing created_at instead.
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
