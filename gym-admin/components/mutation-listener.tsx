'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Listens for custom 'data-mutated' events and calls router.refresh()
 * to invalidate the Next.js Router Cache after mutations.
 *
 * Components should dispatch this event after successful mutations:
 *   window.dispatchEvent(new Event('data-mutated'));
 *
 * Previous approach (intercepting window.fetch) was too aggressive —
 * it triggered router.refresh() on every POST/PATCH/DELETE, causing
 * client components to remount and flash empty state.
 */
export default function MutationListener() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = () => {
      // Debounce: if multiple mutations fire quickly, only refresh once
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => router.refresh(), 300);
    };

    window.addEventListener('data-mutated', handler);
    return () => {
      window.removeEventListener('data-mutated', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [router]);

  return null;
}
