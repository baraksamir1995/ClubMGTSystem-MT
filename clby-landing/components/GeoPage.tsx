import { Check } from "lucide-react";
import LeadForm from "@/components/LeadForm";
import Pricing from "@/components/Pricing";
import Nav from "@/components/site/Nav";
import Footer from "@/components/site/Footer";
import FinalCta from "@/components/site/FinalCta";
import Features from "@/components/site/Features";
import { ButtonLink, Container, waLink } from "@/components/site/ui";
import { SITE_URL } from "@/lib/config";

export interface GeoConfig {
  // Identity
  slug: string;
  country: string;
  city?: string;
  region: string; // ISO 3166-2 e.g. "EG", "SA", "AE"
  lat: number;
  lng: number;
  locale: string; // "en_EG", "en_SA", etc.
  currency: string; // "EGP", "SAR", "AED"
  price: string; // "5,000" | "1,500" | etc.
  priceLabel: string; // "5,000 EGP / mo"

  // Copy
  headline: string;
  subheadline: string;
  painPoint: string; // local-flavoured "before" pain
  localPayments: string; // e.g. "Fawry, Paymob, InstaPay"
  whatsappText: string; // pre-filled WA message

  // SEO
  metaTitle: string;
  metaDescription: string;
  keywords: string[];

  // Structured data
  addressLocality: string;
  addressCountry: string; // ISO "EG", "SA", "AE", etc.
}

export default function GeoPage({ geo }: { geo: GeoConfig }) {
  const siteUrl = SITE_URL;
  const pageUrl = `${siteUrl}/${geo.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}/#webpage`,
        url: pageUrl,
        name: geo.metaTitle,
        description: geo.metaDescription,
        inLanguage: "en",
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#software` },
        speakable: {
          "@type": "SpeakableSpecification",
          cssSelector: ["h1", "h2", ".geo-description"],
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "CLBY",
        applicationCategory: "BusinessApplication",
        description: geo.metaDescription,
        availableInCountry: geo.addressCountry,
        inLanguage: ["en", "ar"],
      },
    ],
  };

  const place = geo.city ?? geo.country;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Nav base="/" demoHref="#demo" />
      <main id="main">
        <section aria-labelledby="geo-title" className="bg-page pb-20 pt-12 md:pb-28 md:pt-20">
          <Container>
            <p className="mb-6 text-[15px] font-medium text-fg-muted">
              CLBY · {geo.city ? `${geo.city}, ` : ""}{geo.country}
            </p>
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-14">
              <div className="lg:col-span-7">
                <h1 id="geo-title" className="font-display text-display-xl text-fg">{geo.headline}</h1>
                <p className="geo-description mt-7 max-w-xl text-lg leading-relaxed text-fg-muted md:text-xl">{geo.subheadline}</p>

                <ul className="mt-8 space-y-3">
                  {[`Built for gyms in ${place}`, "Your logo and colours in your members' app", "Launch in days, not months."].map((point) => (
                    <li key={point} className="flex items-start gap-3 text-base text-fg md:text-lg">
                      <Check aria-hidden className="mt-1 h-5 w-5 flex-shrink-0 text-brand-ink" strokeWidth={2.5} />
                      {point}
                    </li>
                  ))}
                </ul>

                <div className="mt-10 rounded-card border border-line bg-card p-6">
                  <p className="text-[15px] font-semibold text-fg">Sound familiar?</p>
                  <p className="mt-2 text-base leading-relaxed text-fg-muted">{geo.painPoint}</p>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href="/register" size="lg" arrow>Register Your Gym</ButtonLink>
                  <ButtonLink href="#demo" variant="secondary" size="lg">Book a Demo</ButtonLink>
                </div>
              </div>

              <div id="demo" className="scroll-mt-24 lg:col-span-5">
                <LeadForm />
                <p className="mt-4 text-center text-[15px] text-fg-muted">
                  Prefer WhatsApp?{" "}
                  <a href={waLink(geo.whatsappText)} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-fg underline underline-offset-4 hover:text-brand-ink">
                    Message us directly<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </p>
              </div>
            </div>
          </Container>
        </section>

        <Features title={`Everything your ${place} gym needs. In one system.`} />
        <Pricing />
      </main>
      <FinalCta whatsappText={geo.whatsappText} gymLabel={`your ${place} gym`} />
      <Footer base="/" />
    </>
  );
}
