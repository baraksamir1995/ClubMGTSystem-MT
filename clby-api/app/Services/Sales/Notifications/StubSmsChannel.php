<?php

namespace App\Services\Sales\Notifications;

use Illuminate\Support\Facades\Log;

/** Placeholder until an SMS gateway is wired up. */
class StubSmsChannel implements NotificationChannel
{
    public function channel(): string
    {
        return 'sms';
    }

    public function send(string $to, string $body): string
    {
        Log::info('[sales-notify] sms (stub)', ['to' => $to, 'body' => $body]);
        return 'stubbed';
    }
}
