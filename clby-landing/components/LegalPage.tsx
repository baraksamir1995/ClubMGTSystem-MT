import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Section {
  heading: string;
  body: React.ReactNode;
}

interface LegalPageProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: Section[];
}

export default function LegalPage({ title, subtitle, lastUpdated, sections }: LegalPageProps) {
  return (
    <main className="relative z-10">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-ink/80 backdrop-blur-md border-b border-canvas/10">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CLBY" className="h-9 w-9 object-contain" />
            <span className="font-sans font-black text-xl leading-none tracking-tight text-canvas">CLBY</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-canvas/70 hover:text-canvas transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </header>

      {/* Hero band */}
      <section className="pt-32 md:pt-36 pb-10 md:pb-14 px-5 md:px-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full bg-entry/10 blur-3xl pointer-events-none" />
        <div className="max-w-[1000px] mx-auto relative">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-entry" />
            Legal
          </div>
          <h1 className="font-display text-display-lg text-canvas leading-[0.95]">
            {title}
          </h1>
          <p className="mt-5 text-lg md:text-xl text-canvas/70 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
          <p className="mt-6 text-xs font-mono uppercase tracking-wider text-muted">
            Last updated · {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20 md:pb-28 px-5 md:px-8">
        <div className="max-w-[1000px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Sticky TOC */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 border border-canvas/10 bg-surface rounded-sm p-5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted mb-3">
                On this page
              </p>
              <nav className="space-y-1.5">
                {sections.map((s, i) => (
                  <a
                    key={i}
                    href={`#section-${i + 1}`}
                    className="block text-sm text-canvas/70 hover:text-canvas transition-colors"
                  >
                    <span className="text-muted font-mono text-[10px] mr-2">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.heading}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Body */}
          <div className="lg:col-span-8 space-y-10">
            {sections.map((s, i) => (
              <section
                key={i}
                id={`section-${i + 1}`}
                className="scroll-mt-28"
              >
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-muted font-mono text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-2xl md:text-3xl text-canvas leading-tight">
                    {s.heading}
                  </h2>
                </div>
                <div className="prose-custom text-canvas/80 leading-relaxed space-y-4">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      {/* Footer band */}
      <section className="border-t border-canvas/10 py-10 px-5 md:px-8">
        <div className="max-w-[1000px] mx-auto text-sm text-muted flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p>
            Questions about this document? WhatsApp us at{" "}
            <a
              href="https://wa.me/201027823660"
              target="_blank"
              rel="noopener noreferrer"
              className="text-entry underline underline-offset-2 hover:text-entry/80"
            >
              +20 102 782 3660
            </a>
            .
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-canvas transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-canvas transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
