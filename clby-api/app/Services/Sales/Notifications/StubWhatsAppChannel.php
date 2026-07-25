<?php

namespace App\Services\Sales\Notifications;

use Illuminate\Support\Facades\Log;

/** Placeholder until a WhatsApp Business API gateway is wired up. */
class StubWhatsAppChannel implements NotificationChannel
{
    public function channel(): string
    {
        return 'whatsapp';
    }

    public function send(string $to, string $body): string
    {
        Log::info('[sales-notify] whatsapp (stub)', ['to' => $to, 'body' => $body]);
        return 'stubbed';
    }
}
