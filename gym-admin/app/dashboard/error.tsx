'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-400 font-semibold">Something went wrong</p>
      <p className="text-fg-muted text-sm font-mono bg-surface-2 px-4 py-2 rounded-lg max-w-xl break-all">
        Something went wrong. Please try again.{error.digest ? ` (ref: ${error.digest})` : ''}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-brand text-brand-ink text-sm rounded-lg hover:bg-brand-dim"
      >
        Try again
      </button>
    </div>
  );
}
