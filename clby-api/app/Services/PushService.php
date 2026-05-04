<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Exception\Messaging\NotFound;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification as FcmNotification;

/**
 * Sends FCM push notifications via Firebase Cloud Messaging.
 *
 * Reads credentials from FIREBASE_CREDENTIALS env (absolute path to a
 * Google service-account JSON file). On Coolify the file is mounted via
 * a persistent volume; locally it can sit in storage/app/firebase.json.
 *
 * If credentials are missing the service silently no-ops so the rest of
 * the app keeps working in environments where pushes aren't configured.
 */
class PushService
{
    private ?Messaging $messaging = null;

    public function __construct()
    {
        $credentials = env('FIREBASE_CREDENTIALS');
        if (! $credentials || ! is_file($credentials)) {
            return;
        }

        try {
            $this->messaging = (new Factory)
                ->withServiceAccount($credentials)
                ->createMessaging();
        } catch (\Throwable $e) {
            Log::warning('[PushService] Firebase init failed: ' . $e->getMessage());
        }
    }

    public function isConfigured(): bool
    {
        return $this->messaging !== null;
    }

    /**
     * Send a push to a single user (by profile id).
     *
     * @param  array<string, string>  $data  Custom data payload (everything
     *                                       must be a string per FCM spec).
     */
    public function sendToUser(
        string $userId,
        string $title,
        string $body,
        array $data = []
    ): bool {
        if (! $this->messaging) return false;

        $token = DB::table('profiles')
            ->where('id', $userId)
            ->value('fcm_token');

        if (! $token) return false;

        return $this->sendToToken($token, $title, $body, $data, $userId);
    }

    /**
     * Send a push to a raw FCM token. Returns true on success.
     */
    public function sendToToken(
        string $token,
        string $title,
        string $body,
        array $data = [],
        ?string $userId = null
    ): bool {
        if (! $this->messaging) return false;

        $message = CloudMessage::withTarget('token', $token)
            ->withNotification(FcmNotification::create($title, $body))
            ->withDefaultSounds()
            ->withData(array_map('strval', $data));

        try {
            $this->messaging->send($message);
            return true;
        } catch (NotFound $e) {
            // Token is no longer valid — clear it so we stop retrying.
            if ($userId) {
                DB::table('profiles')->where('id', $userId)->update(['fcm_token' => null]);
            }
            Log::info('[PushService] FCM token expired, cleared for user ' . ($userId ?? '?'));
            return false;
        } catch (\Throwable $e) {
            Log::warning('[PushService] FCM send failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send a push to many users (best-effort, individual sends).
     *
     * @param  iterable<string>  $userIds
     * @return int  Count of successful sends
     */
    public function sendToUsers(
        iterable $userIds,
        string $title,
        string $body,
        array $data = []
    ): int {
        $sent = 0;
        foreach ($userIds as $userId) {
            if ($this->sendToUser($userId, $title, $body, $data)) $sent++;
        }
        return $sent;
    }
}
