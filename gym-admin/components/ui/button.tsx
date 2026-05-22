'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Button — the canonical filled / outline / ghost / danger button.
 *
 * Reads design-system tokens from tailwind.config (`brand`, `surface`,
 * `line`, `fg`, `danger`) so a future brand tweak only changes the
 * config. Callers should never reach for raw `purple-*` / `gray-*`
 * classes; pass a `variant` instead.
 *
 *   <Button variant="primary"   onClick={save}>Save</Button>
 *   <Button variant="secondary" leftIcon={<Plus className="w-4 h-4"/>}>Add</Button>
 *   <Button variant="ghost"    size="sm">Cancel</Button>
 *   <Button variant="danger"   isLoading>Deleting…</Button>
 */
const button = cva(
  // Base — applied to every variant. The text-color side is intentionally
  // omitted here; variants set it so the contrast token always matches
  // the background (e.g. brand bg → brand-ink text).
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-lg font-medium select-none whitespace-nowrap',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      variant: {
        // Filled brand-green button. Text is brand-ink (dark) — the
        // neon green is too bright for white text.
        primary: 'bg-brand text-brand-ink hover:bg-brand-dim active:bg-brand-dim',
        // Subtle dark fill. Used for cancel / secondary actions.
        secondary: 'bg-surface-3 text-fg border border-line hover:bg-surface-4',
        // Borderless transparent button. Used in dense rows or table cells.
        ghost: 'bg-transparent text-fg hover:bg-surface-3',
        // Destructive — red-tinted background, brighter danger text.
        danger: 'bg-danger-soft text-danger border border-danger hover:bg-danger hover:text-fg',
      },
      size: {
        sm: 'h-8  px-3   text-xs',
        md: 'h-10 px-4   text-sm',
        lg: 'h-12 px-5   text-[15px]',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    fullWidth,
    isLoading = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    className,
    ...rest
  },
  ref,
) {
  const effectiveDisabled = disabled || isLoading;
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={effectiveDisabled}
      aria-busy={isLoading || undefined}
      className={cn(button({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});
