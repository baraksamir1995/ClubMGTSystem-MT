import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn(...inputs)` — the standard "merge a bunch of class names" helper.
 *
 * - `clsx`        flattens nested arrays, drops falsy values, lets callers
 *                 pass strings / objects / arrays freely.
 * - `twMerge`     dedupes conflicting Tailwind utilities (a later
 *                 `bg-surface-2` wins over an earlier `bg-surface`).
 *
 * Use this in every `components/ui/*` primitive so callers can pass
 * a `className` prop to override styling without fighting specificity.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
