import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "bahrain",
  country: "Bahrain",
  region: "BH",
  lat: 26.0667,
  lng: 50.5577,
  locale: "en_BH",
  currency: "BHD",
  price: "Get a quote",
  priceLabel: "BHD pricing available",
  headline: "Gym management software\nfor Bahrain clubs.",
  subheadline:
    "CLBY is the all-in-one gym management platform for Bahrain fitness clubs. Branded member app, QR check-in, class bookings, and local BHD payments — bilingual EN/AR.",
  painPoint:
    "Bahrain's fitness market is compact but competitive. Every gym in Manama competes for the same members. A seamless branded app and automated renewals aren't a luxury — they're how you retain members month after month.",
  localPayments: "Benefit, Apple Pay, card",
  whatsappText: "Hi CLBY, I run a gym in Bahrain and I'd like to book a demo",
  metaTitle: "Gym Management Software Bahrain — CLBY",
  metaDescription:
    "CLBY gym management software for Bahrain fitness clubs. Branded member app, Benefit & Apple Pay, QR check-in, class bookings. BHD pricing, bilingual EN/AR, setup in one afternoon.",
  keywords: [
    "gym management software Bahrain",
    "gym software Bahrain",
    "fitness club software Bahrain",
    "gym app Bahrain",
    "برنامج إدارة الجيم البحرين",
    "Benefit gym Bahrain",
    "BHD gym software",
    "gym membership management Manama",
  ],
  addressLocality: "Bahrain",
  addressCountry: "BH",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/bahrain`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/bahrain`,
    siteName: "CLBY",
    locale: "en_BH",
    alternateLocale: ["ar_BH"],
    type: "website",
  },
  other: {
    "geo.region": "BH",
    "geo.placename": "Bahrain",
    "geo.position": "26.0667;50.5577",
    "ICBM": "26.0667, 50.5577",
  },
};

export default function BahrainPage() {
  return <GeoPage geo={geo} />;
}
