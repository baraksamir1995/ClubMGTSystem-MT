<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Helpers for dynamic event configurations (admin-defined options such as belt
 * colours). Shared by EventController (admin CRUD, guardian registration) and
 * PaymobController (paid registration created at intention time) so both paths
 * enforce the same rule: when an event has configurations, a registrant must
 * pick exactly one that belongs to that event.
 */
final class EventConfigurations
{
    /** Ordered configurations keyed by event id: [event_id => [['id','name','sort_order'], …]]. */
    public static function forEvents(array $eventIds): array
    {
        if (empty($eventIds)) return [];

        $rows = DB::table('event_configurations')
            ->whereIn('event_id', $eventIds)
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get(['id', 'event_id', 'name', 'sort_order']);

        $byEvent = [];
        foreach ($rows as $r) {
            $byEvent[$r->event_id][] = [
                'id' => $r->id,
                'name' => $r->name,
                'sort_order' => (int) $r->sort_order,
            ];
        }
        return $byEvent;
    }

    /** Ordered configurations for one event. */
    public static function forEvent(string $eventId): array
    {
        return self::forEvents([$eventId])[$eventId] ?? [];
    }

    /**
     * Validate a registrant's selection against the event's configurations.
     *
     * Returns ['id' => ?string, 'name' => ?string] on success (both null when the
     * event has no configurations), or ['error' => string, 'code' => string] when
     * the selection is missing or does not belong to this event.
     */
    public static function resolveSelection(string $eventId, ?string $configurationId): array
    {
        $configs = self::forEvent($eventId);
        if (empty($configs)) {
            // Event does not use configurations; ignore anything the client sent.
            return ['id' => null, 'name' => null];
        }

        if (! $configurationId) {
            return [
                'error' => 'Please choose an option for this event.',
                'code' => 'configuration_required',
            ];
        }

        foreach ($configs as $c) {
            if ($c['id'] === $configurationId) {
                return ['id' => $c['id'], 'name' => $c['name']];
            }
        }

        return [
            'error' => 'The selected option is not available for this event.',
            'code' => 'configuration_invalid',
        ];
    }

    /**
     * Replace an event's configurations with the given ordered list.
     *
     * Each item: ['id' => ?uuid, 'name' => string]. Items with a known id are
     * renamed/reordered in place (so existing registrations keep pointing at
     * them); items without an id are inserted; configurations absent from the
     * list are deleted (registrations keep their configuration_name snapshot and
     * the FK is nulled by the schema).
     */
    public static function sync(string $eventId, array $items): void
    {
        $existingIds = DB::table('event_configurations')
            ->where('event_id', $eventId)
            ->pluck('id')
            ->all();

        $keep = [];
        foreach (array_values($items) as $i => $item) {
            $name = trim((string) ($item['name'] ?? ''));
            if ($name === '') continue;
            $id = $item['id'] ?? null;

            if ($id && in_array($id, $existingIds, true)) {
                DB::table('event_configurations')->where('id', $id)->update([
                    'name' => $name,
                    'sort_order' => $i,
                    'updated_at' => now(),
                ]);
                $keep[] = $id;
            } else {
                $id = Str::uuid()->toString();
                DB::table('event_configurations')->insert([
                    'id' => $id,
                    'event_id' => $eventId,
                    'name' => $name,
                    'sort_order' => $i,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $keep[] = $id;
            }
        }

        $remove = array_diff($existingIds, $keep);
        if (! empty($remove)) {
            DB::table('event_configurations')->whereIn('id', $remove)->delete();
        }
    }
}
