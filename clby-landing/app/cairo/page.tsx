import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "cairo",
  country: "Egypt",
  city: "Cairo",
  region: "EG-C",
  lat: 30.0444,
  lng: 31.2357,
  locale: "en_EG",
  currency: "EGP",
  price: "5,000",
  priceLabel: "5,000 EGP / mo",
  headline: "Gym management software\nfor Cairo clubs.",
  subheadline:
    "CLBY is the gym management platform built for Cairo and Greater Cairo gyms. Branded member app, QR check-in, class bookings, and Fawry / Paymob / InstaPay payments.",
  painPoint:
    "Cairo gyms are growing fast — New Cairo, Maadi, Zamalek, 5th Settlement. But most still manage members in Excel, chase renewals on WhatsApp, and lose track of cash payments. CLBY gives you the infrastructure to scale.",
  localPayments: "Fawry, Paymob, InstaPay",
  whatsappText: "Hi CLBY, I run a gym in Cairo and I'd like to book a demo",
  metaTitle: "Gym Management Software Cairo — CLBY",
  metaDescription:
    "CLBY gym management software for Cairo gyms — New Cairo, Maadi, Zamalek, 5th Settlement. Branded member app, Fawry & Paymob payments, QR check-in. EGP pricing, setup in one afternoon.",
  keywords: [
    "gym management software Cairo",
    "gym software Cairo",
    "gym app Cairo",
    "fitness club software Cairo",
    "gym management New Cairo",
    "gym software Maadi",
    "gym software Zamalek",
    "برنامج إدارة الجيم القاهرة",
    "Fawry gym Cairo",
    "EGP gym platform Cairo",
  ],
  addressLocality: "Cairo",
  addressCountry: "EG",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/cairo`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/cairo`,
    siteName: "CLBY",
    locale: "en_EG",
    type: "website",
  },
  other: {
    "geo.region": "EG-C",
    "geo.placename": "Cairo, Egypt",
    "geo.position": "30.0444;31.2357",
    "ICBM": "30.0444, 31.2357",
  },
};

export default function CairoPage() {
  return <GeoPage geo={geo} />;
}
