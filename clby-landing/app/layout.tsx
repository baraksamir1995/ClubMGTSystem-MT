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

const SITE_URL = "https://clbyapp.com";
const TITLE = "CLBY — Gym & Club Management Software for MENA";
const DESCRIPTION =
  "CLBY is the all-in-one gym management platform built for MENA: a branded member app, QR check-in, class bookings, local payments, and reports. Mobile-first, bilingual, set up in one afternoon.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · CLBY",
  },
  description: DESCRIPTION,
  applicationName: "CLBY",
  keywords: [
    "gym management software",
    "club management software",
    "gym software MENA",
    "gym software Egypt",
    "branded gym app",
    "white-label gym app",
    "gym membership management",
    "class booking software",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "CLBY",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "CLBY",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      description: DESCRIPTION,
      foundingLocation: { "@type": "Place", name: "Cairo, Egypt" },
      areaServed: "MENA",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: "+20-102-782-3660",
        availableLanguage: ["en", "ar"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "CLBY",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "CLBY",
      applicationCategory: "BusinessApplication",
      operatingSystem: "iOS, Android, Web",
      description: DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "5000",
        priceCurrency: "EGP",
        description: "Marketplace plan — listed on the CLBY app, unlimited members.",
      },
    },
  ],
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
      <body className="grain antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
