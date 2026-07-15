import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { isRtl } from '@/i18n/config';
import { ThemeScript } from '@/components/theme/theme-script';
import './globals.css';

// next/font/google fetches the font at build time, which fails inside
// Coolify's sandboxed Docker build (no outbound DNS to Google's CDN).
// We rely on the system font stack instead — Tailwind's default `font-sans`
// resolves to Inter / SF Pro / system-ui on every modern OS and matches the
// previous look without a network round-trip.

export const metadata: Metadata = {
  title: 'Admin Panel',
  description: 'Gym / Club Management System - Admin Panel',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Locale + messages come from the cookie-based request config
  // (i18n/request.ts). `dir` flips the whole app to RTL for Arabic.
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = isRtl(locale) ? 'rtl' : 'ltr';

  return (
    // suppressHydrationWarning: ThemeScript stamps `data-theme` on <html>
    // before hydration, which the server render can't know about.
    <html lang={locale} dir={dir} className="bg-surface" suppressHydrationWarning>
      {/* Theme background lives on <html> AND <body> so every page —
          including ones that forget to set their own bg — defaults to
          the themed surface instead of the browser's white. */}
      <body className="font-sans bg-surface text-fg">
        {/* Must be the FIRST thing in body: blocks paint until the
            resolved theme is applied, preventing a wrong-theme flash. */}
        <ThemeScript />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Toaster position="top-right" />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
