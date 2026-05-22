'use client';

import { Children, cloneElement, isValidElement, useId, type ReactNode, type ReactElement } from 'react';
import { cn } from '@/lib/cn';

/**
 * Field — wraps a label, optional hint, and error message around a
 * form control (Input / Textarea / Select / PasswordInput).
 *
 *   <Field label="Email" required hint="We'll never share this.">
 *     <Input type="email" value={…} onChange={…} />
 *   </Field>
 *
 *   <Field label="Password" error={passwordError}>
 *     <PasswordInput value={…} onChange={…} />
 *   </Field>
 *
 * The Field generates a stable `id` (via `useId`) and clones the child
 * to inject `id`, `aria-describedby` (hint), and `aria-invalid` (when
 * an error is present). Children just need to forward those props to
 * their native control — all of the primitives in `components/ui/` do.
 */
export interface FieldProps {
  label: ReactNode;
  /** Optional helper text rendered under the input in muted ink. */
  hint?: ReactNode;
  /** Inline error message. When set, the input is marked `aria-invalid`
   *  and rendered with a danger-tinted border. */
  error?: ReactNode;
  /** Renders a small red asterisk after the label. Does not enforce
   *  validation — that's the input's job. */
  required?: boolean;
  /** Extra classes on the outer wrapper. */
  className?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; invalid?: boolean }>;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const reactId = useId();
  // Strip the colons React adds — some libraries (Radix etc.) reject them.
  const id      = `field-${reactId.replace(/:/g, '')}`;
  const hintId  = hint  ? `${id}-hint`  : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // Clone the child so the caller doesn't have to plumb `id` /
  // `aria-*` manually. Only one direct child is supported — keeps
  // the API predictable.
  const child = Children.only(children);
  const decorated = isValidElement(child)
    ? cloneElement(child, {
        id,
        'aria-describedby': cn(hintId, errorId) || undefined,
        'aria-invalid': Boolean(error) || undefined,
        invalid: Boolean(error) || undefined,
      })
    : child;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {decorated}
      {hint && !error && (
        <p id={hintId} className="text-[11px] text-fg-faint">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-[11px] text-danger">{error}</p>
      )}
    </div>
  );
}
