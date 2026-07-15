import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "dubai",
  country: "UAE",
  city: "Dubai",
  region: "AE-DU",
  lat: 25.2048,
  lng: 55.2708,
  locale: "en_AE",
  currency: "AED",
  price: "Get a quote",
  priceLabel: "AED pricing available",
  headline: "Gym management software\nfor Dubai clubs.",
  subheadline:
    "CLBY is the gym management platform for Dubai's premium fitness scene. Branded member app, QR check-in, class bookings, and Apple Pay / card — the digital infrastructure your members expect.",
  painPoint:
    "Dubai members compare your app to SoulCycle, Equinox, and Barry's. If you're sending WhatsApp messages to confirm class bookings or chasing renewals manually, you're already behind. CLBY closes that gap — this afternoon.",
  localPayments: "Apple Pay, Google Pay, card",
  whatsappText: "Hi CLBY, I run a gym in Dubai and I'd like to book a demo",
  metaTitle: "Gym Management Software Dubai — CLBY",
  metaDescription:
    "CLBY gym management software for Dubai gyms and fitness clubs. Branded member app, Apple Pay & card, QR check-in, class bookings. AED pricing, bilingual EN/AR. Setup this afternoon.",
  keywords: [
    "gym management software Dubai",
    "gym software Dubai",
    "fitness club software Dubai",
    "gym app Dubai",
    "برنامج إدارة الجيم دبي",
    "Apple Pay gym Dubai",
    "gym membership management Dubai",
    "Dubai fitness club platform",
    "AED gym software Dubai",
  ],
  addressLocality: "Dubai",
  addressCountry: "AE",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/dubai`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/dubai`,
    siteName: "CLBY",
    locale: "en_AE",
    alternateLocale: ["ar_AE"],
    type: "website",
  },
  other: {
    "geo.region": "AE-DU",
    "geo.placename": "Dubai, UAE",
    "geo.position": "25.2048;55.2708",
    "ICBM": "25.2048, 55.2708",
  },
};

export default function DubaiPage() {
  return <GeoPage geo={geo} />;
}
