<?php

namespace App\Jobs;

use App\Services\PushService;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Sends a gym-wide announcement push to a chunk of recipients.
 *
 * NotificationController::store dispatches one of these per ~50-user
 * chunk so the admin's HTTP request returns immediately and the work
 * happens in the queue worker rather than blocking PHP-FPM threads.
 */
class SendGymAnnouncementPush implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Retry the whole chunk once on transient failure (DB hiccup,
     * Firebase auth blip). Per-token NotFound errors are handled inside
     * PushService and don't bubble up.
     */
    public int $tries = 2;

    /**
     * Bound the run-time so a stuck job doesn't tie up the worker forever.
     */
    public int $timeout = 60;

    /**
     * @param  array<string>  $userIds
     * @param  array<string, string>  $data
     */
    public function __construct(
        public array $userIds,
        public string $title,
        public string $body,
        public array $data = [],
    ) {}

    public function handle(PushService $push): void
    {
        if (! $push->isConfigured()) return;
        $push->sendToUsers($this->userIds, $this->title, $this->body, $this->data);
    }
}
