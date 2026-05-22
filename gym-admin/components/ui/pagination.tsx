'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Pagination — server-side prev/page/next. The caller owns the
 * fetcher; this component just emits new offsets when the user
 * clicks.
 *
 *   <Pagination
 *     total={total}
 *     limit={PAGE_SIZE}
 *     offset={offset}
 *     onChange={(nextOffset) => fetchRows(nextOffset)}
 *     loading={loading}
 *   />
 *
 * Renders nothing when `total <= limit` — saves UI space on the small
 * data sets where pagination would just be noise.
 */
export interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (newOffset: number) => void;
  /** Disables the controls while a fetch is in flight. */
  loading?: boolean;
  /** Override the inline summary text. Defaults to "Page X of Y". */
  summary?: ReactNode;
  className?: string;
}

export function Pagination({
  total,
  limit,
  offset,
  onChange,
  loading = false,
  summary,
  className,
}: PaginationProps) {
  if (total <= limit) return null;

  const pageCount   = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const atFirst     = offset <= 0;
  const atLast      = offset + limit >= total;

  const goPrev = () => onChange(Math.max(0, offset - limit));
  const goNext = () => onChange(offset + limit);

  return (
    <div className={cn('flex items-center justify-between text-xs text-fg-muted', className)}>
      <button
        type="button"
        disabled={atFirst || loading}
        onClick={goPrev}
        className="px-2.5 py-1.5 border border-line rounded-lg hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Newer
      </button>
      <span>
        {summary ?? <>Page {currentPage} of {pageCount}</>}
      </span>
      <button
        type="button"
        disabled={atLast || loading}
        onClick={goNext}
        className="px-2.5 py-1.5 border border-line rounded-lg hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Older →
      </button>
    </div>
  );
}
