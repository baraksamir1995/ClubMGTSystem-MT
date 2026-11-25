import type { AnchorHTMLAttributes, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/** Shared marketing-site primitives. Tokens: tailwind.config.ts. */

export const WHATSAPP = "https://wa.me/201027823660";
export const waLink = (text: string) => `${WHATSAPP}?text=${encodeURIComponent(text)}`;

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-site px-5 sm:px-8 lg:px-10 ${className}`}>{children}</div>;
}

type Variant = "primary" | "secondary" | "ghost" | "primary-dark" | "secondary-dark";

const VARIANTS: Record<Variant, string> = {
  // Lime fill + charcoal text (14.5:1). Darker lime on hover (10.2:1).
  primary: "bg-brand text-fg hover:bg-brand-hover border border-[#8FCB1F] shadow-[0_1px_0_rgba(23,26,22,0.06)]",
  secondary: "bg-card text-fg border border-line-strong hover:border-fg hover:bg-page",
  ghost: "text-fg hover:bg-page-alt",
  "primary-dark": "bg-brand text-fg hover:bg-brand-hover",
  "secondary-dark": "border border-on-dark-muted/60 text-on-dark hover:border-on-dark hover:bg-white/5",
};

const SIZES = {
  md: "min-h-[44px] px-5 text-[15px]",
  lg: "min-h-[56px] px-7 text-[17px]",
};

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", full = false) {
  return `group inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-200 ${VARIANTS[variant]} ${SIZES[size]} ${full ? "w-full" : ""}`;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  full = false,
  arrow = false,
  className = "",
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: keyof typeof SIZES;
  full?: boolean;
  arrow?: boolean;
}) {
  return (
    <a className={`${buttonClass(variant, size, full)} ${className}`} {...rest}>
      {children}
      {arrow && <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />}
    </a>
  );
}

export function SectionHeader({
  title,
  lead,
  id,
  align = "left",
  dark = false,
}: {
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <div className={`max-w-[46rem] ${align === "center" ? "mx-auto text-center" : ""}`}>
      <h2 id={id} className={`font-display text-display-lg ${dark ? "text-on-dark" : "text-fg"}`}>
        {title}
      </h2>
      {lead && (
        <p className={`mt-6 text-lead ${dark ? "text-on-dark-muted" : "text-fg-muted"} ${align === "center" ? "mx-auto" : ""} max-w-2xl`}>
          {lead}
        </p>
      )}
    </div>
  );
}

/**
 * The CLBY mark is lime-on-transparent; on light backgrounds lime reads at
 * 1.1:1, so it sits on a charcoal tile (like its app icon) to stay vivid.
 */
export function Logo({ dark = false, size = 40 }: { dark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center rounded-[10px] bg-dark"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={size * 0.72} height={size * 0.72} style={{ width: size * 0.72, height: size * 0.72 }} />
      </span>
      <span className={`text-[22px] font-extrabold leading-none tracking-tight ${dark ? "text-on-dark" : "text-fg"}`}>CLBY</span>
      <span className="sr-only">home</span>
    </span>
  );
}

/** Small lime chip holding a dark icon (icon contrast 14.5:1 on lime). */
export function IconChip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-brand text-fg ${className}`} aria-hidden>
      {children}
    </span>
  );
}
