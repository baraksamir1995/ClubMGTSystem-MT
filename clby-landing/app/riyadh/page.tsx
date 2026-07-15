import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "riyadh",
  country: "Saudi Arabia",
  city: "Riyadh",
  region: "SA-01",
  lat: 24.7136,
  lng: 46.6753,
  locale: "en_SA",
  currency: "SAR",
  price: "Get a quote",
  priceLabel: "SAR pricing available",
  headline: "Gym management software\nfor Riyadh clubs.",
  subheadline:
    "CLBY is the gym management platform built for Riyadh's fast-growing fitness scene. Branded member app, QR check-in, class bookings, and Mada / Apple Pay — bilingual (EN/AR).",
  painPoint:
    "Riyadh's gym scene is booming — Olaya, Al Nakheel, Diriyah, King Abdullah Financial District. But scaling means your ops can't stay on spreadsheets and WhatsApp. Members expect a branded app; owners need real visibility.",
  localPayments: "Mada, Apple Pay, STC Pay",
  whatsappText: "Hi CLBY, I run a gym in Riyadh and I'd like to book a demo",
  metaTitle: "Gym Management Software Riyadh — CLBY",
  metaDescription:
    "CLBY gym management software for Riyadh gyms and fitness clubs. Branded member app, Mada & Apple Pay, QR check-in, class bookings. SAR pricing, bilingual EN/AR, setup in one afternoon.",
  keywords: [
    "gym management software Riyadh",
    "gym software Riyadh",
    "fitness club software Riyadh",
    "gym app Riyadh",
    "برنامج إدارة الجيم الرياض",
    "Mada gym Riyadh",
    "gym membership management Riyadh",
    "نادي رياضي الرياض",
  ],
  addressLocality: "Riyadh",
  addressCountry: "SA",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/riyadh`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/riyadh`,
    siteName: "CLBY",
    locale: "en_SA",
    alternateLocale: ["ar_SA"],
    type: "website",
  },
  other: {
    "geo.region": "SA-01",
    "geo.placename": "Riyadh, Saudi Arabia",
    "geo.position": "24.7136;46.6753",
    "ICBM": "24.7136, 46.6753",
  },
};

export default function RiyadhPage() {
  return <GeoPage geo={geo} />;
}
