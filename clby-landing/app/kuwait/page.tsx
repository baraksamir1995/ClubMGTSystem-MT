import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "kuwait",
  country: "Kuwait",
  region: "KW",
  lat: 29.3759,
  lng: 47.9774,
  locale: "en_KW",
  currency: "KWD",
  price: "Get a quote",
  priceLabel: "KWD pricing available",
  headline: "Gym management software\nfor Kuwait clubs.",
  subheadline:
    "CLBY is the all-in-one gym management platform for Kuwait fitness clubs. Branded member app, QR check-in, class bookings, and local KWD payments — bilingual EN/AR.",
  painPoint:
    "Kuwait's premium gym market is growing rapidly, but most clubs still manage members through Excel and WhatsApp. Your members expect a branded app. Your operations deserve automation.",
  localPayments: "KNET, Apple Pay, card",
  whatsappText: "Hi CLBY, I run a gym in Kuwait and I'd like to book a demo",
  metaTitle: "Gym Management Software Kuwait — CLBY",
  metaDescription:
    "CLBY gym management software for Kuwait fitness clubs. Branded member app, KNET & Apple Pay, QR check-in, class bookings. KWD pricing, bilingual EN/AR, setup in one afternoon.",
  keywords: [
    "gym management software Kuwait",
    "gym software Kuwait",
    "fitness club software Kuwait",
    "gym app Kuwait",
    "برنامج إدارة الجيم الكويت",
    "KNET gym Kuwait",
    "KWD gym software",
    "gym membership management Kuwait",
  ],
  addressLocality: "Kuwait",
  addressCountry: "KW",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/kuwait`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/kuwait`,
    siteName: "CLBY",
    locale: "en_KW",
    alternateLocale: ["ar_KW"],
    type: "website",
  },
  other: {
    "geo.region": "KW",
    "geo.placename": "Kuwait",
    "geo.position": "29.3759;47.9774",
    "ICBM": "29.3759, 47.9774",
  },
};

export default function KuwaitPage() {
  return <GeoPage geo={geo} />;
}
