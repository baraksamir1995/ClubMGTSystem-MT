<?php

namespace App\Jobs;

use App\Models\GymRequest;
use App\Services\EmailService;
use App\Services\PasswordResetTokens;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Sends one self-onboarding notification (received / approved / declined).
 *
 * Marked afterCommit in the constructor: if a dispatch ever moves inside a
 * transaction, the job still only runs once the decision is persisted
 * (otherwise matchesStatus would see the old status and drop the email).
 * Delivery state lives on the request row, never in the decision itself:
 *
 *   - Idempotent: a `*_email_sent_at` stamp makes a retried or re-dispatched
 *     job a no-op. `$force` (super-admin "Resend email") is the only bypass.
 *   - A failure records `last_email_error` and rethrows so the queue retries;
 *     it never touches status or provisioning.
 *   - The approval email's password-setup token is minted here, at send
 *     time, so it never sits in the jobs table payload. Its hash is stored
 *     only after the send succeeds, so a failed (re)send leaves the link from
 *     the previous email working; a successful resend replaces it.
 *   - No setup link is minted once the owner has set a password
 *     (must_reset_password cleared) — that would be a live reset link for
 *     an account in use.
 */
class SendGymRequestEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public const TYPE_RECEIVED = 'received';
    public const TYPE_APPROVED = 'approved';
    public const TYPE_DECLINED = 'declined';

    /** How long the owner's password-setup link stays valid. */
    public const SETUP_LINK_DAYS = 7;

    public int $tries = 3;

    public int $timeout = 30;

    /** @return array<int, int> */
    public function backoff(): array
    {
        return [60, 300];
    }

    public function __construct(
        public string $gymRequestId,
        public string $type,
        public bool $force = false,
    ) {
        $this->afterCommit();
    }

    public function handle(EmailService $email): void
    {
        $request = GymRequest::find($this->gymRequestId);
        if (! $request || ! $this->matchesStatus($request)) {
            return;
        }

        $sentColumn = $this->type === self::TYPE_RECEIVED ? 'submitted_email_sent_at' : 'decision_email_sent_at';
        if ($request->{$sentColumn} && ! $this->force) {
            return;
        }

        // Owner already set a password: don't mint a reset link for an
        // account in use. Not a failure, and not a send either.
        if ($this->type === self::TYPE_APPROVED
            && DB::table('profiles')->where('id', $request->owner_profile_id)->where('must_reset_password', false)->exists()) {
            $request->logEvent('email_skipped', null, ['type' => $this->type, 'reason' => 'owner_already_set_password']);
            return;
        }

        try {
            match ($this->type) {
                self::TYPE_RECEIVED => $email->sendGymRequestReceived(
                    $request->owner_email, $request->owner_name, $request->gym_name, $request->reference,
                ),
                self::TYPE_APPROVED => $this->sendApproved($email, $request),
                self::TYPE_DECLINED => $email->sendGymRequestDeclined(
                    $request->owner_email, $request->owner_name, $request->gym_name,
                    $request->share_decline_reason ? $request->decline_reason : null,
                ),
            };
        } catch (\Throwable $e) {
            DB::table('gym_requests')->where('id', $request->id)->update([
                'last_email_error' => Str::limit($e->getMessage(), 500),
                'last_email_failed_at' => now(),
            ]);
            $request->logEvent('email_failed', null, [
                'type' => $this->type,
                'attempt' => $this->attempts(),
                'error' => Str::limit($e->getMessage(), 500),
            ]);
            throw $e;
        }

        DB::table('gym_requests')->where('id', $request->id)->update([
            $sentColumn => now(),
            'last_email_error' => null,
            'last_email_failed_at' => null,
        ]);
        $request->logEvent('email_sent', null, ['type' => $this->type, 'forced' => $this->force]);
    }

    public function failed(\Throwable $e): void
    {
        Log::error('Gym request email gave up after retries', [
            'gym_request_id' => $this->gymRequestId,
            'type' => $this->type,
            'error' => $e->getMessage(),
        ]);
    }

    private function matchesStatus(GymRequest $request): bool
    {
        return match ($this->type) {
            // A delayed retry must not say "we'll review it" after the
            // decision email has gone out.
            self::TYPE_RECEIVED => $request->status === GymRequest::STATUS_PENDING,
            self::TYPE_APPROVED => $request->status === GymRequest::STATUS_APPROVED,
            self::TYPE_DECLINED => $request->status === GymRequest::STATUS_DECLINED,
            default => false,
        };
    }

    private function sendApproved(EmailService $email, GymRequest $request): void
    {
        $baseUrl = rtrim((string) config('services.admin_dashboard.url'), '/');
        if ($baseUrl === '') {
            throw new \RuntimeException('ADMIN_DASHBOARD_URL is not configured');
        }

        $owner = DB::table('profiles')->where('id', $request->owner_profile_id)->first(['email']);
        if (! $owner) {
            throw new \RuntimeException('Owner account no longer exists');
        }

        $tokens = app(PasswordResetTokens::class);
        [$token, $hash] = $tokens->mint();

        $email->sendGymRequestApproved(
            $owner->email,
            $request->owner_name,
            $request->gym_name,
            "{$baseUrl}/set-password?token={$token}",
            "{$baseUrl}/login",
            self::SETUP_LINK_DAYS,
        );

        $tokens->store($owner->email, $hash, self::SETUP_LINK_DAYS * 86400);
    }
}
