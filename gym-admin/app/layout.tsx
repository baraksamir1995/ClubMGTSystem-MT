import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-clby-bg">
      {/* Brand background lives on <html> AND <body> so every page —
          including ones that forget to set their own bg — defaults to
          the near-black brand surface instead of the browser's white. */}
      <body className="font-sans bg-clby-bg text-clby-fg">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
