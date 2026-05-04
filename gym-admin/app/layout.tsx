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
    <html lang="en">
      <body className="font-sans">
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
