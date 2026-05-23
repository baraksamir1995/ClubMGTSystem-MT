import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only reports when a DSN is set AND running in production (i.e. the Coolify
// container). Local `next dev` (NODE_ENV=development) never sends.
Sentry.init({
  dsn,
  enabled: process.env.NODE_ENV === 'production' && !!dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: 0.2,
});
