import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Smartphone,
  QrCode,
  Bell,
  CreditCard,
  LineChart,
  Users2,
} from "lucide-react";
import LeadForm from "@/components/LeadForm";
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
  const numericPrice = geo.price.replace(/,/g, "");
  const hasNumericPrice = /^\d+(\.\d+)?$/.test(numericPrice);

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
        // schema.org Offer.price must be numeric — quote-only pages omit it.
        ...(hasNumericPrice && {
          offers: {
            "@type": "Offer",
            price: numericPrice,
            priceCurrency: geo.currency,
            eligibleRegion: {
              "@type": "Place",
              name: geo.addressLocality,
              address: { "@type": "PostalAddress", addressCountry: geo.addressCountry },
            },
          },
        }),
        availableInCountry: geo.addressCountry,
        inLanguage: ["en", "ar"],
      },
    ],
  };

  const features = [
    {
      icon: <Smartphone className="h-5 w-5" />,
      title: "Branded member app",
      body: `Your logo, your colors, in your members' pockets. White-label included at every tier — not an upsell.`,
    },
    {
      icon: <QrCode className="h-5 w-5" />,
      title: "Frictionless check-in",
      body: "QR code at the door. Members tap, doors open, your front desk stops arguing about who paid what.",
    },
    {
      icon: <Bell className="h-5 w-5" />,
      title: "Group sessions & classes",
      body: "Schedule recurring classes, manage capacity, and let members reserve their spot in seconds.",
    },
    {
      icon: <CreditCard className="h-5 w-5" />,
      title: `Local payments (${geo.localPayments})`,
      body: `Accept payments the way ${geo.city ?? geo.country} members actually pay — no friction, no FX surprises.`,
    },
    {
      icon: <LineChart className="h-5 w-5" />,
      title: "Reports that matter",
      body: "MRR, churn, collection rate, class occupancy. The 5 numbers every owner should see Monday morning.",
    },
    {
      icon: <Users2 className="h-5 w-5" />,
      title: "Multi-branch, unlimited members",
      body: "One dashboard, every location. Unlimited members at every tier — growth doesn't come with a surprise bill.",
    },
  ];

  return (
    <main className="relative z-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/80 backdrop-blur-md border-b border-canvas/10">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CLBY" className="h-9 w-9 object-contain" />
            <span className="font-sans font-black text-xl leading-none tracking-tight text-canvas">CLBY</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a href="/#features" className="text-canvas/70 hover:text-canvas transition-colors">Features</a>
            <a href="/#pricing" className="text-canvas/70 hover:text-canvas transition-colors">Pricing</a>
            <a href="/#faq" className="text-canvas/70 hover:text-canvas transition-colors">FAQ</a>
          </div>
          <a
            href="#demo"
            className="group inline-flex items-center gap-1.5 bg-entry text-ink text-sm font-medium px-4 py-2 rounded-sm hover:bg-entry/90 transition-colors"
          >
            Book demo
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-24 md:pt-28 pb-10 md:pb-16 px-5 md:px-8" id="demo">
        <div className="max-w-[1400px] mx-auto">
          {/* Breadcrumb / geo signal */}
          <div className="mb-6 text-xs font-mono uppercase tracking-wider text-muted">
            CLBY · {geo.city ? `${geo.city}, ` : ""}{geo.country}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-7">
              <h1 className="font-display text-display-lg text-canvas">
                {geo.headline}
              </h1>

              <p className="geo-description mt-8 text-lg md:text-xl text-canvas/70 leading-relaxed max-w-xl">
                {geo.subheadline}
              </p>

              <div className="mt-8 space-y-3">
                {[
                  `Built for ${geo.city ?? geo.country} gyms — ${geo.currency} pricing, no FX`,
                  "Branded member app included",
                  "30-day free trial · Setup in one afternoon",
                ].map((point, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-canvas/70">
                    <CheckCircle2 className="h-4 w-4 text-entry flex-shrink-0" />
                    {point}
                  </div>
                ))}
              </div>

              {/* Pain → solution teaser */}
              <div className="mt-10 bg-surface border border-canvas/10 rounded-sm p-6">
                <p className="text-xs font-mono uppercase tracking-wider text-muted mb-3">
                  Sound familiar?
                </p>
                <p className="text-canvas/70 leading-relaxed">{geo.painPoint}</p>
                <p className="mt-3 text-entry font-medium text-sm">
                  CLBY fixes this — set up this afternoon.
                </p>
              </div>
            </div>

            {/* RIGHT: form */}
            <div className="lg:col-span-5 lg:sticky lg:top-28">
              <LeadForm />
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
                <MessageCircle className="h-3.5 w-3.5" />
                Prefer WhatsApp?{" "}
                <a
                  href={`https://wa.me/201027823660?text=${encodeURIComponent(geo.whatsappText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-canvas transition-colors"
                >
                  Message us directly
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-12 md:py-20 px-5 md:px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="max-w-3xl mb-8 md:mb-12">
            <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
              What's inside
            </div>
            <h2 className="font-display text-display-lg">
              Everything your {geo.city ?? geo.country} club needs.
              <br />
              <span className="text-canvas/60">Nothing it doesn't.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-canvas/10 border border-canvas/10">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-ink p-8 md:p-10 hover:bg-surface transition-colors group"
              >
                <div className="h-10 w-10 rounded-sm bg-surface text-canvas flex items-center justify-center mb-6 group-hover:bg-entry group-hover:text-ink transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-display text-2xl mb-3 leading-tight">{f.title}</h3>
                <p className="text-canvas/70 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LOCAL PRICING */}
      <section className="py-12 md:py-20 px-5 md:px-8 bg-surface border-y border-canvas/10">
        <div className="max-w-[1400px] mx-auto">
          <div className="max-w-3xl mb-8">
            <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
              Pricing for {geo.city ?? geo.country}
            </div>
            <h2 className="font-display text-display-lg">
              Priced in {geo.currency}.
              <br />
              <span className="text-canvas/60">No FX surprises.</span>
            </h2>
          </div>

          <div className="max-w-lg">
            <div className="bg-ink border border-canvas/20 rounded-sm p-8 md:p-10">
              <p className="text-xs font-mono uppercase tracking-wider text-canvas/50 mb-2">
                Marketplace Plan
              </p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-display text-5xl leading-none tabular">{geo.price}</span>
                {hasNumericPrice ? (
                  <span className="text-canvas/60 font-mono text-sm">{geo.currency} / mo</span>
                ) : (
                  <span className="text-canvas/60 font-mono text-sm">{geo.priceLabel}</span>
                )}
              </div>
              <ul className="space-y-2 mb-8">
                {[
                  "Unlimited members & staff",
                  "All modules included",
                  `${geo.localPayments} payments`,
                  "Branded member app",
                  "Multi-branch dashboard",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-canvas/85">
                    <CheckCircle2 className="h-4 w-4 text-entry flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="#demo"
                className="group inline-flex items-center justify-center gap-2 bg-entry text-ink font-medium px-6 py-3 rounded-sm hover:bg-entry/90 transition-colors w-full"
              >
                Book a demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative bg-ink text-canvas py-14 md:py-22 px-5 md:px-8 overflow-hidden">
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-entry/30 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-entry/20 blur-3xl" />
        </div>
        <div className="max-w-[1400px] mx-auto relative text-center">
          <h2 className="font-display text-display-xl mb-8 leading-[0.95]">
            Stop chasing renewals.
            <br />
            <span className="text-entry italic">Start running your club.</span>
          </h2>
          <p className="text-xl text-canvas/70 max-w-2xl mx-auto mb-10">
            Book a 30-minute demo. We'll show you CLBY on your {geo.city ?? geo.country} gym, not a generic one,
            and import your member list before you leave the call.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="#demo"
              className="group inline-flex items-center gap-2 bg-entry text-ink font-medium px-8 py-4 rounded-sm hover:bg-ink hover:text-canvas border border-entry transition-colors"
            >
              Book my demo
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={`https://wa.me/201027823660?text=${encodeURIComponent(geo.whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-canvas/80 hover:text-entry transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              Or WhatsApp us
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-ink py-12 px-5 md:px-8 border-t border-canvas/10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-6">
              <a href="/" className="flex items-center gap-2.5">
                <img src="/logo.png" alt="CLBY" className="h-9 w-9 object-contain" />
                <span className="font-sans font-black text-xl leading-none tracking-tight text-canvas">CLBY</span>
              </a>
              <span className="text-xs font-mono text-muted">Club management, simplified.</span>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-canvas/60">
              <a href="/#features" className="hover:text-canvas transition-colors">Features</a>
              <a href="/#pricing" className="hover:text-canvas transition-colors">Pricing</a>
              <a href="/#faq" className="hover:text-canvas transition-colors">FAQ</a>
              <a href="https://wa.me/201027823660" target="_blank" rel="noopener noreferrer" className="hover:text-canvas transition-colors">WhatsApp</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-canvas/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-muted">
            <div>© {new Date().getFullYear()} CLBY. Made in Cairo.</div>
            <div className="flex gap-6">
              <a href="/privacy" className="hover:text-canvas transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-canvas transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
