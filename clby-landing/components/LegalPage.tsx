import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/site/ui";

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-line">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </header>

      {/* Hero band */}
      <section className="pt-32 md:pt-36 pb-10 md:pb-14 px-5 md:px-8 relative overflow-hidden">
        <div className="max-w-[1000px] mx-auto relative">
          <h1 className="font-display text-display-lg text-fg leading-[0.95]">
            {title}
          </h1>
          <p className="mt-5 text-lg md:text-xl text-fg-muted max-w-2xl leading-relaxed">
            {subtitle}
          </p>
          <p className="mt-6 text-sm font-medium text-fg-muted">
            Last updated · {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20 md:pb-28 px-5 md:px-8">
        <div className="max-w-[1000px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Sticky TOC */}
          <nav aria-label="On this page" className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 border border-line bg-card rounded-control p-5">
              <p className="text-sm font-semibold text-fg mb-3">
                On this page
              </p>
              <nav className="space-y-1.5">
                {sections.map((s, i) => (
                  <a
                    key={i}
                    href={`#section-${i + 1}`}
                    className="block text-sm text-fg-muted hover:text-fg transition-colors"
                  >
                    <span className="text-fg-muted font-mono text-[10px] mr-2">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.heading}
                  </a>
                ))}
              </nav>
            </div>
          </nav>

          {/* Body */}
          <div className="lg:col-span-8 space-y-10">
            {sections.map((s, i) => (
              <section
                key={i}
                id={`section-${i + 1}`}
                className="scroll-mt-28"
              >
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-fg-muted font-mono text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-display text-2xl md:text-3xl text-fg leading-tight">
                    {s.heading}
                  </h2>
                </div>
                <div className="prose-custom text-fg leading-relaxed space-y-4">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      {/* Footer band */}
      <section className="border-t border-line py-10 px-5 md:px-8">
        <div className="max-w-[1000px] mx-auto text-sm text-fg-muted flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p>
            Questions about this document? WhatsApp us at{" "}
            <a
              href="https://wa.me/201027823660"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-ink underline underline-offset-2 hover:text-brand-ink/80"
            >
              +20 102 782 3660
            </a>
            .
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-fg transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-fg transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
