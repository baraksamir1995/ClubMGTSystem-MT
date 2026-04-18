import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CLBY — All-in-one gym access",
  description:
    "Gateway · motion · access. Discover gyms, book classes, and manage everything from one app. Built for MENA, bilingual, mobile-first.",
  openGraph: {
    title: "CLBY — All-in-one gym access",
    description:
      "Gateway · motion · access. Discover gyms, book classes, and manage everything from one app.",
    url: "https://clby.app",
    siteName: "CLBY",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CLBY — All-in-one gym access",
    description:
      "Gateway · motion · access. Discover gyms, book classes, and manage everything from one app.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="grain antialiased">{children}</body>
    </html>
  );
}
