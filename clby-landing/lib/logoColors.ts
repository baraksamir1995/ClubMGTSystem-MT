/**
 * Pull brand colours out of an uploaded logo (client-side, canvas) and
 * turn them into an app-ready primary/secondary pair.
 *
 * Readability rules match components/app-preview/brand.ts (and the API):
 * the member app draws white text on both colours, so a logo colour that
 * is too light is darkened along its own hue until it passes (primary to
 * the comfortable 4.5:1, secondary to its 1.5:1 floor).
 */
import { COMFORT_CONTRAST, MIN_CONTRAST, contrastWithWhite } from "@/components/app-preview/brand";

export type LogoPalette = {
  /** Distinct colours found in the logo, most prominent first (hex). */
  colors: string[];
  primary: string;
  secondary: string;
  /** True when a logo colour had to be darkened to stay readable. */
  adjusted: boolean;
};

type Hsl = { h: number; s: number; l: number };

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();

function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function hexToHsl(hex: string): Hsl {
  const n = hex.replace("#", "");
  return rgbToHsl(parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16));
}

/** Darken along the colour's own hue until white text reaches `target`. */
export function readable(hex: string, target: number): { hex: string; changed: boolean } {
  if (contrastWithWhite(hex) >= target) return { hex, changed: false };
  const hsl = hexToHsl(hex);
  for (let l = hsl.l; l >= 0.05; l -= 0.01) {
    const candidate = hslToHex({ ...hsl, l });
    if (contrastWithWhite(candidate) >= target) return { hex: candidate, changed: true };
  }
  return { hex: "#171A16", changed: true };
}

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function extractLogoPalette(src: string): Promise<LogoPalette | null> {
  const img = await loadImage(src);
  const size = 72;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Bucket opaque pixels by coarse RGB (4 bits/channel), averaging members.
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 160) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  if (!buckets.size) return null;
  let opaque = 0;
  for (const e of buckets.values()) opaque += e.n;
  // Ignore specks: antialiased edges blend the logo colour with its
  // background and would otherwise surface as fake "brand" colours.
  const minPixels = Math.max(4, opaque * 0.04);

  const swatches = [...buckets.values()].map((e) => {
    const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
    const hsl = rgbToHsl(r, g, b);
    return { hex: toHex(r, g, b), hsl, n: e.n };
  });

  // Brand colours are the vivid ones: skip near-white/near-black/greys
  // (backgrounds, outlines).
  const vivid = swatches
    .filter((s) => s.hsl.s >= 0.22 && s.hsl.l > 0.1 && s.hsl.l < 0.92)
    .sort((a, b) => b.n - a.n);

  // Group near-identical shades (antialiasing splits one colour across
  // several buckets); each group keeps its most common shade as its face.
  const groups: { hex: string; hsl: Hsl; n: number }[] = [];
  for (const s of vivid) {
    const g = groups.find((g) => hueGap(g.hsl.h, s.hsl.h) < 24 && Math.abs(g.hsl.l - s.hsl.l) < 0.22);
    if (g) g.n += s.n;
    else groups.push({ ...s });
  }

  // Keep groups that cover a real share of the logo, ranked by area with
  // a bias toward saturated colours.
  const picked = groups
    .filter((g) => g.n >= minPixels)
    .sort((a, b) => b.n * (0.35 + b.hsl.s) - a.n * (0.35 + a.hsl.s))
    .slice(0, 5);

  if (!picked.length) {
    // Monochrome logo: use its darkest tone, with a lighter partner.
    const dark = swatches.filter((s) => s.hsl.l < 0.92).sort((a, b) => b.n - a.n)[0];
    const base = dark ? readable(dark.hex, COMFORT_CONTRAST) : { hex: "#18181B", changed: false };
    const lighter = hslToHex({ ...hexToHsl(base.hex), l: Math.min(0.42, hexToHsl(base.hex).l + 0.22) });
    return { colors: dark ? [dark.hex] : [], primary: base.hex, secondary: readable(lighter, MIN_CONTRAST.secondary).hex, adjusted: base.changed };
  }

  const primary = readable(picked[0].hex, COMFORT_CONTRAST);
  let secondaryBase: string;
  if (picked[1]) {
    secondaryBase = picked[1].hex;
  } else {
    // One-colour logo: a lighter, slightly shifted tint of the primary hue.
    const hsl = hexToHsl(primary.hex);
    secondaryBase = hslToHex({ h: (hsl.h + 12) % 360, s: Math.min(1, hsl.s * 0.95), l: Math.min(0.62, hsl.l + 0.2) });
  }
  const secondary = readable(secondaryBase, MIN_CONTRAST.secondary);

  return {
    colors: picked.map((p) => p.hex),
    primary: primary.hex,
    secondary: secondary.hex,
    adjusted: primary.changed || (picked[1] ? secondary.changed : false),
  };
}
