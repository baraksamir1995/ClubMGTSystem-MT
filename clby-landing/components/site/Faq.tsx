"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";

export type FaqItem = { q: string; a: string };

/**
 * Accordion: each question is a real <button> with aria-expanded /
 * aria-controls; the answer is a labelled region. Height animates via the
 * grid-rows trick (instant under reduced motion, see globals.css).
 */
export default function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        const btnId = `${baseId}-q${i}`;
        const panelId = `${baseId}-a${i}`;
        return (
          <li key={item.q} className={`overflow-hidden rounded-[18px] border bg-card transition-colors duration-200 ${isOpen ? "border-line-strong/60 shadow-card" : "border-line"}`}>
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 px-6 py-6 text-left text-[19px] font-semibold leading-snug text-fg transition-colors hover:bg-[#FBFBF8] md:px-8 md:py-7 md:text-xl"
              >
                {item.q}
                <span
                  aria-hidden
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                    isOpen ? "border-fg bg-fg text-brand" : "border-line-strong text-fg"
                  }`}
                >
                  {isOpen ? <Minus className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              {/* inert keeps collapsed answers out of tab order / the a11y tree
                  while the height animates (React 18 has no typed prop). */}
              <div className="overflow-hidden" {...(isOpen ? {} : ({ inert: "" } as Record<string, string>))}>
                <p className="max-w-3xl px-6 pb-7 text-body text-fg-muted md:px-8 md:pb-8">{item.a}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
