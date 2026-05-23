// Client-safe i18n constants. MUST NOT import `next/headers` or any
// server-only module — this file is imported by client components
// (the language switcher) as well as the server request config.

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Locales that render right-to-left. */
export const rtlLocales: Locale[] = ['ar'];
export const isRtl = (locale: string) => rtlLocales.includes(locale as Locale);

/** Cookie that holds the active locale (set by the language switcher). */
export const LOCALE_COOKIE = 'locale';
