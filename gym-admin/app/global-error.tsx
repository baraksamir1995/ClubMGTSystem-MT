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
          <p>An unexpected error occurred while loading the dashboard. Refreshing usually fixes it.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#f5f5f5',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            Refresh page
          </button>
        </div>
      </body>
    </html>
  );
}
