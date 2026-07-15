import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "mena",
  country: "MENA",
  region: "MENA",
  lat: 25.0,
  lng: 45.0,
  locale: "en_US",
  currency: "USD / local currency",
  price: "Get a quote",
  priceLabel: "Local currency pricing",
  headline: "Gym management software\nbuilt for the MENA region.",
  subheadline:
    "CLBY is the all-in-one gym management platform designed for the Middle East and North Africa. Branded member app, QR check-in, class bookings, and local payments — mobile-first, bilingual EN/AR.",
  painPoint:
    "Most gym software is built for the US or UK market — wrong currency, no Arabic, payments that don't work locally, and pricing that hurts in USD. CLBY was built in Cairo for MENA gyms from day one.",
  localPayments: "local payment methods",
  whatsappText: "Hi CLBY, I run a gym in MENA and I'd like to book a demo",
  metaTitle: "Gym Management Software MENA — CLBY",
  metaDescription:
    "CLBY gym management software for MENA — Egypt, Saudi Arabia, UAE, Kuwait, Jordan, Bahrain, Morocco and beyond. Branded member app, local payments, QR check-in, bilingual EN/AR.",
  keywords: [
    "gym management software MENA",
    "gym software Middle East",
    "fitness club software MENA",
    "gym app Middle East North Africa",
    "برنامج إدارة الجيم الشرق الأوسط",
    "نظام إدارة النادي الرياضي",
    "gym management platform Arab world",
    "bilingual gym software Arabic English",
    "MENA fitness technology",
    "gym software Egypt Saudi Arabia UAE",
  ],
  addressLocality: "Middle East and North Africa",
  addressCountry: "EG",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/mena`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/mena`,
    siteName: "CLBY",
    locale: "en_US",
    alternateLocale: ["ar_EG", "ar_SA", "ar_AE"],
    type: "website",
  },
  other: {
    "geo.region": "EG",
    "geo.placename": "Middle East and North Africa",
    "geo.position": "25.0;45.0",
    "ICBM": "25.0, 45.0",
  },
};

export default function MenaPage() {
  return <GeoPage geo={geo} />;
}
