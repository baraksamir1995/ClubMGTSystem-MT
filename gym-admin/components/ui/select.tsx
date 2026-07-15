'use client';

import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Select — styled native `<select>`. The native popup keeps keyboard
 * accessibility for free; the chrome around it matches the rest of
 * the design system.
 *
 *   <Select value={trainerId} onChange={e => setTrainerId(e.target.value)}>
 *     <option value="">All specialists</option>
 *     {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
 *   </Select>
 *
 * For a labelled inline filter (with a leading icon), pair with `<Field>`
 * or set `leftAdornment`.
 */
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  children: ReactNode;
  leftAdornment?: ReactNode;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, leftAdornment, invalid, className, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        'relative flex items-center w-full min-h-11',
        'bg-surface-2 border border-line-strong rounded-lg',
        'focus-within:border-focus focus-within:ring-2 focus-within:ring-focus',
        'transition-colors duration-150',
        invalid && 'border-danger focus-within:border-danger focus-within:ring-danger',
        className,
      )}
    >
      {leftAdornment && (
        <span className="pl-3 pr-1 text-fg-muted flex items-center" aria-hidden>
          {leftAdornment}
        </span>
      )}
      <select
        ref={ref}
        className={cn(
          // `appearance-none` strips the OS chevron so we can render
          // our own from lucide. `pr-9` reserves space for it.
          'appearance-none flex-1 min-w-0 bg-transparent outline-none',
          'px-3 py-2.5 pr-9 text-sm text-fg',
          'cursor-pointer',
          leftAdornment && 'pl-1',
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted"
        aria-hidden
      />
    </div>
  );
});
