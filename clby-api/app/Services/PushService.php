<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Exception\Messaging\NotFound;
use Kreait\Firebase\Exception\MessagingException;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification as FcmNotification;

/**
 * Sends FCM push notifications via Firebase Cloud Messaging.
 *
 * Credential paths come from config/firebase.php: a default project
 * (CLBY marketplace + Shift) plus optional per-gym white-label projects
 * (The Barn, AlfaG). An FCM token only works with the project of the app
 * install that produced it, and a member of a white-label gym may be on
 * either that gym's branded app or the CLBY marketplace app — so sends
 * try the member's brand project first, then fall back to the default
 * project when the token turns out to belong to the other one.
 *
 * If no credentials are configured the service silently no-ops so the
 * rest of the app keeps working in environments without push.
 */
class PushService
{
    private ?Messaging $default = null;

    /** @var array<string, Messaging|null> Lazily-built per-gym clients. */
    private array $brands = [];

    public function __construct()
    {
        $this->default = $this->makeMessaging(config('firebase.default'));
    }

    public function isConfigured(): bool
    {
        if ($this->default !== null) {
            return true;
        }
        foreach (array_keys((array) config('firebase.brands')) as $gymId) {
            if ($this->brandMessaging($gymId) !== null) {
                return true;
            }
        }

        return false;
    }

    private function makeMessaging(?string $credentials): ?Messaging
    {
        if (! $credentials || ! is_file($credentials)) {
            return null;
        }

        try {
            return (new Factory)
                ->withServiceAccount($credentials)
                ->createMessaging();
        } catch (\Throwable $e) {
            Log::warning('[PushService] Firebase init failed: ' . $e->getMessage());

            return null;
        }
    }

    private function brandMessaging(?string $gymId): ?Messaging
    {
        if (! $gymId || ! isset(config('firebase.brands')[$gymId])) {
            return null;
        }
        if (! array_key_exists($gymId, $this->brands)) {
            $this->brands[$gymId] = $this->makeMessaging(config('firebase.brands')[$gymId]);
        }

        return $this->brands[$gymId];
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
        $profile = DB::table('profiles')
            ->where('id', $userId)
            ->first(['fcm_token', 'gym_id']);

        if (! $profile || ! $profile->fcm_token) return false;

        return $this->sendToToken(
            $profile->fcm_token, $title, $body, $data, $userId, $profile->gym_id
        );
    }

    /**
     * Send a push to a raw FCM token. Returns true on success.
     *
     * Tries the gym's white-label Firebase project first (when one is
     * configured), then the default project. A token registered under one
     * project is rejected by the other with NotFound / SenderId mismatch,
     * so a failure on the first candidate is expected and just means the
     * install belongs to the other app.
     */
    public function sendToToken(
        string $token,
        string $title,
        string $body,
        array $data = [],
        ?string $userId = null,
        ?string $gymId = null
    ): bool {
        $candidates = [];
        if ($brand = $this->brandMessaging($gymId)) {
            $candidates[] = $brand;
        }
        if ($this->default) {
            $candidates[] = $this->default;
        }
        if (! $candidates) return false;

        // kreait/firebase-php v8 dropped the static `withTarget('token', $t)`
        // factory in favour of `CloudMessage::new()->toToken($t)`. Older docs
        // still reference the v6 API — don't trust them.
        $message = CloudMessage::new()
            ->toToken($token)
            ->withNotification(FcmNotification::create($title, $body))
            ->withDefaultSounds()
            ->withData(array_map('strval', $data));

        $lastNotFound = false;
        foreach ($candidates as $messaging) {
            try {
                $messaging->send($message);

                return true;
            } catch (NotFound $e) {
                // Unknown to this project — either expired, or registered
                // under the other candidate. Only conclusive after every
                // candidate has rejected it.
                $lastNotFound = true;
            } catch (MessagingException $e) {
                // SenderId mismatch and friends — token belongs to another
                // project. Try the next candidate.
                $lastNotFound = false;
                Log::info('[PushService] FCM send rejected, trying next project: ' . $e->getMessage());
            } catch (\Throwable $e) {
                Log::warning('[PushService] FCM send failed: ' . $e->getMessage());

                return false;
            }
        }

        if ($lastNotFound && $userId) {
            // Every configured project says the token doesn't exist — it's
            // dead. Clear it so we stop retrying.
            DB::table('profiles')->where('id', $userId)->update(['fcm_token' => null]);
            Log::info('[PushService] FCM token expired, cleared for user ' . $userId);
        }

        return false;
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
