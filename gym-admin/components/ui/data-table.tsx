'use client';

import { type ReactNode, type Key } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * DataTable — columnar list with sticky header, loading + empty
 * states, optional row click handler.
 *
 *   <DataTable
 *     columns={[
 *       { key: 'date',    header: 'Date / Time', cell: (r) => <DateCell r={r} /> },
 *       { key: 'member',  header: 'Member',      cell: (r) => <MemberCell r={r} /> },
 *       { key: 'price',   header: 'Price',       cell: (r) => fmtMoney(r.price), align: 'right' },
 *     ]}
 *     rows={data}
 *     rowKey={(r) => r.id}
 *     loading={loading}
 *     empty={<EmptyState title="Nothing yet" />}
 *     onRowClick={(r) => router.push(`/x/${r.id}`)}
 *   />
 *
 * Pagination lives in its own `<Pagination>` component — keep them
 * adjacent in the caller.
 */
export interface DataTableColumn<T> {
  /** Stable key for React + the column id used in onSort, etc. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Cell + header alignment. Defaults to `left`. */
  align?: 'left' | 'center' | 'right';
  /** Inline width override. Numbers become px. */
  width?: string | number;
  /** Hide on small screens (sm: < 640px). */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => Key;
  /** Fetcher is running. Renders a spinner on first load and dims the body on refresh. */
  loading?: boolean;
  /** Rendered when `rows.length === 0 && !loading`. */
  empty?: ReactNode;
  /** Fires when a row is clicked. Makes the whole row hoverable. */
  onRowClick?: (row: T) => void;
  /** Per-row class override — e.g. tint a row by status. Merged after
   *  the base row classes, so it can override background/hover. */
  rowClassName?: (row: T) => string | undefined;
  /** Extra classes for the outer surface wrapper. */
  className?: string;
}

const alignClass = (a?: 'left' | 'center' | 'right') =>
  a === 'right'  ? 'text-right'
: a === 'center' ? 'text-center'
:                  'text-left';

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  onRowClick,
  rowClassName,
  className,
}: DataTableProps<T>) {
  const isInitialLoad = loading && rows.length === 0;
  const showEmpty     = !loading && rows.length === 0 && empty !== undefined;

  return (
    <div
      className={cn(
        'relative bg-surface-2 border border-line rounded-xl overflow-hidden',
        className,
      )}
    >
      {/* Subtle veil during background refreshes — the body underneath
          is still readable, just lower contrast. */}
      {loading && rows.length > 0 && (
        <div className="absolute inset-0 z-10 bg-surface/40 pointer-events-none flex items-start justify-center pt-3">
          <Loader2 className="w-4 h-4 text-fg-muted animate-spin" aria-label="Refreshing" />
        </div>
      )}

      {/* Horizontal scroll only on narrow viewports; sticky header
          stays put while the body scrolls. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-surface-2 text-[11px] uppercase tracking-wide text-fg-muted border-b border-line">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 font-medium',
                    alignClass(col.align),
                    col.hideOnMobile && 'hidden sm:table-cell',
                  )}
                  style={col.width ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isInitialLoad && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <Loader2 className="w-5 h-5 text-fg-muted animate-spin inline" aria-label="Loading" />
                </td>
              </tr>
            )}
            {showEmpty && (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {empty}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const clickable = Boolean(onRowClick);
              return (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'border-b border-line last:border-b-0',
                    clickable && 'cursor-pointer hover:bg-surface-3 transition-colors',
                    rowClassName?.(row),
                  )}
                  onClick={clickable ? () => onRowClick!(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 align-top',
                        alignClass(col.align),
                        col.hideOnMobile && 'hidden sm:table-cell',
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
