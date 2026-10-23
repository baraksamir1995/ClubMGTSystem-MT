<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EmailService
{
    private const RESEND_URL = 'https://api.resend.com/emails';
    private const PLATFORM_NAME = 'CLBY';

    public function sendConfirmation(string $to, string $tokenHash, string $redirectTo = 'gymapp://email-confirmed'): void
    {
        $confirmUrl = $this->buildConfirmUrl($tokenHash, 'signup', $redirectTo);
        $html = $this->renderEmail(
            'Confirm your email',
            'Welcome to <strong style="color:#111827;">' . self::PLATFORM_NAME . '</strong>! Tap the button below to confirm your email address and activate your account.',
            'Confirm my email',
            $confirmUrl,
        );
        $this->send($to, 'Confirm your email — ' . self::PLATFORM_NAME, $html);
    }

    public function sendPasswordReset(string $to, string $tokenHash, string $redirectTo = 'gymapp://password-reset'): void
    {
        $confirmUrl = $this->buildConfirmUrl($tokenHash, 'recovery', $redirectTo);
        $html = $this->renderEmail(
            'Reset your password',
            'Tap the button below to reset your password.',
            'Reset password',
            $confirmUrl,
        );
        $this->send($to, 'Reset your password — ' . self::PLATFORM_NAME, $html);
    }

    public function sendEmailChange(string $to, string $tokenHash, string $redirectTo = 'gymapp://email-changed'): void
    {
        $confirmUrl = $this->buildConfirmUrl($tokenHash, 'email_change', $redirectTo);
        $html = $this->renderEmail(
            'Confirm email change',
            'Tap the button below to confirm your new email address.',
            'Confirm email change',
            $confirmUrl,
        );
        $this->send($to, 'Confirm email change — ' . self::PLATFORM_NAME, $html);
    }

    /**
     * Self-onboarding: request received, awaiting super-admin review.
     */
    public function sendGymRequestReceived(string $to, string $ownerName, string $gymName, string $reference): void
    {
        $html = $this->renderEmail(
            'We received your request',
            'Hi ' . e($ownerName) . ', thanks for registering <strong style="color:#111827;">' . e($gymName) . '</strong> on ' . self::PLATFORM_NAME . '.'
                . '<br><br>Your request reference is <strong style="color:#111827;">' . e($reference) . '</strong>. Our team will review it shortly.'
                . ' Once it is approved you will receive a second email with your admin dashboard link and instructions to set your password.',
            footer: 'You are receiving this because this address was used to register a gym on ' . self::PLATFORM_NAME . '.',
        );
        $this->send($to, "We received your request ({$reference}) — " . self::PLATFORM_NAME, $html);
    }

    /**
     * Self-onboarding: gym approved and provisioned. $setupUrl carries a
     * single-use, time-limited password-setup token — never a password.
     */
    public function sendGymRequestApproved(string $to, string $ownerName, string $gymName, string $setupUrl, string $dashboardUrl, int $setupValidDays): void
    {
        $html = $this->renderEmail(
            'Your gym is approved',
            'Hi ' . e($ownerName) . ', great news — <strong style="color:#111827;">' . e($gymName) . '</strong> is now live on ' . self::PLATFORM_NAME . ' and visible to members in the app.'
                . '<br><br>Your admin username is <strong style="color:#111827;">' . e($to) . '</strong>.'
                . ' Tap the button below to set your password, then sign in to your dashboard at <a href="' . e($dashboardUrl) . '" style="color:#5b50e8;">' . e($dashboardUrl) . '</a>.'
                . "<br><br>The setup link is valid for {$setupValidDays} days and can be used once.",
            'Set my password',
            $setupUrl,
            footer: 'If the link has expired, contact the ' . self::PLATFORM_NAME . ' team and we will send you a new one.',
        );
        $this->send($to, "{$gymName} is approved — " . self::PLATFORM_NAME, $html);
    }

    /**
     * Self-onboarding: request declined. $reason is only passed when the
     * super-admin chose to share it with the applicant.
     */
    public function sendGymRequestDeclined(string $to, string $ownerName, string $gymName, ?string $reason): void
    {
        $body = 'Hi ' . e($ownerName) . ', thank you for your interest in ' . self::PLATFORM_NAME . '.'
            . ' After reviewing your request for <strong style="color:#111827;">' . e($gymName) . '</strong>, we are unable to approve it at this time.';
        if ($reason !== null && trim($reason) !== '') {
            $body .= '<br><br><strong style="color:#111827;">Reason:</strong> ' . nl2br(e($reason));
        }
        $body .= '<br><br>If you believe this was a mistake or your circumstances change, contact the ' . self::PLATFORM_NAME . ' team and we will take another look.';

        $html = $this->renderEmail(
            'Update on your request',
            $body,
            footer: 'You are receiving this because this address was used to register a gym on ' . self::PLATFORM_NAME . '.',
        );
        $this->send($to, "Update on your {$gymName} request — " . self::PLATFORM_NAME, $html);
    }

    private function send(string $to, string $subject, string $html): void
    {
        $apiKey = config('services.resend.api_key');
        $from = config('services.resend.from_email', 'no-reply@clbyapp.com');

        // Honour Laravel's mail driver even though we bypass the Mail facade
        // and post to Resend's HTTP API directly. Without this, `MAIL_MAILER`
        // is inert here: phpunit.xml sets it to `array` expecting no mail to
        // leave the machine, but every test that registered a user or asked
        // for a password reset still sent live email on the production Resend
        // account (~200 in one day on 2026-08-23, blowing the daily quota).
        //
        // `log` and `array` are the conventional "don't actually deliver"
        // drivers; honour both, and record what would have been sent.
        $mailer = config('mail.default');
        if (in_array($mailer, ['array', 'null'], true) || app()->runningUnitTests()) {
            Log::info('Email suppressed (non-delivering mailer)', [
                'to' => $to, 'subject' => $subject, 'mailer' => $mailer,
            ]);
            return;
        }

        if (! $apiKey) {
            Log::warning('Resend API key not configured, skipping email', ['to' => $to]);
            return;
        }

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$apiKey}",
        ])->post(self::RESEND_URL, [
            'from' => $from,
            'to' => $to,
            'subject' => $subject,
            'html' => $html,
        ]);

        if ($response->failed()) {
            Log::error('Resend email error', ['to' => $to, 'status' => $response->status(), 'body' => $response->body()]);
            throw new \RuntimeException('Failed to send email: ' . $response->status());
        }

        Log::info('Email sent', ['to' => $to, 'subject' => $subject]);
    }

    private function buildConfirmUrl(string $tokenHash, string $type, string $redirectTo): string
    {
        $baseUrl = config('app.url');
        return "{$baseUrl}/auth/verify?token={$tokenHash}&type={$type}&redirect_to=" . urlencode($redirectTo);
    }

    private function renderEmail(
        string $heading,
        string $body,
        ?string $buttonText = null,
        ?string $buttonUrl = null,
        string $footer = "If you didn't request this, you can safely ignore this email.",
    ): string {
        $year = date('Y');
        $platform = self::PLATFORM_NAME;
        $button = $buttonText && $buttonUrl
            ? '<tr><td align="center" style="padding-bottom:32px;"><a href="' . e($buttonUrl) . '" style="display:inline-block;background:#5b50e8;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;">' . e($buttonText) . '</a></td></tr>'
            : '';

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>{$heading} — {$platform}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
          <tr><td align="center">
            <div style="width:72px;height:72px;background:#5b50e8;border-radius:18px;margin:0 auto 24px;line-height:72px;text-align:center;font-size:28px;">&#127947;</div>
          </td></tr>
          <tr>
            <td style="background:#ffffff;border-radius:20px;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,0.07);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="center" style="padding-bottom:10px;">
                  <h1 style="margin:0;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.3px;">{$heading}</h1>
                </td></tr>
                <tr><td align="center" style="padding-bottom:32px;">
                  <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.65;max-width:380px;">{$body}</p>
                </td></tr>
                {$button}
                <tr><td style="border-top:1px solid #f0f0f0;padding-top:22px;">
                  <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;text-align:center;">{$footer}</p>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr><td align="center" style="padding-top:22px;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; {$year} {$platform}. All rights reserved.</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
    }
}
