'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Root-level error boundary — catches errors thrown in the root layout that
// the segment-level app/dashboard/error.tsx can't. Reports to Sentry, then
// renders a minimal fallback. Restyle to match the dashboard if desired.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>Please refresh the page or try again.</p>
        </div>
      </body>
    </html>
  );
}
