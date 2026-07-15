'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Input — single-line text input styled to the design system.
 *
 *   <Input type="email" value={…} onChange={…} placeholder="you@gym.com" />
 *   <Input leftIcon={<Mail className="w-4 h-4" />} placeholder="Mobile number" />
 *
 * When wrapped in `<Field>`, `id` / `aria-*` / `invalid` are injected
 * automatically.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Leading adornment, rendered inside the input pill on the left. */
  leftIcon?: ReactNode;
  /** Trailing adornment — icons or interactive buttons (e.g. show/hide). */
  rightIcon?: ReactNode;
  /** Visual error state — red border. `Field` flips this for you. */
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leftIcon, rightIcon, invalid, className, type = 'text', ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        'group relative flex items-center w-full min-h-11',
        // `line-strong` keeps the control boundary ≥3:1 in both themes;
        // the solid `focus` ring is the 2px ≥3:1 focus indicator.
        'bg-surface-2 border border-line-strong rounded-lg',
        'focus-within:border-focus focus-within:ring-2 focus-within:ring-focus',
        'transition-colors duration-150',
        invalid && 'border-danger focus-within:border-danger focus-within:ring-danger',
        className,
      )}
    >
      {leftIcon && (
        <span className="ps-3 pe-1 text-fg-muted flex items-center" aria-hidden>
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        type={type}
        className={cn(
          'peer flex-1 min-w-0 bg-transparent outline-none',
          'px-3 py-2.5 text-sm text-fg placeholder:text-fg-faint',
          // Trim leading padding when an icon is present (icon block has px).
          // Logical props so the trim follows the writing direction (RTL).
          leftIcon  && 'ps-1',
          rightIcon && 'pe-1',
          // Hide the browser's password reveal — we ship `<PasswordInput>` for that.
          '[&::-ms-reveal]:hidden [&::-ms-clear]:hidden',
        )}
        {...rest}
      />
      {rightIcon && (
        <span className="pe-2 ps-1 text-fg-muted flex items-center">
          {rightIcon}
        </span>
      )}
    </div>
  );
});
