import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// Edge runtime (middleware / edge routes). Same gating as the server config.
Sentry.init({
  dsn,
  enabled: process.env.NODE_ENV === 'production' && !!dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: 0.2,
});
