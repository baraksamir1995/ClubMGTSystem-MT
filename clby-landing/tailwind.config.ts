import type { Config } from "tailwindcss";

/**
 * CLBY marketing design tokens (light, editorial).
 *
 * Contrast (WCAG 2.2), measured:
 *   fg on page 16.3 · fg-muted on page 5.5 / page-alt 5.1 / card 5.9
 *   fg on brand 14.5 · fg on brand-hover 10.2 · brand-ink on card 6.8
 *   (fg-muted #64665F: 5.4 ivory / 5.0 page-alt / 5.8 white)
 *   line-strong on card 3.3 (form controls) · on-dark-muted on dark 8.7
 * brand (#B6FF32, CLBY lime) is 1.1:1 on light surfaces, so on
 * light sections it is only ever a FILL behind dark text/icons (buttons,
 * icon chips, markers), never text, thin lines or a meaningful outline.
 * Accent text on light uses brand-ink.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "#F7F7F2",
        "page-alt": "#EFEFE8",
        card: "#FFFFFF",
        fg: "#171A16",
        "fg-muted": "#64665F",
        "fg-subtle": "#6B6F67",
        line: "#E3E5DD",
        "line-strong": "#8B8F86",
        brand: "#B6FF32",
        "brand-hover": "#96D91D",
        "brand-ink": "#3B6600",
        "brand-soft": "#F1FFD6",
        dark: "#171A16",
        "dark-2": "#22261F",
        "dark-line": "#363B32",
        "on-dark": "#F7F7F2",
        "on-dark-muted": "#B4B8AE",
        danger: "#B42318",
        "danger-soft": "#FEF3F2",
        warn: "#8A5A00",
        "warn-soft": "#FFF8E6",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "-apple-system", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // Type scale. Display sizes are for the serif (font-display, 500).
      // Hero 44→76px, section 36→52px, card/sub 26→30px. Body 17-18px.
      fontSize: {
        "display-xl": ["clamp(2.75rem, 1.6rem + 3.6vw, 4.75rem)", { lineHeight: "1.04", letterSpacing: "-0.025em" }],
        "display-lg": ["clamp(2.25rem, 1.55rem + 2.2vw, 3.25rem)", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.625rem, 1.3rem + 0.9vw, 1.875rem)", { lineHeight: "1.18", letterSpacing: "-0.012em" }],
        "display-sm": ["1.625rem", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        body: ["1.0625rem", { lineHeight: "1.65" }],
        lead: ["clamp(1.125rem, 1rem + 0.35vw, 1.25rem)", { lineHeight: "1.6" }],
      },
      borderRadius: {
        card: "1.25rem",
        control: "0.625rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,26,22,0.04), 0 10px 30px -16px rgba(23,26,22,0.16)",
        lift: "0 2px 4px rgba(23,26,22,0.04), 0 24px 48px -24px rgba(23,26,22,0.22)",
        product: "0 2px 6px rgba(23,26,22,0.05), 0 40px 80px -32px rgba(23,26,22,0.30)",
      },
      maxWidth: {
        site: "1360px", // 1280px content + 40px gutters
      },
    },
  },
  plugins: [],
};

export default config;
