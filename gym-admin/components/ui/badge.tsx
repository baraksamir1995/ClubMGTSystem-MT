'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * Badge — small pill used for statuses, roles, counts, and category
 * chips. Semantic `variant` chooses the tint; surfaces sit on dark
 * backgrounds.
 *
 *   <Badge variant="success">Active</Badge>
 *   <Badge variant="warning">Low balance</Badge>
 *   <Badge variant="danger">Expired</Badge>
 *   <Badge variant="brand">Coach</Badge>
 *   <Badge variant="neutral" size="sm">Internal</Badge>
 */
const badge = cva(
  'inline-flex items-center gap-1 font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-3 text-fg-muted border border-line',
        brand:   'bg-brand/15 text-brand border border-brand/40',
        success: 'bg-success-soft text-success border border-success/40',
        warning: 'bg-warning-soft text-warning border border-warning/40',
        danger:  'bg-danger-soft  text-danger  border border-danger/40',
      },
      size: {
        sm: 'text-[10px] leading-none px-2 py-0.5 rounded',
        md: 'text-xs    leading-none px-2 py-1   rounded-md',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size:    'md',
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant, size, className, ...rest },
  ref,
) {
  return <span ref={ref} className={cn(badge({ variant, size }), className)} {...rest} />;
});
