import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // CLBY brand system (from the brand guidelines): near-black
      // background, neon green `#B8FF2E` as the primary accent ("entry"),
      // orange `#FF6B2B` as the secondary accent ("energy"), and an
      // off-white foreground. The remap pushes the existing
      // `purple-*` classes scattered through the dashboard to the
      // brand green automatically, so we don't have to touch the
      // hundreds of legacy `bg-purple-600 / text-purple-400` sites.
      colors: {
        // ── Design-system tokens (semantic). New components live in
        // `components/ui/` and read these directly. The legacy
        // `clby-*` / `purple-*` / `gray-*` blocks below are aliases
        // kept for older components during the migration.
        //
        // Naming convention: short, semantic, role-based — no hex /
        // colour names. Use shape: `bg-{role}`, `text-{role}`,
        // `border-{role}` — e.g. `bg-brand`, `bg-brand-ink`,
        // `bg-surface-2`, `border-line`, `text-fg-muted`.
        brand: {
          DEFAULT: '#B8FF2E',   // primary accent (entry green)
          ink:     '#0A0A0A',   // foreground that sits ON brand
          dim:     '#A1E125',   // hover/active darken
        },
        accent: {
          DEFAULT: '#FF6B2B',   // secondary accent (energy orange)
        },
        surface: {
          DEFAULT: '#0A0A0A',   // page background
          2:       '#161616',   // cards / modals
          3:       '#1F1F1F',   // hover / pressed
          4:       '#272727',   // tertiary
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong:  'rgba(255,255,255,0.14)',
        },
        fg: {
          DEFAULT: '#F5F5F2',
          muted:   '#A3A39C',
          faint:   '#5E5E58',
        },
        success: {
          DEFAULT: '#6FD08C',
          soft:    'rgba(111,208,140,0.18)',
        },
        warning: {
          DEFAULT: '#E8AC4F',
          soft:    'rgba(232,172,79,0.18)',
        },
        danger: {
          DEFAULT: '#E56A4A',
          soft:    'rgba(229,106,74,0.18)',
        },

        // ── Legacy aliases (kept until the migration sweep finishes).
        // Direct brand tokens — used for components written before the
        // semantic ramp existed (the "Powered by CLBY" footer, etc.).
        clby: {
          bg:       '#0A0A0A',
          surface:  '#161616',
          surface2: '#1F1F1F',   // a touch above surface for hover/active strata
          border:   'rgba(255,255,255,0.08)',
          fg:       '#F5F5F2',   // off-white text
          green:    '#B8FF2E',   // primary accent — "entry"
          greenDim: '#A1E125',   // hover/active step-down of the primary green
          orange:   '#FF6B2B',   // secondary accent — "energy"
          // `lime` kept as an alias of green for any older references —
          // delete once nothing reads it.
          lime:     '#B8FF2E',
        },
        // Dark gray surface shades remapped to brand near-black + the
        // brand surface ramp. The lighter gray shades (50–600) stay as
        // Tailwind's defaults so `text-gray-400 / text-gray-500` still
        // read as muted neutrals against the brand bg. Spreading
        // `colors.gray` first keeps every untouched key intact.
        gray: {
          ...colors.gray,
          600:  '#2D2D2D', // subtle divider above surfaces
          700:  '#1F1F1F', // surface2 — hover/active strata
          800:  '#161616', // surface — card / modal fill
          900:  '#0A0A0A', // page bg
          950:  '#050505',
        },
        // Legacy purple-* classes remapped to the brand green ramp so
        // existing components inherit the new accent. 600 is the pure
        // brand hex (#B8FF2E); 500 is a slight hover darken; the rest
        // cascade down monotonically.
        purple: {
          50:  '#F5FFD9',
          100: '#E8FFB0',
          200: '#D6FF7C',
          300: '#C6FF4E',
          400: '#B8FF2E', // text accents / focus rings — canonical brand green
          500: '#A1E125', // hover state on filled buttons
          600: '#B8FF2E', // CTA fill — pure brand neon
          700: '#86BD1F',
          800: '#5F8716',
          900: '#3F5A0F',
          950: '#243307',
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
