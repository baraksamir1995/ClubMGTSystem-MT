<?php

namespace App\Services\Sales\Notifications;

/**
 * Outbound-message driver contract for sales notifications (appointment
 * reminders, etc.). Real gateway integrations implement this; every send
 * is logged to sales_outbound_messages by the dispatcher regardless of
 * driver.
 */
interface NotificationChannel
{
    /** Channel key stored on the log row (e.g. 'whatsapp', 'sms'). */
    public function channel(): string;

    /**
     * Deliver $body to E.164 number $to.
     *
     * @return string resulting status: 'sent'|'failed'|'stubbed'
     */
    public function send(string $to, string $body): string;
}
