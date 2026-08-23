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

    private function renderEmail(string $heading, string $body, string $buttonText, string $buttonUrl): string
    {
        $year = date('Y');
        $platform = self::PLATFORM_NAME;

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
                <tr><td align="center" style="padding-bottom:32px;">
                  <a href="{$buttonUrl}" style="display:inline-block;background:#5b50e8;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;">{$buttonText}</a>
                </td></tr>
                <tr><td style="border-top:1px solid #f0f0f0;padding-top:22px;">
                  <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
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
