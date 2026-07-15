import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

// Every color below resolves through the CSS variables declared in
// app/globals.css, where the light and dark palettes live. Both
// palettes are WCAG 2.2 AAA verified by scripts/contrast-audit.mjs —
// change values there, re-run the audit, then mirror here only if a
// token is added/removed.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Design-system tokens (semantic, theme-aware). Components
        // must only use these — never raw palette classes or hex.
        // Shape: `bg-{role}`, `text-{role}`, `border-{role}` — e.g.
        // `bg-surface-2`, `text-fg-muted`, `border-line`,
        // `bg-danger-soft text-danger`.
        //
        // `brand` is the brand green as TEXT/icon (dark green in light
        // mode, neon in dark mode); `brand-fill` is the neon button
        // fill (always paired with `text-brand-ink`, and with
        // `border-brand-edge` so the fill has a ≥3:1 boundary in light
        // mode).
        brand: {
          DEFAULT: v('brand'),
          fill:    v('brand-fill'),
          dim:     v('brand-dim'),
          ink:     v('brand-ink'),
          edge:    v('brand-edge'),
        },
        accent: {
          DEFAULT: v('accent'),
        },
        surface: {
          DEFAULT: v('surface'),
          2:       v('surface-2'),
          3:       v('surface-3'),
          4:       v('surface-4'),
        },
        line: {
          DEFAULT: v('line'),
          strong:  v('line-strong'),
        },
        fg: {
          DEFAULT: v('fg'),
          muted:   v('fg-muted'),
          faint:   v('fg-faint'),
        },
        success: { DEFAULT: v('success'), soft: v('success-soft') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
        danger:  { DEFAULT: v('danger'),  soft: v('danger-soft') },
        info:    { DEFAULT: v('info'),    soft: v('info-soft') },
        // Text on SOLID status fills (`bg-danger text-on-status`).
        'on-status': v('on-status'),
        // Focus indicator — ≥3:1 against every surface in both themes.
        focus: v('focus'),
        // Modal/backdrop scrim — used with alpha (`bg-overlay/60`).
        overlay: v('overlay'),

        // ── Legacy aliases. Kept so anything the token sweep missed
        // still themes correctly instead of breaking in light mode.
        // New code must not use these.
        clby: {
          bg:       v('surface'),
          surface:  v('surface-2'),
          surface2: v('surface-3'),
          border:   v('line'),
          fg:       v('fg'),
          green:    v('brand'),
          greenDim: v('brand-dim'),
          orange:   v('accent'),
          lime:     v('brand'),
        },
        gray: {
          ...colors.gray,
          400: v('fg-muted'),
          500: v('fg-faint'),
          600: v('surface-4'),
          700: v('surface-3'),
          800: v('surface-2'),
          900: v('surface'),
          950: v('surface'),
        },
        // Legacy purple-* (pre-rebrand accent) → brand tokens.
        purple: {
          50:  v('brand-dim'),
          100: v('brand-dim'),
          200: v('brand-dim'),
          300: v('brand'),
          400: v('brand'),
          500: v('brand-dim'),
          600: v('brand-fill'),
          700: v('brand-dim'),
          800: v('brand'),
          900: v('brand'),
          950: v('brand'),
        },
      },
      fontFamily: {
        // Bias toward Inter when it's locally installed, then fall back to
        // the system stack so Coolify's offline build doesn't need to fetch
        // anything from Google Fonts at build time.
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
