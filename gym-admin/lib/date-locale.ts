/**
 * BCP-47 locale string for `Intl` / `toLocaleDateString` / `toLocaleTimeString`.
 *
 * For Arabic we use `ar-EG-u-nu-latn` — Arabic month/weekday names but
 * Western (Latin) digits, to stay consistent with the rest of the app's
 * numerals (prices, counts) which render in Western digits.
 *
 * Usage in a client component:
 *   const locale = useLocale();
 *   date.toLocaleDateString(dateLocale(locale), { month: 'short', … });
 */
export function dateLocale(locale: string): string {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
}
