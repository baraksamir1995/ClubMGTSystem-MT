"use client";

import { ArrowRight } from "lucide-react";
import { QUOTE_EVENT, type Offering } from "@/lib/offerings";
import { buttonClass } from "@/components/site/ui";

/**
 * "Request a Quote" CTA. Tells the existing lead form (#demo) which
 * offering was picked, then lets the anchor scroll to it. On pages without
 * the form (none today) the href still lands on /#demo with the offering in
 * the query string, which LeadForm also reads on mount.
 */
export default function QuoteButton({
  offering,
  href = "#demo",
  label,
}: {
  offering: Offering;
  href?: string;
  /** Accessible name; both cards show the same visible text. */
  label?: string;
}) {
  return (
    <a
      href={href}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(QUOTE_EVENT, { detail: offering }));
      }}
      aria-label={label}
      className={`mt-9 ${buttonClass("primary", "lg", true)}`}
    >
      Request a Quote
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
    </a>
  );
}
