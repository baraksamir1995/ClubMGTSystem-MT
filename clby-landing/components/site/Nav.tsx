"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonClass, Container, Logo } from "./ui";

const LINKS = [
  { id: "features", label: "Features" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

/**
 * Sticky site nav. `base` is "" on the home page (in-page anchors) and "/"
 * elsewhere so links jump to the home page sections. On the home page the
 * link for the section in view is marked aria-current.
 */
export default function Nav({ base = "", demoHref }: { base?: "" | "/"; demoHref?: string }) {
  const demo = demoHref ?? `${base}#demo`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (base !== "") return;
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [base]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-page/90 backdrop-blur-md supports-[backdrop-filter]:bg-page/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-control focus:bg-card focus:px-4 focus:py-2 focus:text-fg focus:shadow-card">
        Skip to content
      </a>
      <Container className="flex h-[76px] items-center justify-between gap-6">
        <a href={base || "/"} aria-label="CLBY home" className="flex-shrink-0 rounded-control">
          <Logo />
        </a>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => {
              const current = active === l.id;
              return (
                <li key={l.id}>
                  <a
                    href={`${base}#${l.id}`}
                    aria-current={current ? "location" : undefined}
                    className={`relative inline-flex min-h-[44px] items-center rounded-control px-4 text-base font-medium transition-colors hover:bg-page-alt hover:text-fg ${
                      current ? "text-fg" : "text-fg-muted"
                    }`}
                  >
                    {l.label}
                    {current && <span aria-hidden className="absolute inset-x-4 -bottom-[15px] h-[3px] rounded-full bg-fg" />}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a href="/register" className={`${buttonClass("secondary")} hidden sm:inline-flex`}>
            Register your gym
          </a>
          <a href={demo} className={`${buttonClass("primary")} hidden sm:inline-flex`}>
            Book a demo
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-fg hover:bg-page-alt md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-page md:hidden">
          <Container className="py-4">
            <nav aria-label="Mobile">
              <ul className="space-y-1">
                {LINKS.map((l) => (
                  <li key={l.id}>
                    <a
                      href={`${base}#${l.id}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-[48px] items-center rounded-control px-3 text-base font-medium text-fg hover:bg-page-alt"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-4 grid gap-2">
              <a href={demo} onClick={() => setOpen(false)} className={buttonClass("primary", "lg", true)}>
                Book a demo
              </a>
              <a href="/register" className={buttonClass("secondary", "lg", true)}>
                Register your gym
              </a>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
