export async function register() {
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
