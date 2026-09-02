import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, defaultLocale, LOCALE_COOKIE, type Locale } from './config';

// Re-export the client-safe constants so existing `@/i18n/request` imports
// keep working; the actual definitions live in ./config (no server-only deps).
export { locales, defaultLocale, rtlLocales, isRtl, LOCALE_COOKIE } from './config';
export type { Locale } from './config';

/**
 * next-intl request config — cookie-based, no URL routing. Runs per request
 * on the server; the chosen locale + its messages flow into every server
 * component and the client provider in the root layout.
 */
// One namespace per file under messages/<locale>/<ns>.json. Each module owns
// its own namespace so they can be edited independently. Add new modules here
// as they're localized.
export const namespaces = [
  'common',
  'nav',
  'layout',
  'auth',
  'overview',
  'members',
  'plans',
  'payments',
  'sales',
  'classes',
  'promotions',
  'services',
  'attendance',
  'invitations',
  'content',
  'analytics',
  'staff',
  'settings',
  'help',
] as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requested = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale;

  // Merge every namespace file into a single messages object keyed by
  // namespace (the shape next-intl expects: messages[ns][key]).
  const entries = await Promise.all(
    namespaces.map(async (ns) => {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );

  return {
    locale,
    messages: Object.fromEntries(entries),
  };
});
