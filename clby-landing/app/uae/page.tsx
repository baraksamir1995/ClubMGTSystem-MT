import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "uae",
  country: "UAE",
  region: "AE",
  lat: 23.4241,
  lng: 53.8478,
  locale: "en_AE",
  currency: "AED",
  price: "Get a quote",
  priceLabel: "AED pricing available",
  headline: "Gym management software\nbuilt for the UAE.",
  subheadline:
    "CLBY is the all-in-one gym management platform for UAE fitness clubs. Branded member app, QR check-in, class bookings, and local AED payments — mobile-first, bilingual (EN/AR).",
  painPoint:
    "UAE gyms operate in one of the world's most competitive fitness markets. Members expect a premium digital experience — a branded app, instant bookings, seamless payments. Most club owners are still cobbling this together from four different tools.",
  localPayments: "Apple Pay, Google Pay, card",
  whatsappText: "Hi CLBY, I run a gym in the UAE and I'd like to book a demo",
  metaTitle: "Gym Management Software UAE — CLBY",
  metaDescription:
    "CLBY gym management software for UAE fitness clubs. Branded member app, Apple Pay & card payments, QR check-in, class bookings. AED pricing, bilingual EN/AR, setup in one afternoon.",
  keywords: [
    "gym management software UAE",
    "gym software UAE",
    "fitness club software UAE",
    "gym app UAE",
    "gym management Dubai",
    "gym software Abu Dhabi",
    "برنامج إدارة الجيم الإمارات",
    "Apple Pay gym UAE",
    "AED gym software",
    "gym membership management UAE",
  ],
  addressLocality: "UAE",
  addressCountry: "AE",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/uae`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/uae`,
    siteName: "CLBY",
    locale: "en_AE",
    alternateLocale: ["ar_AE"],
    type: "website",
  },
  other: {
    "geo.region": "AE",
    "geo.placename": "United Arab Emirates",
    "geo.position": "23.4241;53.8478",
    "ICBM": "23.4241, 53.8478",
  },
};

export default function UAEPage() {
  return <GeoPage geo={geo} />;
}
