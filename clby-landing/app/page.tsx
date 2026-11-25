import { Check, MessageCircle } from "lucide-react";
import LeadForm from "@/components/LeadForm";
import Pricing from "@/components/Pricing";
import AppScreens, { DashboardShot } from "@/components/ProductScreens";
import Nav from "@/components/site/Nav";
import Footer from "@/components/site/Footer";
import FinalCta from "@/components/site/FinalCta";
import Features from "@/components/site/Features";
import HowItWorks from "@/components/site/HowItWorks";
import SocialProof from "@/components/site/SocialProof";
import Faq, { type FaqItem } from "@/components/site/Faq";
import Reveal from "@/components/site/Reveal";
import { ButtonLink, Container, SectionHeader, waLink } from "@/components/site/ui";

/**
 * Answers describe only what the product and team do today. Member import
 * is a service the team performs during onboarding (no self-serve import).
 */
const FAQ_ITEMS: FaqItem[] = [
  {
    q: "How fast can I get set up?",
    a: "Most gyms are up and running within days. Registering takes about three minutes, our team reviews new gyms, usually within one business day, and then we help you set up your plans, classes and staff.",
  },
  {
    q: "Do my members need to download something new?",
    a: "Yes, members use a mobile app: the CLBY app, where your gym appears with your logo and colours, or your own branded app if you choose that option. It gives them check-in, bookings, payments and session tracking in one place.",
  },
  {
    q: "What if I don't have a tech team?",
    a: "You don't need one. We handle the technical setup, and the dashboard is built for front-desk staff and managers, not engineers. If anything is unclear, our team is a WhatsApp message away.",
  },
  {
    q: "Can I have my own branded mobile app?",
    a: "Yes. With the Branded App option we publish your own iOS and Android app under your developer accounts, with your logo, colours and splash screen, running on the same CLBY platform. Request a quote to discuss it.",
  },
  {
    q: "Can I manage multiple branches?",
    a: "Yes. Every branch is managed from one dashboard. You can see check-ins per branch, and plans can be limited to specific branches or cover all of them.",
  },
  {
    q: "Can I migrate my existing members?",
    a: "Yes. Send us your current member list, for example an Excel sheet, and our team will help bring your members and their memberships into CLBY as part of onboarding.",
  },
  {
    q: "What payment methods are supported?",
    a: "Members can pay in the app by card, including Apple Pay and buy-now-pay-later options. Your staff can also record cash and card payments taken at the front desk, so every payment ends up in one place.",
  },
  {
    q: "Do you provide onboarding and support?",
    a: "Yes. Our team helps you set up your gym, plans and staff, and support is available on WhatsApp once you're live.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Nav />
      <main id="main">
        <Hero />
        <AppScreens />
        <Features />
        <HowItWorks />
        <SocialProof />
        <Pricing />
        <FaqSection />
      </main>
      <FinalCta />
      <Footer />
    </>
  );
}

/* ─────────────────────────────────────────  HERO  ──────── */

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      // Ivory hero whose last ~260px turn into the showcase's page-alt, so
      // the dashboard straddles the two sections.
      className="bg-[linear-gradient(to_bottom,#F7F7F2_0,#F7F7F2_calc(100%-260px),#EFEFE8_calc(100%-260px))] pb-16 pt-14 md:pt-20 lg:pt-24"
    >
      <Container>
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 xl:gap-20">
          <div className="lg:pt-6">
            <h1 id="hero-title" className="font-display text-display-xl text-fg">
              Run your gym.
              <br />
              Grow your community.
            </h1>
            <p className="mt-8 max-w-[36rem] text-lead text-fg-muted">
              Manage memberships, payments, classes, coaches, and attendance from one platform. Give your members and
              coaches dedicated mobile apps while keeping your entire operation connected.
            </p>

            <ul className="mt-9 space-y-4">
              {[
                "Launch in days, not months.",
                "Built for gyms across MENA.",
                "One connected platform for owners, coaches, and members.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3.5 text-[17px] font-medium text-fg">
                  <span aria-hidden className="mt-[3px] flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-brand">
                    <Check className="h-3.5 w-3.5 text-fg" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-11 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/register" size="lg" arrow>
                Register Your Gym
              </ButtonLink>
              <ButtonLink href="#demo" variant="secondary" size="lg">
                Book a Demo
              </ButtonLink>
            </div>
            <p className="mt-4 text-[15px] text-fg-muted">Self-serve signup, reviewed by our team, usually within a day.</p>
          </div>

          <div id="demo" className="scroll-mt-28">
            <LeadForm />
            <p className="mt-5 text-center text-[15px] text-fg-muted">
              Prefer WhatsApp?{" "}
              <a
                href={waLink("Hi CLBY, I'd like to book a demo")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-fg underline underline-offset-4 hover:text-brand-ink"
              >
                Message us directly<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          </div>
        </div>

        <Reveal className="mt-20 lg:mt-28">
          <DashboardShot />
        </Reveal>
      </Container>
    </section>
  );
}

/* ─────────────────────────────────────────  FAQ  ──────── */

function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-page-alt py-24 lg:py-32">
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHeader id="faq-title" title="Frequently asked questions." />
            <p className="mt-6 max-w-sm text-lead text-fg-muted">
              The questions gym owners ask us most before moving to CLBY.
            </p>
            <a
              href={waLink("Hi CLBY, I have a question")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex min-h-[48px] items-center gap-3 rounded-control border border-line-strong bg-card px-5 text-[16px] font-semibold text-fg transition-colors hover:border-fg"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
              Ask us on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <div>
            <Faq items={FAQ_ITEMS} />
          </div>
        </div>
      </Container>
    </section>
  );
}
