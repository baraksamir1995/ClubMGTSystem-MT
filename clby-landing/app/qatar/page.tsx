import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "qatar",
  country: "Qatar",
  region: "QA",
  lat: 25.3548,
  lng: 51.1839,
  locale: "en_QA",
  currency: "QAR",
  price: "Get a quote",
  priceLabel: "QAR pricing available",
  headline: "Gym management software\nfor Qatar clubs.",
  subheadline:
    "CLBY is the all-in-one gym management platform for Qatar fitness clubs. Branded member app, QR check-in, class bookings, and local QAR payments — bilingual EN/AR.",
  painPoint:
    "Qatar's fitness scene saw massive growth post-2022. Members now expect a world-class app experience, not a WhatsApp message asking if they renewed. CLBY gives your club the digital infrastructure to match the ambition.",
  localPayments: "QPay, Apple Pay, card",
  whatsappText: "Hi CLBY, I run a gym in Qatar and I'd like to book a demo",
  metaTitle: "Gym Management Software Qatar — CLBY",
  metaDescription:
    "CLBY gym management software for Qatar fitness clubs in Doha and beyond. Branded member app, QPay & Apple Pay, QR check-in, class bookings. QAR pricing, bilingual EN/AR.",
  keywords: [
    "gym management software Qatar",
    "gym software Qatar",
    "fitness club software Doha",
    "gym app Qatar",
    "برنامج إدارة الجيم قطر",
    "QPay gym Qatar",
    "QAR gym software",
    "gym membership management Doha",
  ],
  addressLocality: "Qatar",
  addressCountry: "QA",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/qatar`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/qatar`,
    siteName: "CLBY",
    locale: "en_QA",
    alternateLocale: ["ar_QA"],
    type: "website",
  },
  other: {
    "geo.region": "QA",
    "geo.placename": "Qatar",
    "geo.position": "25.3548;51.1839",
    "ICBM": "25.3548, 51.1839",
  },
};

export default function QatarPage() {
  return <GeoPage geo={geo} />;
}
