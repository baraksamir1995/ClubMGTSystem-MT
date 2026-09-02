import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl: cookie-based locale (no /[locale] URL prefix — this is an
// internal admin tool, SEO is irrelevant). The request config reads the
// `locale` cookie; see i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// `unsafe-eval` is required by several runtime dependencies pulled into the
// admin bundle (recharts, schema validators, etc) — production was throwing
// "Refused to evaluate a string as JavaScript" CSP errors, which React
// surfaced as a generic "Something went wrong" toast (e.g. when sending a
// notification). The strict policy is worth keeping out of reach long-term;
// the follow-up is to find the offending library and replace it, then drop
// 'unsafe-eval' from the prod policy. Until then, allow it both envs.
const scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

// SECURITY: HIGH-2 — Comprehensive security headers for all responses
const securityHeaders = [
  // SECURITY: HIGH-2 — Prevent SSL downgrade attacks
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // SECURITY: HIGH-2 — Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // SECURITY: HIGH-2 — Prevent MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // SECURITY: HIGH-2 — Control referrer information
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // SECURITY: HIGH-2 — Restrict browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // SECURITY: HIGH-2 — Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      // Sentry ingest (all regions) — required so the browser SDK can POST events.
      "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SECURITY: MEDIUM-1 — Remove framework fingerprinting header
  poweredByHeader: false,

  eslint: { ignoreDuringBuilds: true }, // TODO: no .eslintrc yet; enabling needs config + violation pass first
  // "Checking validity of types" spawns a fresh ~1.5GB tsc process right
  // after webpack. That was fatal while images were built on the 2GB
  // Coolify box (it thrashed swap until dockerd's exec pipe timed out —
  // the silent exit-255 deploys), so it was skipped whenever CI was set.
  // The image is now built on a 16GB GitHub runner, which has room to
  // type-check properly, so only skip it on the small box.
  typescript: { ignoreBuildErrors: !!process.env.COOLIFY_FQDN },
  experimental: {
    instrumentationHook: true, // Next 14: load instrumentation.ts (Sentry server/edge init)
    // Parallel webpack workers + tsc starve dockerd and health checks on
    // the 2GB prod box, breaking the deploy's exec pipe (silent exit-255).
    // One worker keeps it alive. Keyed off COOLIFY_FQDN, not CI: GitHub
    // Actions sets CI=1 but has 16GB and should build in parallel.
    ...(process.env.COOLIFY_FQDN ? { cpus: 1, workerThreads: false } : {}),
    optimizePackageImports: ['recharts', 'lucide-react'],
    outputFileTracingExcludes: {
      '*': [
        '**/@swc/core*',
        '**/@esbuild*',
        '**/node_modules/@next/swc*',
        '**/node_modules/sharp*',
      ],
    },
  },
  // Webpack's persistent disk cache is useless inside a throwaway Docker
  // build layer (it is discarded with the layer, on a runner as much as on
  // the prod box), and serializing it is a pure IO+memory spike — it is
  // what the 2GB box died on, right after "Serializing big strings".
  // Layer caching is handled by buildx/GHA cache instead.
  webpack: (config) => {
    if (process.env.CI) config.cache = false;
    return config;
  },
  images: {
    remotePatterns: [],
  },

  // SECURITY: HIGH-1, HIGH-2 — Security headers and cache control
  async headers() {
    return [
      // SECURITY: HIGH-1 — Prevent CDN caching of auth pages
      {
        source: '/login',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          ...securityHeaders,
        ],
      },
      {
        source: '/change-password',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          ...securityHeaders,
        ],
      },
      // SECURITY: HIGH-2 — Apply security headers to all routes
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

// Offline Coolify build safety: telemetry + source-map upload disabled so the
// Sentry webpack plugin makes ZERO network calls at build time. No auth token
// is set, so source maps are never uploaded regardless. Errors still report at
// runtime; they just won't be symbolicated to original source until you add a
// SENTRY_AUTH_TOKEN + enable uploads in a CI step that has internet.
//
// ONE rule, shared with instrumentation.ts and sentry.*.config.ts: Sentry is
// wired up ONLY when NODE_ENV === 'production'. Dev/test skip the wrapper
// entirely — reporting is disabled there anyway, but the wrapper still
// injects the SDK into every bundle and hooks the webpack pipeline, which
// slows on-demand route compiles. Keeping every gate keyed on the same
// predicate means NODE_ENV=test can't produce a build shape that matches
// neither mode (wrapper applied but configs refusing to load).
const sentryEnabled = process.env.NODE_ENV === 'production';

export default sentryEnabled
  ? withSentryConfig(withNextIntl(nextConfig), {
      silent: true,
      telemetry: false,
      sourcemaps: { disable: true },
    })
  : withNextIntl(nextConfig);
