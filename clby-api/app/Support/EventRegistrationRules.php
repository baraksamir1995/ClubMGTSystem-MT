<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Who may register for an event, shared by EventController (free events)
 * and PaymobController (paid events, registration created at intention).
 *
 * Seats: confirmed registrations, plus pending_payment ones touched in the
 * last HOLD_MINUTES (a checkout in progress holds its seat briefly, an
 * abandoned one releases it).
 */
final class EventRegistrationRules
{
    public const HOLD_MINUTES = 30;

    /** Plan ids an event is restricted to ([] = open to every member). */
    public static function planTargets(string $eventId): array
    {
        return DB::table('event_plan_targets')->where('event_id', $eventId)->pluck('plan_id')->all();
    }

    /** Whether the member holds an active membership on one of the plans. */
    public static function memberHasPlan(string $memberId, array $planIds): bool
    {
        if (empty($planIds)) return true;
        return DB::table('member_memberships')
            ->where('gym_member_id', $memberId)
            ->where('status', 'active')
            ->whereIn('plan_id', $planIds)
            ->exists();
    }

    public static function seatsTaken(string $eventId, ?string $exceptMemberId = null): int
    {
        return DB::table('event_registrations')
            ->where('event_id', $eventId)
            ->when($exceptMemberId, fn ($q) => $q->where('gym_member_id', '!=', $exceptMemberId))
            ->where(function ($q) {
                $q->where('status', 'confirmed')
                  ->orWhere(fn ($q2) => $q2->where('status', 'pending_payment')
                      ->where('updated_at', '>=', now()->subMinutes(self::HOLD_MINUTES)));
            })
            ->count();
    }

    /**
     * Validate that $memberId may register for $event (a published row from
     * the caller's gym). Returns null when allowed, else
     * ['error' => string, 'code' => string, 'status' => int].
     */
    public static function check(object $event, string $memberId): ?array
    {
        if (! self::memberHasPlan($memberId, self::planTargets($event->id))) {
            return ['error' => 'This event is only open to members on specific plans.', 'code' => 'plan_required', 'status' => 403];
        }
        if ($event->registration_deadline && now()->greaterThan($event->registration_deadline)) {
            return ['error' => 'Registration is closed.', 'code' => 'registration_closed', 'status' => 422];
        }
        if (now()->greaterThan($event->ends_at ?? $event->starts_at)) {
            return ['error' => 'This event has already taken place.', 'code' => 'event_past', 'status' => 422];
        }
        $confirmed = DB::table('event_registrations')
            ->where('event_id', $event->id)->where('gym_member_id', $memberId)
            ->where('status', 'confirmed')->exists();
        if ($confirmed) {
            return ['error' => 'You are already registered for this event.', 'code' => 'already_registered', 'status' => 422];
        }
        if ($event->capacity !== null && self::seatsTaken($event->id, $memberId) >= (int) $event->capacity) {
            return ['error' => 'This event is full.', 'code' => 'event_full', 'status' => 422];
        }
        return null;
    }

    /**
     * Create or reopen the member's registration with the given status.
     * (event_id, gym_member_id) is unique, so a cancelled or abandoned row is
     * reused. Returns the registration id. Call inside a transaction.
     */
    public static function upsert(object $event, string $memberId, ?string $actorId, string $status, string $paymentStatus, array $config): string
    {
        $existing = DB::table('event_registrations')
            ->where('event_id', $event->id)->where('gym_member_id', $memberId)
            ->lockForUpdate()->first();

        $values = [
            'status' => $status,
            'payment_status' => $paymentStatus,
            'event_configuration_id' => $config['id'],
            'configuration_name' => $config['name'],
            'registered_by' => $actorId,
            'updated_at' => now(),
        ];
        if ($existing) {
            DB::table('event_registrations')->where('id', $existing->id)->update($values);
            return $existing->id;
        }
        $id = (string) \Illuminate\Support\Str::uuid();
        DB::table('event_registrations')->insert($values + [
            'id' => $id,
            'gym_id' => $event->gym_id,
            'event_id' => $event->id,
            'gym_member_id' => $memberId,
            'attended' => false,
            'created_at' => now(),
        ]);
        return $id;
    }
}
