'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Textarea — multi-line input with the same surface treatment as
 * `<Input>`.
 *
 *   <Textarea rows={3} placeholder="Short bio…" value={…} onChange={…} />
 */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visual error state — red border. `Field` flips this for you. */
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full bg-surface-2 border border-line-strong rounded-lg',
        'px-3 py-2.5 text-sm text-fg placeholder:text-fg-faint',
        'outline-none resize-y',
        'focus:border-focus focus:ring-2 focus:ring-focus',
        'transition-colors duration-150',
        invalid && 'border-danger focus:border-danger focus:ring-danger',
        className,
      )}
      {...rest}
    />
  );
});
