import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "morocco",
  country: "Morocco",
  region: "MA",
  lat: 31.7917,
  lng: -7.0926,
  locale: "en_MA",
  currency: "MAD",
  price: "Get a quote",
  priceLabel: "MAD pricing available",
  headline: "Gym management software\nfor Morocco clubs.",
  subheadline:
    "CLBY is the all-in-one gym management platform for Moroccan fitness clubs. Branded member app, QR check-in, class bookings, and local MAD payments — bilingual EN/AR.",
  painPoint:
    "Casablanca, Rabat, and Marrakech gyms are growing fast but most still run on paper registers and WhatsApp. Members want a proper app; you need real revenue visibility. CLBY delivers both — today.",
  localPayments: "CMI, Apple Pay, card",
  whatsappText: "Hi CLBY, I run a gym in Morocco and I'd like to book a demo",
  metaTitle: "Gym Management Software Morocco — CLBY",
  metaDescription:
    "CLBY gym management software for Moroccan fitness clubs. Branded member app, CMI & Apple Pay, QR check-in, class bookings. MAD pricing, bilingual EN/AR, setup in one afternoon.",
  keywords: [
    "gym management software Morocco",
    "gym software Morocco",
    "fitness club software Casablanca",
    "gym app Morocco",
    "برنامج إدارة الجيم المغرب",
    "MAD gym software",
    "gym membership management Casablanca",
    "logiciel gestion salle de sport Maroc",
  ],
  addressLocality: "Morocco",
  addressCountry: "MA",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/morocco`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/morocco`,
    siteName: "CLBY",
    locale: "en_MA",
    alternateLocale: ["ar_MA", "fr_MA"],
    type: "website",
  },
  other: {
    "geo.region": "MA",
    "geo.placename": "Morocco",
    "geo.position": "31.7917;-7.0926",
    "ICBM": "31.7917, -7.0926",
  },
};

export default function MoroccoPage() {
  return <GeoPage geo={geo} />;
}
