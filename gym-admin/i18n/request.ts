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
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requested = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
