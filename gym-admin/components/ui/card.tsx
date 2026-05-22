'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * Card — the standard surface tile (bordered, rounded, padded).
 * Use for any "panel of content on the page" — stat tiles, list items,
 * empty-state containers, etc.
 *
 *   <Card>...</Card>
 *   <Card padding="lg">...</Card>
 *   <Card variant="hoverable" onClick={open}>...</Card>
 *
 * For multi-section cards, split into <Card.Header> + <Card.Body> +
 * <Card.Footer>; they just provide consistent padding + dividers.
 */
const card = cva(
  'bg-surface-2 border border-line rounded-2xl',
  {
    variants: {
      padding: {
        none: 'p-0',
        sm:   'p-3',
        md:   'p-4',
        lg:   'p-6',
      },
      variant: {
        default:   '',
        hoverable: 'transition-colors hover:bg-surface-3 cursor-pointer',
        muted:     'bg-surface-2/60', // slightly softer fill
      },
    },
    defaultVariants: {
      padding: 'md',
      variant: 'default',
    },
  },
);

export type CardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof card>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding, variant, className, ...rest },
  ref,
) {
  return <div ref={ref} className={cn(card({ padding, variant }), className)} {...rest} />;
});

interface SlotProps { children: ReactNode; className?: string }

function CardHeader({ children, className }: SlotProps) {
  return <div className={cn('px-4 py-3 border-b border-line', className)}>{children}</div>;
}
(Card as typeof Card & { Header: typeof CardHeader }).Header = CardHeader;

function CardBody({ children, className }: SlotProps) {
  return <div className={cn('p-4', className)}>{children}</div>;
}
(Card as typeof Card & { Body: typeof CardBody }).Body = CardBody;

function CardFooter({ children, className }: SlotProps) {
  return <div className={cn('px-4 py-3 border-t border-line', className)}>{children}</div>;
}
(Card as typeof Card & { Footer: typeof CardFooter }).Footer = CardFooter;
