import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "saudi-arabia",
  country: "Saudi Arabia",
  region: "SA",
  lat: 23.8859,
  lng: 45.0792,
  locale: "en_SA",
  currency: "SAR",
  price: "Get a quote",
  priceLabel: "SAR pricing available",
  headline: "Gym management software\nfor Saudi Arabia.",
  subheadline:
    "CLBY is the all-in-one gym management platform built for Saudi gyms and fitness clubs. Branded member app, QR check-in, class bookings, and local SAR payments — mobile-first, bilingual (EN/AR).",
  painPoint:
    "Saudi fitness clubs are scaling fast with Vision 2030, but many still rely on legacy systems or spreadsheets. Members expect a seamless app experience; your ops team deserves real automation — not more WhatsApp groups.",
  localPayments: "Mada, Apple Pay, STC Pay",
  whatsappText: "Hi CLBY, I run a gym in Saudi Arabia and I'd like to book a demo",
  metaTitle: "Gym Management Software Saudi Arabia — CLBY",
  metaDescription:
    "CLBY gym management software for Saudi Arabia fitness clubs. Branded member app, Mada & STC Pay payments, QR check-in, class bookings. SAR pricing, bilingual EN/AR, setup in one afternoon.",
  keywords: [
    "gym management software Saudi Arabia",
    "gym software Saudi Arabia",
    "fitness club software KSA",
    "gym app Saudi Arabia",
    "gym management Riyadh",
    "gym software Jeddah",
    "برنامج إدارة الجيم السعودية",
    "نظام إدارة النادي الرياضي الرياض",
    "Mada gym payments",
    "STC Pay gym",
    "SAR gym software",
    "Vision 2030 fitness technology",
  ],
  addressLocality: "Saudi Arabia",
  addressCountry: "SA",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/saudi-arabia`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/saudi-arabia`,
    siteName: "CLBY",
    locale: "en_SA",
    alternateLocale: ["ar_SA"],
    type: "website",
  },
  other: {
    "geo.region": "SA",
    "geo.placename": "Saudi Arabia",
    "geo.position": "23.8859;45.0792",
    "ICBM": "23.8859, 45.0792",
  },
};

export default function SaudiArabiaPage() {
  return <GeoPage geo={geo} />;
}
