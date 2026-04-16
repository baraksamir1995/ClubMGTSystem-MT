'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, AlertTriangle } from 'lucide-react';

export default function MemberDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[MemberDetail] page error:', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/members"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Members
      </Link>

      <div className="bg-gray-800 border border-red-500/30 rounded-xl p-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Could not load member</h2>
          <p className="text-sm text-gray-400">
            Something went wrong rendering this page. Try refreshing, or go back to the member list.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard/members"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Back to Members
          </Link>
        </div>
      </div>
    </div>
  );
}
