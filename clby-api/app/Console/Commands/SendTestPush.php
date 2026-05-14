<?php

namespace App\Console\Commands;

use App\Services\PushService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SendTestPush extends Command
{
    protected $signature = 'push:test
        {--user= : Profile ID OR email of recipient}
        {--title=Hello : Notification title}
        {--body=Test push from CLBY : Notification body}';

    protected $description = 'Send a test FCM push to a single user (by profile id or email).';

    public function handle(PushService $push): int
    {
        if (! $push->isConfigured()) {
            $this->error('Push service not configured. Set FIREBASE_CREDENTIALS env to a service-account JSON path.');
            return self::FAILURE;
        }

        $userArg = $this->option('user') ?? $this->ask('Recipient (profile id or email)');
        // profiles.id is uuid — comparing against a non-uuid string raises
        // SQLSTATE 22P02 at the driver level before the email-clause
        // can even fire. Pick the lookup column up front.
        $row = Str::isUuid($userArg)
            ? DB::table('profiles')->where('id', $userArg)->first()
            : DB::table('profiles')->where('email', $userArg)->first();
        if (! $row) {
            $this->error("No user matched '$userArg'.");
            return self::FAILURE;
        }
        if (! $row->fcm_token) {
            $this->error("User {$row->email} has no fcm_token (they need to open the mobile app and grant notifications first).");
            return self::FAILURE;
        }

        $this->line("Sending to {$row->email}…");
        $ok = $push->sendToUser(
            $row->id,
            $this->option('title'),
            $this->option('body'),
            ['type' => 'test'],
        );

        if ($ok) {
            $this->info('✓ Push sent.');
            return self::SUCCESS;
        }

        $this->error('✗ Push send failed. Check storage/logs/laravel.log for details.');
        return self::FAILURE;
    }
}
