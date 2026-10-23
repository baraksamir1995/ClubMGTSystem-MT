<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Tokens in password_reset_tokens, consumed by POST /auth/reset-password.
 *
 * Used by forgot-password (1h) and the gym-owner setup link
 * (SendGymRequestEmail, days). The table is keyed by email, so storing a
 * token replaces any previous one for that address. Only the sha256 hash is
 * stored; the plain token lives in the email and nowhere else.
 *
 * mint() and store() are separate so a caller can send the email first and
 * store the hash only once delivery succeeded — a failed send then leaves
 * the previously emailed link working.
 */
class PasswordResetTokens
{
    /** @return array{0: string, 1: string} [plain token, hash] */
    public function mint(): array
    {
        $token = Str::random(64);
        return [$token, hash('sha256', $token)];
    }

    public function store(string $email, string $hash, \DateInterval|int $ttlSeconds): void
    {
        $expiresAt = is_int($ttlSeconds) ? now()->addSeconds($ttlSeconds) : now()->add($ttlSeconds);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            [
                'token' => $hash,
                'created_at' => now(),
                // Explicit on every write so a short reset token also
                // replaces a longer-lived setup token, and vice versa.
                'expires_at' => $expiresAt,
            ],
        );
    }
}
