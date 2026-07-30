export async function register() {
  // Same production-only gate as next.config.mjs (sentryEnabled) and the
  // `enabled:` flag in sentry.*.config.ts — Sentry is wired up ONLY when
  // NODE_ENV === 'production'. Skipping the import keeps the SDK out of the
  // dev/test compile graph. Keep all three gates keyed on this predicate.
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// No-op on Next 14 (the onRequestError hook lands in Next 15); harmless to
// export now so server-side request errors are captured automatically after
// a future Next upgrade.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
