<?php

namespace App\Support;

/**
 * Gym brand colours (gyms.branding_config.primary_color / secondary_color).
 *
 * The member app always draws WHITE text and icons on the brand colours
 * (AppTheme sets onPrimary/onSecondary to white; buttons, the membership
 * card gradient and its labels are white-on-brand). A colour that white
 * text can't be read on would make the app unusable.
 *
 * - primary: button labels, the selected nav item and "See all" links are
 *   drawn in/on it, so it must reach WCAG's 3:1 (large/bold text) against
 *   white.
 * - secondary: only the far end of the membership-card gradient, where
 *   little text sits. The platform's own default (#818cf8) is ~1.8:1, so
 *   only near-white values (< 1.5:1), which would swallow the card's white
 *   labels and pill, are rejected.
 */
final class BrandColors
{
    /** Platform default — matches the gyms.branding_config column default. */
    public const DEFAULT = [
        'icon_url' => null,
        'logo_url' => null,
        'splash_url' => null,
        'font_family' => 'System',
        'primary_color' => '#4f46e5',
        'secondary_color' => '#818cf8',
    ];

    public const HEX_RULE = 'regex:/^#[0-9A-Fa-f]{6}$/';

    public const MIN_CONTRAST = ['primary' => 3.0, 'secondary' => 1.5];

    public static function contrastWithWhite(string $hex): float
    {
        $l = self::luminance($hex);
        return (1.0 + 0.05) / ($l + 0.05);
    }

    private static function luminance(string $hex): float
    {
        $hex = ltrim($hex, '#');
        $channels = [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
        [$r, $g, $b] = array_map(function (int $c): float {
            $s = $c / 255;
            return $s <= 0.03928 ? $s / 12.92 : (($s + 0.055) / 1.055) ** 2.4;
        }, $channels);
        return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
    }

    /** Validation rule list for one brand colour field ('primary'|'secondary'). */
    public static function rule(string $role): array
    {
        $min = self::MIN_CONTRAST[$role];
        return [
            'nullable',
            'string',
            self::HEX_RULE,
            function (string $attribute, mixed $value, \Closure $fail) use ($min) {
                if (is_string($value) && preg_match('/^#[0-9A-Fa-f]{6}$/', $value)
                    && self::contrastWithWhite($value) < $min) {
                    $fail('This colour is too light: white text on it would be hard to read in the app. Choose a darker shade.');
                }
            },
        ];
    }
}
