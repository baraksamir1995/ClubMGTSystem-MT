import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Browser SDK. Reports only with a DSN set AND in production. The Sentry
// ingest host must be allowed in the CSP connect-src (see next.config.mjs),
// otherwise the browser silently drops events.
Sentry.init({
  dsn,
  enabled: process.env.NODE_ENV === 'production' && !!dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: 0.2,
  // Session Replay intentionally omitted (extra bundle weight + worker-src/CSP).
  // Add Sentry.replayIntegration() later if you want it.
});
