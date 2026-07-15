import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "oman",
  country: "Oman",
  region: "OM",
  lat: 21.4735,
  lng: 55.9754,
  locale: "en_OM",
  currency: "OMR",
  price: "Get a quote",
  priceLabel: "OMR pricing available",
  headline: "Gym management software\nfor Oman clubs.",
  subheadline:
    "CLBY is the all-in-one gym management platform for Oman fitness clubs. Branded member app, QR check-in, class bookings, and local OMR payments — bilingual EN/AR.",
  painPoint:
    "Muscat's fitness market is growing as part of Oman Vision 2040. Club owners need modern management tools to handle growing member bases without growing admin overhead.",
  localPayments: "Oman Net, Apple Pay, card",
  whatsappText: "Hi CLBY, I run a gym in Oman and I'd like to book a demo",
  metaTitle: "Gym Management Software Oman — CLBY",
  metaDescription:
    "CLBY gym management software for Oman fitness clubs. Branded member app, local payments, QR check-in, class bookings. OMR pricing, bilingual EN/AR, setup in one afternoon.",
  keywords: [
    "gym management software Oman",
    "gym software Oman",
    "fitness club software Muscat",
    "gym app Oman",
    "برنامج إدارة الجيم عمان",
    "OMR gym software",
    "gym membership management Muscat",
  ],
  addressLocality: "Oman",
  addressCountry: "OM",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/oman`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/oman`,
    siteName: "CLBY",
    locale: "en_OM",
    alternateLocale: ["ar_OM"],
    type: "website",
  },
  other: {
    "geo.region": "OM",
    "geo.placename": "Oman",
    "geo.position": "21.4735;55.9754",
    "ICBM": "21.4735, 55.9754",
  },
};

export default function OmanPage() {
  return <GeoPage geo={geo} />;
}
