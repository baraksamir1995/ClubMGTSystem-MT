import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/config";
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
    // English — generic
    "gym management software",
    "club management software",
    "fitness club software",
    "gym membership management",
    "class booking software",
    "branded gym app",
    "white-label gym app",
    // English — geo
    "gym software MENA",
    "gym software Egypt",
    "gym software Saudi Arabia",
    "gym software UAE",
    "gym software Dubai",
    "gym software Riyadh",
    "gym software Cairo",
    "gym management Egypt",
    "gym management Saudi Arabia",
    "gym management UAE",
    // Arabic transliteration
    "برنامج إدارة الجيم",
    "تطبيق إدارة النادي الرياضي",
    "برنامج إدارة النادي الرياضي",
    "نظام إدارة الصالات الرياضية",
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
    alternateLocale: ["ar_EG", "ar_SA", "ar_AE"],
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
  other: {
    "geo.region": "EG",
    "geo.placename": "Cairo, Egypt",
    "geo.position": "30.0444;31.2357",
    "ICBM": "30.0444, 31.2357",
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
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
        width: 512,
        height: 512,
      },
      description: DESCRIPTION,
      foundingLocation: {
        "@type": "Place",
        name: "Cairo, Egypt",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Cairo",
          addressCountry: "EG",
        },
      },
      areaServed: [
        { "@type": "Country", name: "Egypt" },
        { "@type": "Country", name: "Saudi Arabia" },
        { "@type": "Country", name: "United Arab Emirates" },
        { "@type": "Country", name: "Kuwait" },
        { "@type": "Country", name: "Bahrain" },
        { "@type": "Country", name: "Jordan" },
        { "@type": "Country", name: "Qatar" },
        { "@type": "Country", name: "Oman" },
        { "@type": "Country", name: "Lebanon" },
        { "@type": "Country", name: "Morocco" },
      ],
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "sales",
          telephone: "+20-102-782-3660",
          availableLanguage: ["en", "ar"],
          areaServed: "MENA",
        },
      ],
      sameAs: [
        "https://apps.apple.com/id/app/clby/id6763633281",
      ],
    },
    {
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#localbusiness`,
      name: "CLBY",
      url: SITE_URL,
      telephone: "+20-102-782-3660",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Cairo",
        addressCountry: "EG",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 30.0444,
        longitude: 31.2357,
      },
      priceRange: "EGP 5,000/mo",
      description: DESCRIPTION,
      image: `${SITE_URL}/logo.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "CLBY",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: ["en", "ar"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "CLBY",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Gym Management Software",
      operatingSystem: "iOS, Android, Web",
      description: DESCRIPTION,
      inLanguage: ["en", "ar"],
      availableOnDevice: ["Mobile", "Tablet", "Desktop"],
      offers: [
        {
          "@type": "Offer",
          name: "Marketplace Plan",
          price: "5000",
          priceCurrency: "EGP",
          description: "Listed on the CLBY marketplace app, unlimited members, all modules included.",
          eligibleRegion: { "@type": "Place", name: "MENA" },
        },
      ],
      publisher: { "@id": `${SITE_URL}/#organization` },
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
