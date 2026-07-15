import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "jordan",
  country: "Jordan",
  region: "JO",
  lat: 31.9454,
  lng: 35.9284,
  locale: "en_JO",
  currency: "JOD",
  price: "Get a quote",
  priceLabel: "JOD pricing available",
  headline: "Gym management software\nfor Jordan clubs.",
  subheadline:
    "CLBY is the all-in-one gym management platform for Jordanian fitness clubs. Branded member app, QR check-in, class bookings, and local JOD payments — bilingual EN/AR.",
  painPoint:
    "Amman's gym scene is growing, but most clubs still manage members through spreadsheets and WhatsApp. Members want a proper app; you need real revenue data. CLBY brings both — without hiring a tech team.",
  localPayments: "JoMoPay, Apple Pay, card",
  whatsappText: "Hi CLBY, I run a gym in Jordan and I'd like to book a demo",
  metaTitle: "Gym Management Software Jordan — CLBY",
  metaDescription:
    "CLBY gym management software for Jordan fitness clubs. Branded member app, local payments, QR check-in, class bookings. JOD pricing, bilingual EN/AR, setup in one afternoon.",
  keywords: [
    "gym management software Jordan",
    "gym software Jordan",
    "fitness club software Amman",
    "gym app Jordan",
    "برنامج إدارة الجيم الأردن",
    "JOD gym software",
    "gym membership management Amman",
    "نادي رياضي عمان",
  ],
  addressLocality: "Jordan",
  addressCountry: "JO",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/jordan`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/jordan`,
    siteName: "CLBY",
    locale: "en_JO",
    alternateLocale: ["ar_JO"],
    type: "website",
  },
  other: {
    "geo.region": "JO",
    "geo.placename": "Jordan",
    "geo.position": "31.9454;35.9284",
    "ICBM": "31.9454, 35.9284",
  },
};

export default function JordanPage() {
  return <GeoPage geo={geo} />;
}
