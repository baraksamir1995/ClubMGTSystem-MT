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
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      variant: {
        // Filled brand button. `brand-fill` stays neon in both themes;
        // ink text + `brand-edge` border keep AAA text contrast and a
        // ≥3:1 boundary on light surfaces.
        primary: 'bg-brand-fill text-brand-ink border border-brand-edge hover:bg-brand-dim active:bg-brand-dim',
        // Subtle surface fill. Used for cancel / secondary actions.
        secondary: 'bg-surface-3 text-fg border border-line-strong hover:bg-surface-4',
        // Borderless transparent button. Used in dense rows or table cells.
        ghost: 'bg-transparent text-fg hover:bg-surface-3',
        // Destructive — danger-tinted background; solid fill on hover
        // pairs with `on-status` text so contrast holds in both themes.
        danger: 'bg-danger-soft text-danger border border-danger hover:bg-danger hover:text-on-status',
      },
      // All sizes meet the 44px (2.5.5 AAA) minimum target height.
      size: {
        sm: 'min-h-11 px-3 text-xs',
        md: 'min-h-11 px-4 text-sm',
        lg: 'min-h-12 px-5 text-[15px]',
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
