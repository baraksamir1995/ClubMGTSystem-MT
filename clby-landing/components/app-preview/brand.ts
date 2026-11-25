/**
 * Branding model for the live member-app preview.
 *
 * MIRRORED FILE: identical copies live in
 *   clby-landing/components/app-preview/  (onboarding, /register)
 *   gym-admin/components/app-preview/     (super-admin request review)
 * gym-admin is built from its own folder, so it can't import this one.
 * Change both together.
 *
 * Contrast limits mirror clby-api App\Support\BrandColors (server-side
 * validation): the member app draws WHITE text on both brand colours.
 */

export type AppBrand = {
  gymName: string;
  logoUrl: string | null;
  primary: string;
  secondary: string;
  currency?: string;
};

/** Platform default = gyms.branding_config column default. */
export const DEFAULT_PRIMARY = "#4F46E5";
export const DEFAULT_SECONDARY = "#818CF8";

export const PRESETS: { name: string; primary: string; secondary: string }[] = [
  { name: "CLBY Indigo", primary: "#4F46E5", secondary: "#818CF8" },
  { name: "Teal", primary: "#0F766E", secondary: "#14B8A6" },
  { name: "Ocean", primary: "#1D4ED8", secondary: "#60A5FA" },
  { name: "Crimson", primary: "#B91C1C", secondary: "#F87171" },
  { name: "Ember", primary: "#C2410C", secondary: "#FB923C" },
  { name: "Forest", primary: "#166534", secondary: "#4ADE80" },
  { name: "Plum", primary: "#7E22CE", secondary: "#C084FC" },
  { name: "Graphite", primary: "#18181B", secondary: "#52525B" },
];

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Minimum contrast against white text, per colour role. */
export const MIN_CONTRAST = { primary: 3, secondary: 1.5 } as const;
/** Primary below this still works for bold labels but small links suffer. */
export const COMFORT_CONTRAST = 4.5;

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const s = parseInt(n.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastWithWhite(hex: string): number {
  if (!HEX_RE.test(hex)) return 21;
  return 1.05 / (luminance(hex) + 0.05);
}

export type ColorCheck = { level: "ok" | "warn" | "error"; message?: string };

export function checkColor(role: "primary" | "secondary", hex: string): ColorCheck {
  if (!HEX_RE.test(hex)) return { level: "error", message: "Use a 6-digit hex colour, e.g. #4F46E5." };
  const c = contrastWithWhite(hex);
  if (c < MIN_CONTRAST[role]) {
    return {
      level: "error",
      message:
        role === "primary"
          ? "Too light: white button text and labels on this colour would be hard to read. Pick a darker shade."
          : "Too light: the membership card's white labels would disappear. Pick a darker shade.",
    };
  }
  if (role === "primary" && c < COMFORT_CONTRAST) {
    return { level: "warn", message: "Readable for buttons, but small links in this colour may be hard to read. A darker shade is safer." };
  }
  return { level: "ok" };
}

/** Mix a hex colour with black (amount 0..1). */
export function darken(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const out = [0, 2, 4]
    .map((i) => Math.round(parseInt(n.slice(i, i + 2), 16) * (1 - amount)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return `#${out}`;
}

/** hex + alpha (0..1) → rgba() */
export function alpha(hex: string, a: number): string {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** A colour safe to render even while the user is mid-typing a hex. */
export function safeHex(hex: string, fallback: string): string {
  return HEX_RE.test(hex) ? hex : fallback;
}
