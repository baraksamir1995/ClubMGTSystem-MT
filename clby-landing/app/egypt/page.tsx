import type { Metadata } from "next";
import GeoPage, { type GeoConfig } from "@/components/GeoPage";
import { SITE_URL } from "@/lib/config";

const geo: GeoConfig = {
  slug: "egypt",
  country: "Egypt",
  region: "EG",
  lat: 26.8206,
  lng: 30.8025,
  locale: "en_EG",
  currency: "EGP",
  price: "5,000",
  priceLabel: "5,000 EGP / mo",
  headline: "Gym management software\nbuilt for Egypt.",
  subheadline:
    "CLBY is the all-in-one gym management platform trusted by gyms across Egypt. Branded member app, QR check-in, class bookings, and Fawry / Paymob / InstaPay — all in one place.",
  painPoint:
    "Most Egyptian gyms still run on a combination of Excel, WhatsApp groups, and manual cash collection. Members don't know their remaining sessions, staff spends hours chasing renewals, and the owner has no idea what MRR is.",
  localPayments: "Fawry, Paymob, InstaPay",
  whatsappText: "Hi CLBY, I run a gym in Egypt and I'd like to book a demo",
  metaTitle: "Gym Management Software Egypt — CLBY",
  metaDescription:
    "CLBY is the #1 gym management platform in Egypt. Branded member app, QR check-in, Fawry & Paymob payments, class bookings, and reports. Priced in EGP. Setup in one afternoon.",
  keywords: [
    "gym management software Egypt",
    "gym software Egypt",
    "gym management Egypt",
    "fitness club software Egypt",
    "gym app Egypt",
    "برنامج إدارة الجيم مصر",
    "Fawry gym payments",
    "Paymob gym",
    "gym membership software Cairo Alexandria",
    "EGP gym software",
  ],
  addressLocality: "Egypt",
  addressCountry: "EG",
};

export const metadata: Metadata = {
  title: geo.metaTitle,
  description: geo.metaDescription,
  keywords: geo.keywords,
  alternates: {
    canonical: `${SITE_URL}/egypt`,
    languages: { "x-default": SITE_URL },
  },
  openGraph: {
    title: geo.metaTitle,
    description: geo.metaDescription,
    url: `${SITE_URL}/egypt`,
    siteName: "CLBY",
    locale: "en_EG",
    type: "website",
  },
  other: {
    "geo.region": "EG",
    "geo.placename": "Egypt",
    "geo.position": "26.8206;30.8025",
    "ICBM": "26.8206, 30.8025",
  },
};

export default function EgyptPage() {
  return <GeoPage geo={geo} />;
}
