'use client';

import { type ReactNode, type ComponentType } from 'react';
import { cn } from '@/lib/cn';

/**
 * EmptyState — centered "nothing here yet" message with an icon, a
 * title, optional description, and one or two actions.
 *
 *   <EmptyState
 *     icon={Users}
 *     title="No specialists yet"
 *     description="Add your first specialist to assign session packages."
 *     action={<Button onClick={openCreate}>Add specialist</Button>}
 *   />
 *
 * Slots in nicely inside a `<Card>` for inline-empty rows, or stands on
 * its own as a full-page empty state.
 */
export interface EmptyStateProps {
  /** Lucide icon component. Rendered at 22×22 in a circular surface chip. */
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  /** Primary CTA (and optionally a secondary). Pass a `<Button>` or a fragment. */
  action?: ReactNode;
  /** Compact variant — used inside small cards / list rows. */
  size?: 'sm' | 'md';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  const isSm = size === 'sm';
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      isSm ? 'py-8 px-4 gap-2' : 'py-12 px-6 gap-3',
      className,
    )}>
      {Icon && (
        <div className={cn(
          'rounded-full bg-surface-3 border border-line flex items-center justify-center',
          isSm ? 'w-10 h-10' : 'w-14 h-14',
        )}>
          <Icon className={cn(isSm ? 'w-5 h-5' : 'w-6 h-6', 'text-fg-muted')} />
        </div>
      )}
      <div className={cn(
        'font-medium text-fg',
        isSm ? 'text-sm' : 'text-base',
      )}>
        {title}
      </div>
      {description && (
        <div className={cn(
          'text-fg-muted max-w-sm',
          isSm ? 'text-xs' : 'text-sm',
        )}>
          {description}
        </div>
      )}
      {action && <div className={cn('flex gap-2', isSm ? 'mt-1' : 'mt-2')}>{action}</div>}
    </div>
  );
}
