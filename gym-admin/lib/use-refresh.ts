'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Returns a function that invalidates the Next.js Router Cache.
 * Call this after any mutation (create/update/delete) so that
 * navigating away and back shows fresh server data.
 *
 * Uses router.refresh() directly for immediate local update,
 * plus dispatches 'data-mutated' event for the MutationListener.
 */
export function useRefresh() {
  const router = useRouter();
  return useCallback(() => {
    router.refresh();
  }, [router]);
}

/**
 * Call this from any component after a successful mutation.
 * Dispatches a custom event that the MutationListener picks up.
 */
export function notifyMutation() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('data-mutated'));
  }
}
