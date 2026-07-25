<?php

namespace App\Services\Sales\Notifications;

use App\Models\Sales\SalesOutboundMessage;

/**
 * Dispatches through a NotificationChannel and logs every attempt to
 * sales_outbound_messages (spec: "log all outbound messages").
 */
class OutboundMessenger
{
    public function send(NotificationChannel $via, string $gymId, ?string $leadId, string $to, string $body): SalesOutboundMessage
    {
        $status = $via->send($to, $body);

        return SalesOutboundMessage::create([
            'gym_id' => $gymId,
            'lead_id' => $leadId,
            'channel' => $via->channel(),
            'to' => $to,
            'body' => $body,
            'status' => $status,
        ]);
    }
}
