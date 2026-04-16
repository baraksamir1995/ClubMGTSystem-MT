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
  title: "CLBY — Run your club from your phone",
  description:
    "The gym management platform built for MENA. Bilingual, mobile-first, branded member app included. Join 10 founding gyms across Egypt.",
  openGraph: {
    title: "CLBY — Run your club from your phone",
    description:
      "The gym management platform built for MENA. Bilingual, mobile-first, branded member app included.",
    url: "https://clby.app",
    siteName: "CLBY",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CLBY — Run your club from your phone",
    description:
      "The gym management platform built for MENA. Bilingual, mobile-first, branded member app included.",
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
