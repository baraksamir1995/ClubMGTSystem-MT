<?php

namespace App\Support;

/**
 * Closed allowlist + normaliser for gyms.app_layout (mobile Home / Explore
 * section order and visibility).
 *
 * Keys here MUST match the section keys the Flutter app knows
 * (lib/models/app_layout.dart) and the gym-admin editor
 * (lib/app-layout.ts). Adding a section = add the key in all three.
 */
final class AppLayout
{
    public const SCREENS = [
        'home' => ['banners', 'membership', 'todays_classes', 'activity', 'quick_access', 'locations'],
        'explore' => ['memberships', 'offers', 'trainers', 'services', 'programs', 'session_packages', 'partners'],
    ];

    /**
     * Drop unknown screens/keys and duplicates, coerce `visible` to bool,
     * and append any allowlisted key that is missing (visible) in default
     * order. Returns null for null or non-array input (= app default), so
     * a malformed stored value can't 500 the public gym endpoint.
     */
    public static function normalize(mixed $layout): ?array
    {
        if (! is_array($layout)) {
            return null;
        }

        $out = [];
        foreach (self::SCREENS as $screen => $allowed) {
            $items = is_array($layout[$screen] ?? null) ? $layout[$screen] : [];
            $seen = [];
            $rows = [];
            foreach ($items as $item) {
                $key = is_array($item) ? ($item['key'] ?? null) : null;
                if (! is_string($key) || ! in_array($key, $allowed, true) || isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $rows[] = ['key' => $key, 'visible' => (bool) ($item['visible'] ?? true)];
            }
            foreach ($allowed as $key) {
                if (! isset($seen[$key])) {
                    $rows[] = ['key' => $key, 'visible' => true];
                }
            }
            $out[$screen] = $rows;
        }

        return $out;
    }
}
