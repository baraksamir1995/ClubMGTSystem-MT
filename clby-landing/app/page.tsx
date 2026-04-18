import LeadForm from "@/components/LeadForm";
import DashboardMockup from "@/components/DashboardMockup";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  Zap,
  LineChart,
  Smartphone,
  Bell,
  CreditCard,
  QrCode,
  Users2,
} from "lucide-react";

export default function Home() {
  return (
    <main className="relative z-10">
      <Nav />
      <Hero />
      {/* <SocialProof /> */}
      <Features />
      <ProductShowcase />
      <Pricing />
      {/* <Comparison /> */}
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ─────────────────────────────────────────  NAV  ──────── */

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ink/80 backdrop-blur-md border-b border-canvas/10">
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <Logo />
        </a>
        <div className="hidden md:flex items-center gap-8 text-sm">
          <a href="#features" className="text-canvas/70 hover:text-canvas transition-colors">
            Features
          </a>
          <a href="#pricing" className="text-canvas/70 hover:text-canvas transition-colors">
            Pricing
          </a>
          <a href="#faq" className="text-canvas/70 hover:text-canvas transition-colors">
            FAQ
          </a>
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
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="CLBY" className="h-9 w-9 object-contain" />
      <span className="font-sans font-black text-xl leading-none tracking-tight text-canvas">CLBY</span>
    </div>
  );
}

function AppStoreBadge({ href, platform }: { href: string; platform: "ios" | "android" }) {
  const isIos = platform === "ios";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 bg-surface border border-canvas/15 hover:border-entry rounded-lg px-4 py-2.5 transition-colors"
    >
      {isIos ? (
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-canvas" fill="currentColor">
          <path d="M17.05 12.536c-.018-2.944 2.405-4.356 2.514-4.423-1.369-2.003-3.5-2.276-4.262-2.307-1.816-.184-3.542 1.07-4.462 1.07-.92 0-2.339-1.043-3.843-1.014-1.977.029-3.803 1.148-4.82 2.918-2.055 3.563-.526 8.828 1.473 11.716.978 1.414 2.143 3 3.669 2.945 1.474-.06 2.032-.954 3.812-.954 1.78 0 2.285.954 3.842.924 1.587-.03 2.592-1.444 3.566-2.866 1.125-1.647 1.587-3.24 1.613-3.322-.036-.016-3.088-1.186-3.102-4.687zM14.155 4.09c.81-.984 1.358-2.348 1.209-3.709-1.167.05-2.582.776-3.422 1.76-.75.868-1.411 2.258-1.237 3.592 1.303.1 2.641-.662 3.45-1.643z"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
          <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92z" fill="#B8FF2E"/>
          <path d="M16.81 15.018l-3.018-3.018 3.018-3.018 3.844 2.182c.861.489.861 1.681 0 2.17l-3.844 2.684z" fill="#FF6B2B"/>
          <path d="M4.002 22.186L14.185 12 4.002 1.814a.996.996 0 00-.002 0l.609.92 9.574 9.266-9.574 9.267-.609.92z" fill="#F5F5F2" opacity="0.3"/>
          <path d="M13.792 12l3.018-3.018-13.201-7.168a1 1 0 00-.609 0L13.792 12z" fill="#F5F5F2" opacity="0.8"/>
          <path d="M13.792 12l3.018 3.018-13.201 7.168a1 1 0 01-.609 0L13.792 12z" fill="#F5F5F2" opacity="0.6"/>
        </svg>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted">
          {isIos ? "Download on the" : "Get it on"}
        </span>
        <span className="text-sm font-semibold text-canvas group-hover:text-entry transition-colors">
          {isIos ? "App Store" : "Google Play"}
        </span>
      </div>
    </a>
  );
}

/* ─────────────────────────────────────────  HERO  ──────── */

function Hero() {
  return (
    <section className="pt-24 md:pt-28 pb-10 md:pb-16 px-5 md:px-8" id="demo">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* LEFT: headline + copy */}
          <div className="lg:col-span-7">
            <h1 className="reveal reveal-2 font-display text-display-lg text-canvas">
              Club management,
              <br />
              <span className="relative inline-block">
                simplified
                <span className="absolute -bottom-2 left-0 right-0 h-[3px] bg-entry" />
              </span>
              .
            </h1>

            <p className="reveal reveal-3 mt-8 text-lg md:text-xl text-canvas/70 leading-relaxed max-w-xl">
              CLBY is the all-in-one gym management platform built for MENA,
              mobile-first, with your own{" "}
              <span className="text-canvas font-medium">branded member app</span>.
            </p>

            <div className="reveal reveal-4 mt-10 flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2 text-sm text-canvas/70">
                <CheckCircle2 className="h-4 w-4 text-entry" />
                30-day free trial
              </div>
              <div className="flex items-center gap-2 text-sm text-canvas/70">
                <CheckCircle2 className="h-4 w-4 text-entry" />
                Setup in one afternoon
              </div>
            </div>

            {/* App store badges — members download the CLBY marketplace app */}
            <div className="reveal reveal-5 mt-8">
              <p className="text-xs font-mono uppercase tracking-wider text-muted mb-3">
                Members · Download the app
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <AppStoreBadge
                  href="#"
                  platform="ios"
                />
                <AppStoreBadge
                  href="#"
                  platform="android"
                />
              </div>
            </div>

            <div className="reveal reveal-5 mt-12 hidden lg:block">
              <DashboardMockup />
            </div>
          </div>

          {/* RIGHT: form */}
          <div className="reveal reveal-3 lg:col-span-5 lg:sticky lg:top-28">
            <LeadForm />

            {/* Mini trust line under form */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
              <MessageCircle className="h-3.5 w-3.5" />
              Prefer WhatsApp?{" "}
              <a
                href="https://wa.me/201027823660?text=Hi%20CLBY%2C%20I'd%20like%20to%20book%20a%20demo"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-canvas transition-colors"
              >
                Message us directly
              </a>
            </div>
          </div>

          {/* Mobile dashboard mockup */}
          <div className="reveal reveal-5 lg:hidden">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────  SOCIAL PROOF  ──────── */

function SocialProof() {
  const logos = [
    "IRON STRONG", "PULSE CAIRO", "ALEXANDRIA FIT", "THE BOX MAADI",
    "ZAMALEK ATHLETIC", "NEW CAIRO PADEL", "CROSSFIT GIZA",
    "IRON STRONG", "PULSE CAIRO", "ALEXANDRIA FIT", "THE BOX MAADI",
    "ZAMALEK ATHLETIC", "NEW CAIRO PADEL", "CROSSFIT GIZA",
  ];

  return (
    <section className="py-14 border-y border-canvas/10 bg-surface overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 mb-8">
        <p className="text-center text-xs font-mono uppercase tracking-wider text-muted">
          Trusted by clubs across Egypt
        </p>
      </div>
      <div className="marquee-mask">
        <div className="flex gap-12 whitespace-nowrap animate-marquee">
          {logos.map((logo, i) => (
            <span
              key={i}
              className="font-display text-2xl md:text-3xl text-canvas/40 tracking-wide"
            >
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────  FEATURES  ──────── */

function Features() {
  const features = [
    {
      icon: <Smartphone className="h-5 w-5" />,
      title: "Branded member app",
      body: "Your logo, your colors — in your members' pockets. White-label included at every tier. Not an upsell.",
    },
    {
      icon: <QrCode className="h-5 w-5" />,
      title: "Frictionless check-in",
      body: "QR code at the door. Members tap, doors open, your front desk stops arguing about who paid what.",
    },
    {
      icon: <Bell className="h-5 w-5" />,
      title: "Group sessions & classes",
      body: "Schedule recurring classes, manage capacity, track bookings, and let members reserve their spot in seconds.",
    },
    {
      icon: <CreditCard className="h-5 w-5" />,
      title: "Local payments, natively",
      body: "Members card payments, BNPL, Apple Pay.",
    },
    {
      icon: <LineChart className="h-5 w-5" />,
      title: "Reports that matter",
      body: "MRR, churn, collection rate, class occupancy. The 5 numbers every owner should see on Monday morning. Not 50.",
    },
    {
      icon: <Users2 className="h-5 w-5" />,
      title: "Multi-branch, unlimited members",
      body: "One dashboard, every location. Unlimited members at every tier. Growth doesn't come with a surprise bill.",
    },
  ];

  return (
    <section id="features" className="py-12 md:py-20 px-5 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-3xl mb-8 md:mb-12">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
            What's inside
          </div>
          <h2 className="font-display text-display-lg">
            Everything your club needs.
            <br />
            <span className="text-canvas/40">Nothing it doesn't.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-canvas/10 border border-canvas/10">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-ink p-8 md:p-10 hover:bg-surface transition-colors group"
            >
              <div className="h-10 w-10 rounded-sm bg-surface text-canvas flex items-center justify-center mb-6 group-hover:bg-entry transition-colors">
                {f.icon}
              </div>
              <h3 className="font-display text-2xl mb-3 leading-tight">
                {f.title}
              </h3>
              <p className="text-canvas/70 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────  PRODUCT SHOWCASE  ──────── */

function ProductShowcase() {
  return (
    <section className="bg-surface text-canvas py-12 md:py-20 px-5 md:px-8 relative overflow-hidden">
      {/* decorative element */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-entry/20 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto relative">
        <div className="max-w-3xl mb-10 md:mb-14">
          <div className="text-xs font-mono uppercase tracking-wider text-canvas/50 mb-4">
            The difference
          </div>
          <h2 className="font-display text-display-lg">
            Before CLBY,
            <br />
            <span className="text-entry">after CLBY.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          {/* Before */}
          <div className="bg-ink/60 border border-canvas/10 rounded-sm p-6 md:p-10">
            <div className="text-xs font-mono uppercase tracking-wider text-red-300/80 mb-6">
              Before — the chaos
            </div>
            <ul className="space-y-4">
              {[
                "Excel sheet with 400+ member rows",
                "WhatsApp group of staff chasing renewals manually",
                "Cash payments untracked, collection leaks",
                "No idea which members are about to churn",
                "Members don't know their remaining sessions",
                "Reports are \"whatever you can remember\"",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-canvas/60">
                  <span className="mt-2 h-1 w-1 rounded-full bg-red-300/60 flex-shrink-0" />
                  <span className="line-through decoration-1 decoration-red-300/40">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="bg-entry/[0.12] border border-entry/30 rounded-sm p-6 md:p-10 relative">
            <div className="absolute -top-3 -right-3 bg-entry text-ink text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-sm">
              With CLBY
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-entry mb-6">
              After — you run your club
            </div>
            <ul className="space-y-4">
              {[
                "Every member in one place — searchable, sortable",
                "Auto renewals & reminders — zero WhatsApp fatigue",
                "Every EGP tracked, receipts sent automatically",
                "Churn risk dashboard — catch members before they leave",
                "Members see their sessions, bookings, streaks in-app",
                "Real-time reports — MRR, churn, revenue, everything",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-entry mt-0.5 flex-shrink-0" />
                  <span className="text-canvas">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 text-center">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 bg-ink text-canvas font-medium px-6 py-3 rounded-sm hover:bg-entry hover:text-ink transition-colors"
          >
            See it on your gym — book a demo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────  PRICING  ──────── */

function Pricing() {
  const marketplaceFeatures = [
    "Listed on the CLBY marketplace app",
    "Your dedicated admin dashboard",
    "Unlimited members & staff",
    "All modules included",
    "Members card payments, BNPL, Apple Pay",
    "Group sessions & classes",
    "Reports & analytics",
    "WhatsApp support",
  ];

  const brandedFeatures = [
    "Your own branded app (iOS + Android)",
    "Your logo, colors, splash screen",
    "Published under your own account",
    "Everything in the Marketplace plan",
    "Custom onboarding & priority support",
    "Optional custom features",
  ];

  return (
    <section id="pricing" className="py-12 md:py-20 px-5 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-3xl mb-8 md:mb-12">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
            Pricing
          </div>
          <h2 className="font-display text-display-lg">
            Two ways to run
            <br />
            <span className="text-canvas/40">with CLBY.</span>
          </h2>
          <p className="mt-6 text-lg text-canvas/70 max-w-xl">
            Start on the shared marketplace or launch your own branded app.
            Same powerful platform behind both.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Marketplace plan */}
          <div className="relative bg-surface text-canvas rounded-sm p-8 md:p-10 border border-canvas/20">
            <div className="absolute -top-3 left-8 bg-entry text-ink text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-sm">
              Marketplace
            </div>

            <div className="mb-8">
              <p className="text-xs font-mono uppercase tracking-wider text-canvas/50 mb-2">
                CLBY App
              </p>
              <p className="text-sm text-canvas/70 mb-6">
                List your gym on the CLBY consumer marketplace. Members discover
                and join you through one shared app.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-5xl md:text-6xl leading-none tabular">
                  5,000
                </span>
                <span className="text-canvas/60 font-mono text-sm">EGP / mo</span>
              </div>
              <p className="text-xs text-canvas/50 mt-2">
                + 2,000 EGP / mo per extra branch
              </p>
            </div>

            <div className="border-t border-canvas/10 pt-6 space-y-3">
              {marketplaceFeatures.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-canvas/85">
                  <CheckCircle2 className="h-4 w-4 text-entry flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>

            <a
              href="#demo"
              className="mt-8 group inline-flex items-center justify-center gap-2 bg-entry text-ink font-medium px-6 py-3 rounded-sm hover:bg-entry/90 transition-colors w-full"
            >
              Book a demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          {/* Branded White-Label */}
          <div className="relative bg-surface text-canvas rounded-sm p-8 md:p-10 border border-energy/30">
            <div className="absolute -top-3 left-8 bg-energy text-ink text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-sm">
              White-Label
            </div>

            <div className="mb-8">
              <p className="text-xs font-mono uppercase tracking-wider text-canvas/50 mb-2">
                Branded App
              </p>
              <p className="text-sm text-canvas/70 mb-6">
                Your own app in the App Store and Google Play — with your brand,
                icon, and identity. Built on the same platform.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-5xl md:text-6xl leading-none">
                  Get a quote
                </span>
              </div>
              <p className="text-xs text-canvas/50 mt-2">
                Tailored to your gym size and needs
              </p>
            </div>

            <div className="border-t border-canvas/10 pt-6 space-y-3">
              {brandedFeatures.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-canvas/85">
                  <CheckCircle2 className="h-4 w-4 text-energy flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>

            <a
              href="#demo"
              className="mt-8 group inline-flex items-center justify-center gap-2 bg-energy text-ink font-medium px-6 py-3 rounded-sm hover:bg-energy/90 transition-colors w-full"
            >
              Request a quote
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────  COMPARISON  ──────── */

function Comparison() {
  const rows = [
    { feature: "Arabic + RTL support", excel: false, foreign: false, clby: true },
    { feature: "Branded member app included", excel: false, foreign: "paid add-on", clby: true },
    { feature: "Unlimited members", excel: true, foreign: false, clby: true },
    { feature: "Fawry / Paymob / InstaPay", excel: false, foreign: false, clby: true },
    { feature: "WhatsApp automation", excel: "manual", foreign: false, clby: true },
    { feature: "Multi-branch dashboard", excel: false, foreign: true, clby: true },
    { feature: "Setup in one afternoon", excel: true, foreign: false, clby: true },
    { feature: "EGP pricing, no FX surprises", excel: true, foreign: false, clby: true },
  ];

  return (
    <section className="bg-surface py-12 md:py-20 px-5 md:px-8 border-y border-canvas/10">
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
            Honest comparison
          </div>
          <h2 className="font-display text-display-lg">
            Why not Excel?
            <br />
            <span className="text-canvas/40">Why not Mindbody?</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-canvas/20">
                <th className="py-4 pr-4 text-xs font-mono uppercase tracking-wider text-muted"></th>
                <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted">
                  Excel + WhatsApp
                </th>
                <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted">
                  Foreign SaaS
                </th>
                <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1.5 bg-surface text-canvas px-2.5 py-1 rounded-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-entry" />
                    CLBY
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-canvas/10">
                  <td className="py-4 pr-4 text-canvas/80 font-medium">{row.feature}</td>
                  <td className="py-4 px-4">{renderCell(row.excel)}</td>
                  <td className="py-4 px-4">{renderCell(row.foreign)}</td>
                  <td className="py-4 px-4">{renderCell(row.clby)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function renderCell(val: boolean | string) {
  if (val === true) {
    return (
      <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-entry/10">
        <CheckCircle2 className="h-4 w-4 text-entry" />
      </div>
    );
  }
  if (val === false) {
    return <span className="text-muted/60 font-mono text-sm">—</span>;
  }
  return <span className="text-muted font-mono text-xs">{val}</span>;
}

/* ─────────────────────────────────────────  FAQ  ──────── */

function FAQ() {
  const items = [
    {
      q: "How fast can I get set up?",
      a: "One afternoon. We personally onboard every founding gym — we import your member list from Excel, set up your branded app, train your manager, and stay on WhatsApp with you for the first 14 days. No tickets, no forms, no waiting.",
    },
    {
      q: "Do my members need to download something new?",
      a: "Yes — but it's your app, not ours. With your logo, colors, and name in the App Store / Play Store. They download it once, then they have check-in, bookings, payments, and session tracking in one place.",
    },
    {
      q: "What if I don't have a tech team?",
      a: "You don't need one. If your manager can use Instagram, she can use CLBY. We handle all the technical setup. Our customer WhatsApp support answers in under an hour during business hours.",
    },
    {
      q: "What happens after the free trial?",
      a: "You decide. 30 days, full product, no credit card required. If it's a fit, you pick monthly or annual billing. If it's not, we help you export your data and part ways as friends.",
    },
  ];

  return (
    <section id="faq" className="py-12 md:py-20 px-5 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
              FAQ
            </div>
            <h2 className="font-display text-display-lg">
              Questions, answered.
            </h2>
            <p className="mt-6 text-canvas/70">
              Still unsure?{" "}
              <a
                href="https://wa.me/201027823660?text=Hi%20CLBY%2C%20I%20have%20a%20question"
                target="_blank"
                rel="noopener noreferrer"
                className="text-entry underline underline-offset-2"
              >
                Ask us on WhatsApp
              </a>
              . A human answers.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-3">
            {items.map((item, i) => (
              <details
                key={i}
                className="group border border-canvas/15 bg-surface rounded-sm overflow-hidden"
              >
                <summary className="cursor-pointer flex items-center justify-between gap-4 p-6 list-none hover:bg-ink transition-colors">
                  <span className="font-display text-xl md:text-2xl pr-4 leading-tight">
                    {item.q}
                  </span>
                  <div className="h-7 w-7 rounded-full border border-canvas/20 flex items-center justify-center flex-shrink-0 group-open:bg-entry/10 group-open:border-entry/40 transition-all">
                    <svg
                      className="h-3.5 w-3.5 text-canvas group-open:text-entry group-open:rotate-45 transition-all"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </summary>
                <div className="px-6 pb-6 text-canvas/70 leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────  FINAL CTA  ──────── */

function FinalCTA() {
  return (
    <section className="relative bg-surface text-canvas py-14 md:py-22 px-5 md:px-8 overflow-hidden">
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
          Book a 30-minute demo. We'll show you CLBY on your gym — not a generic
          one — and import your member list before you leave the call.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 bg-entry text-ink font-medium px-8 py-4 rounded-sm hover:bg-ink hover:text-canvas transition-colors"
          >
            Book my demo
            <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </a>
          <a
            href="https://wa.me/201027823660?text=Hi%20CLBY%2C%20I'd%20like%20to%20book%20a%20demo"
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
  );
}

/* ─────────────────────────────────────────  FOOTER  ──────── */

function Footer() {
  return (
    <footer className="bg-ink py-12 px-5 md:px-8 border-t border-canvas/10">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-6">
            <Logo />
            <span className="text-xs font-mono text-muted">
              Club management, simplified.
            </span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-canvas/60">
            <a href="#features" className="hover:text-canvas transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-canvas transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-canvas transition-colors">
              FAQ
            </a>
            <a
              href="https://wa.me/201027823660"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-canvas transition-colors"
            >
              WhatsApp
            </a>
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
  );
}
