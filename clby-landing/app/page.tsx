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
      <SocialProof />
      <Features />
      <ProductShowcase />
      <Pricing />
      <Comparison />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

/* ─────────────────────────────────────────  NAV  ──────── */

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-canvas/80 backdrop-blur-md border-b border-ink/10">
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <Logo />
        </a>
        <div className="hidden md:flex items-center gap-8 text-sm">
          <a href="#features" className="text-ink/70 hover:text-ink transition-colors">
            Features
          </a>
          <a href="#pricing" className="text-ink/70 hover:text-ink transition-colors">
            Pricing
          </a>
          <a href="#faq" className="text-ink/70 hover:text-ink transition-colors">
            FAQ
          </a>
        </div>
        <a
          href="#demo"
          className="group inline-flex items-center gap-1.5 bg-ink text-canvas text-sm font-medium px-4 py-2 rounded-sm hover:bg-accent transition-colors"
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
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-sm bg-ink flex items-center justify-center">
        <div className="h-2.5 w-2.5 rounded-full bg-accent" />
      </div>
      <span className="font-display text-2xl leading-none">clby</span>
    </div>
  );
}

/* ─────────────────────────────────────────  HERO  ──────── */

function Hero() {
  return (
    <section className="pt-32 md:pt-36 pb-16 md:pb-24 px-5 md:px-8" id="demo">
      <div className="max-w-[1400px] mx-auto">
        {/* Announcement pill */}
        <div className="reveal reveal-1 mb-8 flex justify-center md:justify-start">
          <div className="inline-flex items-center gap-2 border border-ink/15 bg-paper rounded-full pl-2 pr-4 py-1 text-xs">
            <span className="bg-ink text-canvas rounded-full px-2 py-0.5 font-mono uppercase tracking-wider text-[10px]">
              New
            </span>
            <span className="text-ink/70">
              Founding Gyms program — 6 of 10 spots remaining
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* LEFT: headline + copy */}
          <div className="lg:col-span-7">
            <h1 className="reveal reveal-2 font-display text-display-xl text-ink">
              Run your club
              <br />
              from your{" "}
              <span className="relative inline-block">
                phone
                <span className="absolute -bottom-2 left-0 right-0 h-[3px] bg-accent" />
              </span>
              .
            </h1>

            <p className="reveal reveal-3 mt-8 text-lg md:text-xl text-ink/70 leading-relaxed max-w-xl">
              CLBY is the gym management platform built for MENA. Bilingual,
              mobile-first, with a{" "}
              <span className="text-ink font-medium">branded member app</span>{" "}
              included — so you stop chasing renewals on WhatsApp and start
              running your club like a business.
            </p>

            <div className="reveal reveal-4 mt-10 flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2 text-sm text-ink/70">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                30-day free trial
              </div>
              <div className="flex items-center gap-2 text-sm text-ink/70">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                Setup in one afternoon
              </div>
              <div className="flex items-center gap-2 text-sm text-ink/70">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                Arabic & English
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
                href="https://wa.me/201000000000?text=Hi%20CLBY%2C%20I'd%20like%20to%20book%20a%20demo"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-ink transition-colors"
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
    <section className="py-14 border-y border-ink/10 bg-paper overflow-hidden">
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
              className="font-display text-2xl md:text-3xl text-ink/40 tracking-wide"
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
      title: "WhatsApp automations",
      body: "Renewal reminders, class confirmations, overdue payments — all sent automatically on the channel your members actually read.",
    },
    {
      icon: <CreditCard className="h-5 w-5" />,
      title: "Local payments, natively",
      body: "Fawry, Paymob, InstaPay — ready to use. Collect in EGP. No USD FX games, no failed transactions.",
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
    <section id="features" className="py-20 md:py-32 px-5 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-3xl mb-14 md:mb-20">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
            What's inside
          </div>
          <h2 className="font-display text-display-lg">
            Everything your club needs.
            <br />
            <span className="text-ink/40">Nothing it doesn't.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink/10 border border-ink/10">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-canvas p-8 md:p-10 hover:bg-paper transition-colors group"
            >
              <div className="h-10 w-10 rounded-sm bg-ink text-canvas flex items-center justify-center mb-6 group-hover:bg-accent transition-colors">
                {f.icon}
              </div>
              <h3 className="font-display text-2xl mb-3 leading-tight">
                {f.title}
              </h3>
              <p className="text-ink/70 leading-relaxed">{f.body}</p>
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
    <section className="bg-ink text-canvas py-20 md:py-32 px-5 md:px-8 relative overflow-hidden">
      {/* decorative element */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent/20 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto relative">
        <div className="max-w-3xl mb-16 md:mb-20">
          <div className="text-xs font-mono uppercase tracking-wider text-canvas/50 mb-4">
            The difference
          </div>
          <h2 className="font-display text-display-lg">
            Before CLBY,
            <br />
            <span className="text-accent">after CLBY.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          {/* Before */}
          <div className="bg-canvas/5 border border-canvas/10 rounded-sm p-6 md:p-10">
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
          <div className="bg-accent/[0.12] border border-accent/30 rounded-sm p-6 md:p-10 relative">
            <div className="absolute -top-3 -right-3 bg-accent text-canvas text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-sm">
              With CLBY
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-accent mb-6">
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
                  <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-canvas">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 text-center">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 bg-canvas text-ink font-medium px-6 py-3 rounded-sm hover:bg-accent hover:text-canvas transition-colors"
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
  return (
    <section id="pricing" className="py-20 md:py-32 px-5 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-3xl mb-14 md:mb-20">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
            Pricing
          </div>
          <h2 className="font-display text-display-lg">
            One price.
            <br />
            <span className="text-ink/40">No tier traps.</span>
          </h2>
          <p className="mt-6 text-lg text-ink/70 max-w-xl">
            Pay for what you run. Unlimited members, branded app, all 27 modules —
            included at every size.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: price card */}
          <div className="lg:col-span-7">
            <div className="relative bg-ink text-canvas rounded-sm p-8 md:p-12 border border-ink">
              <div className="absolute -top-3 left-8 bg-accent text-canvas text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-sm">
                Current plan
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-canvas/50 mb-3">
                    Base — 1 branch
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-6xl md:text-7xl leading-none tabular">
                      5,000
                    </span>
                    <span className="text-canvas/60 font-mono">EGP / mo</span>
                  </div>
                </div>
                <div className="md:border-l md:border-canvas/10 md:pl-12">
                  <div className="text-xs font-mono uppercase tracking-wider text-canvas/50 mb-3">
                    Each additional branch
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-6xl md:text-7xl leading-none tabular">
                      2,000
                    </span>
                    <span className="text-canvas/60 font-mono">EGP / mo</span>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-canvas/10 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {[
                  "Unlimited members",
                  "Branded white-label app",
                  "Admin dashboard (web)",
                  "All 27 modules included",
                  "Unlimited staff accounts",
                  "Fawry, Paymob, InstaPay",
                  "WhatsApp automations",
                  "Reports & analytics",
                  "Arabic & English (RTL)",
                  "WhatsApp support",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-canvas/85">
                    <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <a
                href="#demo"
                className="mt-10 group inline-flex items-center justify-center gap-2 bg-accent text-canvas font-medium px-6 py-3.5 rounded-sm hover:bg-canvas hover:text-ink transition-colors w-full md:w-auto"
              >
                Book a demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          {/* Right: price calculator */}
          <div className="lg:col-span-5">
            <div className="border border-ink/15 bg-paper rounded-sm p-8">
              <div className="text-xs font-mono uppercase tracking-wider text-muted mb-5">
                Quick math for your club
              </div>
              <div className="space-y-2.5">
                {[
                  { branches: "1 branch", price: 5000 },
                  { branches: "2 branches", price: 7000 },
                  { branches: "3 branches", price: 9000 },
                  { branches: "5 branches", price: 13000 },
                  { branches: "10 branches", price: 23000 },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 border-b border-ink/10 last:border-0"
                  >
                    <span className="text-ink/80">{row.branches}</span>
                    <div className="text-right">
                      <span className="font-display text-2xl tabular">
                        {row.price.toLocaleString()}
                      </span>
                      <span className="ml-1 text-xs font-mono text-muted">EGP/mo</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-accent/5 border border-accent/20 rounded-sm">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-ink">Annual plan:</span>{" "}
                    <span className="text-ink/70">
                      2 months free. Pay for 10, get 12.
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-ink text-canvas rounded-sm">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium">Founding Gyms:</span>{" "}
                    <span className="text-canvas/80">
                      First 10 clubs get 50% off for 12 months + setup waived.
                      6 spots left.
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
    <section className="bg-paper py-20 md:py-28 px-5 md:px-8 border-y border-ink/10">
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-3xl mb-12">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
            Honest comparison
          </div>
          <h2 className="font-display text-display-lg">
            Why not Excel?
            <br />
            <span className="text-ink/40">Why not Mindbody?</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="py-4 pr-4 text-xs font-mono uppercase tracking-wider text-muted"></th>
                <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted">
                  Excel + WhatsApp
                </th>
                <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider text-muted">
                  Foreign SaaS
                </th>
                <th className="py-4 px-4 text-xs font-mono uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1.5 bg-ink text-canvas px-2.5 py-1 rounded-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    CLBY
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-ink/10">
                  <td className="py-4 pr-4 text-ink/80 font-medium">{row.feature}</td>
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
      <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-accent/10">
        <CheckCircle2 className="h-4 w-4 text-accent" />
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
      q: "Can I use it in Arabic?",
      a: "Yes — everything is bilingual, including the member app. Full RTL support. We built for the MENA market first, not as an afterthought.",
    },
    {
      q: "What payments do you support?",
      a: "Fawry, Paymob, InstaPay, and Vodafone Cash are all natively integrated. Cash payments can be logged manually. We don't charge transaction fees — you pay your payment provider directly.",
    },
    {
      q: "What happens after the free trial?",
      a: "You decide. 30 days, full product, no credit card required. If it's a fit, you pick monthly or annual billing. If it's not, we help you export your data and part ways as friends.",
    },
  ];

  return (
    <section id="faq" className="py-20 md:py-32 px-5 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted mb-4">
              FAQ
            </div>
            <h2 className="font-display text-display-lg">
              Questions, answered.
            </h2>
            <p className="mt-6 text-ink/70">
              Still unsure?{" "}
              <a
                href="https://wa.me/201000000000?text=Hi%20CLBY%2C%20I%20have%20a%20question"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2"
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
                className="group border border-ink/15 bg-paper rounded-sm overflow-hidden"
              >
                <summary className="cursor-pointer flex items-center justify-between gap-4 p-6 list-none hover:bg-canvas transition-colors">
                  <span className="font-display text-xl md:text-2xl pr-4 leading-tight">
                    {item.q}
                  </span>
                  <div className="h-7 w-7 rounded-full border border-ink/20 flex items-center justify-center flex-shrink-0 group-open:bg-ink group-open:border-ink transition-all">
                    <svg
                      className="h-3.5 w-3.5 text-ink group-open:text-canvas group-open:rotate-45 transition-all"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </summary>
                <div className="px-6 pb-6 text-ink/70 leading-relaxed">
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
    <section className="relative bg-ink text-canvas py-24 md:py-32 px-5 md:px-8 overflow-hidden">
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="max-w-[1400px] mx-auto relative text-center">
        <h2 className="font-display text-display-xl mb-8 leading-[0.95]">
          Stop chasing renewals.
          <br />
          <span className="text-accent italic">Start running your club.</span>
        </h2>
        <p className="text-xl text-canvas/70 max-w-2xl mx-auto mb-10">
          Book a 30-minute demo. We'll show you CLBY on your gym — not a generic
          one — and import your member list before you leave the call.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 bg-accent text-canvas font-medium px-8 py-4 rounded-sm hover:bg-canvas hover:text-ink transition-colors"
          >
            Book my demo
            <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </a>
          <a
            href="https://wa.me/201000000000?text=Hi%20CLBY%2C%20I'd%20like%20to%20book%20a%20demo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-canvas/80 hover:text-canvas transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            Or WhatsApp us
          </a>
        </div>
        <p className="mt-8 text-sm text-canvas/50 font-mono">
          6 of 10 founding spots remaining · 50% off for 12 months
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────  FOOTER  ──────── */

function Footer() {
  return (
    <footer className="bg-canvas py-12 px-5 md:px-8 border-t border-ink/10">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-6">
            <Logo />
            <span className="text-xs font-mono text-muted">
              Club management, simplified.
            </span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-ink/60">
            <a href="#features" className="hover:text-ink transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-ink transition-colors">
              FAQ
            </a>
            <a
              href="https://wa.me/201000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors"
            >
              WhatsApp
            </a>
            <a href="mailto:hello@clby.app" className="hover:text-ink transition-colors">
              Email
            </a>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-ink/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-muted">
          <div>© {new Date().getFullYear()} CLBY. Made in Cairo.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-ink transition-colors">Privacy</a>
            <a href="#" className="hover:text-ink transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
