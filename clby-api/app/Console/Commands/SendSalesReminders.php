<?php

namespace App\Console\Commands;

use App\Models\Sales\SalesAppointment;
use App\Models\Sales\SalesSetting;
use App\Services\Sales\Notifications\OutboundMessenger;
use App\Services\Sales\Notifications\StubWhatsAppChannel;
use Illuminate\Console\Command;

/**
 * Queues the 24h / 2h appointment reminders (offsets configurable per
 * gym in sales_settings.reminder_hours). Intended to run every 15min
 * from the scheduler. Delivery goes through the NotificationChannel
 * abstraction — currently the WhatsApp stub, which logs instead of
 * sending; every attempt is recorded in sales_outbound_messages.
 */
class SendSalesReminders extends Command
{
    protected $signature = 'sales:send-reminders';
    protected $description = 'Send pending 24h/2h sales appointment reminders';

    public function handle(OutboundMessenger $messenger, StubWhatsAppChannel $channel): int
    {
        $sent = 0;

        $upcoming = SalesAppointment::where('status', 'scheduled')
            ->whereBetween('scheduled_at', [now(), now()->addHours(48)])
            ->with('lead:id,name,phone,gym_id')
            ->get();

        // Preload settings once per distinct gym (avoids a per-appointment
        // firstOrCreate query on every scheduler tick).
        $settingsByGym = SalesSetting::whereIn('gym_id', $upcoming->pluck('gym_id')->unique())
            ->get()->keyBy('gym_id');

        foreach ($upcoming as $appointment) {
            if (! $appointment->lead) {
                continue;
            }
            $settings = $settingsByGym->get($appointment->gym_id)
                ?? SalesSetting::forGym($appointment->gym_id);

            // Fire the closest not-yet-sent offset whose window has opened.
            // Offsets are hours-before; a slot is due once we're within it
            // but not yet inside the next (smaller) one, so a single tick
            // never double-sends and a missed tick still catches up.
            $offsets = collect($settings->reminderHours())->sort()->values(); // ascending
            $alreadySent = $appointment->reminders_sent ?? [];
            $hoursAway = now()->diffInMinutes($appointment->scheduled_at, false) / 60;
            if ($hoursAway <= 0) {
                continue;
            }

            // Offsets are ascending; the first match is the closest (smallest)
            // window that has opened and not yet been sent — break there.
            $dueOffset = null;
            foreach ($offsets as $offset) {
                if ($hoursAway <= $offset && ! in_array($offset, $alreadySent, true)) {
                    $dueOffset = $offset;
                    break;
                }
            }
            if ($dueOffset === null) {
                continue;
            }

            $when = $appointment->scheduled_at->format('D d M, H:i');
            $messenger->send(
                $channel,
                $appointment->gym_id,
                $appointment->lead_id,
                $appointment->lead->phone,
                "Hi {$appointment->lead->name}! Reminder: your {$appointment->type} is on {$when}. See you there!",
            );
            // Mark this offset and every larger one sent — if we skipped a
            // wider window (missed tick), it shouldn't fire retroactively.
            $appointment->update([
                'reminders_sent' => $offsets->filter(fn ($o) => $o >= $dueOffset)
                    ->concat($alreadySent)->unique()->sort()->values()->all(),
            ]);
            $sent++;
        }

        $this->info("Sent {$sent} reminder(s).");
        return self::SUCCESS;
    }
}
