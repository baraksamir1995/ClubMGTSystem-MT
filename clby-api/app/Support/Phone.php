<?php

namespace App\Support;

/**
 * Minimal E.164 normalizer. Leads are stored E.164; Egyptian local
 * numbers (01XXXXXXXXX) get the +20 country code by default since that's
 * where the current tenants operate. Anything already prefixed with +
 * is kept as-is (digits only).
 */
class Phone
{
    public static function toE164(string $raw, string $defaultCountry = '20'): ?string
    {
        $hasPlus = str_starts_with(trim($raw), '+');
        $digits = preg_replace('/\D+/', '', $raw);
        if ($digits === '' || strlen($digits) < 7) {
            return null;
        }

        if ($hasPlus) {
            $e164 = '+' . $digits;
        } elseif (str_starts_with($digits, '00')) {
            // 00-prefixed international
            $e164 = '+' . substr($digits, 2);
        } elseif (str_starts_with($digits, '0')) {
            // Local number starting with 0 → strip and prepend default country
            $e164 = '+' . $defaultCountry . substr($digits, 1);
        } elseif (str_starts_with($digits, $defaultCountry)) {
            // Already includes a country code (e.g. 201XXXXXXXXX)
            $e164 = '+' . $digits;
        } else {
            $e164 = '+' . $defaultCountry . $digits;
        }

        // E.164 caps the national+country number at 15 digits. Validate the
        // NORMALIZED result (not the raw input) so a bare local number whose
        // country prefix pushes it over the limit is rejected with a clean
        // 422 rather than producing an out-of-spec / column-overflowing value.
        $normalizedDigits = strlen($e164) - 1; // minus the leading '+'
        if ($normalizedDigits > 15) {
            return null;
        }

        return $e164;
    }
}
