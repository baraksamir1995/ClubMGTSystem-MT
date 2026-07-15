import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "lebanon",
  country: "Lebanon",
  region: "LB",
  lat: 33.8547,
  lng: 35.8623,
  locale: "en_LB",
  currency: "USD",
  price: "Get a quote",
  priceLabel: "USD pricing available",
  headline: "Gym management software\nfor Lebanon clubs.",
  subheadline:
    "CLBY is the all-in-one gym management platform for Lebanese fitness clubs. Branded member app, QR check-in, class bookings, and USD/card payments — bilingual EN/AR.",
  painPoint:
    "Lebanese gym owners are resilient and resourceful. But running a gym on WhatsApp and paper when you could have a branded member app and real-time revenue data is costing you time and money every month.",
  localPayments: "USD card, WhatsApp Pay",
  whatsappText: "Hi CLBY, I run a gym in Lebanon and I'd like to book a demo",
  metaTitle: "Gym Management Software Lebanon — CLBY",
  metaDescription:
    "CLBY gym management software for Lebanese fitness clubs in Beirut and beyond. Branded member app, card payments, QR check-in, class bookings. USD pricing, bilingual EN/AR.",
  keywords: [
    "gym management software Lebanon",
    "gym software Lebanon",
    "fitness club software Beirut",
    "gym app Lebanon",
    "برنامج إدارة الجيم لبنان",
    "gym membership management Beirut",
    "USD gym software Lebanon",
  ],
  addressLocality: "Lebanon",
  addressCountry: "LB",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/lebanon`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/lebanon`,
    siteName: "CLBY",
    locale: "en_LB",
    alternateLocale: ["ar_LB"],
    type: "website",
  },
  other: {
    "geo.region": "LB",
    "geo.placename": "Lebanon",
    "geo.position": "33.8547;35.8623",
    "ICBM": "33.8547, 35.8623",
  },
};

export default function LebanonPage() {
  return <GeoPage geo={geo} />;
}
