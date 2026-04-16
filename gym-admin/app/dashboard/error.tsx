'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-400 font-semibold">Something went wrong</p>
      <p className="text-gray-400 text-sm font-mono bg-gray-800 px-4 py-2 rounded-lg max-w-xl break-all">
        {error.message}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
      >
        Try again
      </button>
    </div>
  );
}
