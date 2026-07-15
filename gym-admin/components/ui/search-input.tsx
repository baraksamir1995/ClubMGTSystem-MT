'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/cn';

/**
 * SearchInput — debounced search box with leading magnifier and a
 * clear (×) button when there's input.
 *
 * Two usage modes — pick the one that matches the caller's state:
 *
 *   // Mode A — uncontrolled visible value, only the debounced result
 *   //          is reported. Caller doesn't need its own debounce.
 *   <SearchInput
 *     defaultValue=""
 *     onSearch={(q) => fetchRows(0, q)}
 *     debounceMs={400}
 *     placeholder="Search members…"
 *   />
 *
 *   // Mode B — fully controlled. Caller owns `value` and any debounce.
 *   <SearchInput
 *     value={q}
 *     onValueChange={setQ}
 *     placeholder="Search…"
 *   />
 */
export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  /** Controlled visible value. */
  value?: string;
  /** Fires on every keystroke (controlled mode). */
  onValueChange?: (value: string) => void;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Fires after the user stops typing for `debounceMs`. */
  onSearch?: (value: string) => void;
  /** Quiet-period before `onSearch` fires. Defaults to 400ms. */
  debounceMs?: number;
  /** Tweak the wrapper. */
  className?: string;
}

export function SearchInput({
  value: controlledValue,
  onValueChange,
  defaultValue = '',
  onSearch,
  debounceMs = 400,
  className,
  placeholder = 'Search…',
  ...rest
}: SearchInputProps) {
  const isControlled = controlledValue !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const value = isControlled ? controlledValue! : internal;

  // Debounce `onSearch`. Restart the timer on every keystroke; only
  // fire when the user pauses. `onValueChange` (controlled mode) is
  // intentionally not debounced — callers who want that can use the
  // uncontrolled mode instead.
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!onSearch) return;
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => onSearch(value), debounceMs);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs]);

  const setValue = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      leftIcon={<Search className="w-4 h-4" />}
      rightIcon={value ? (
        <button
          type="button"
          onClick={() => {
            setValue('');
            // If we're in uncontrolled+onSearch mode, fire immediately on
            // clear so the caller's results refresh instantly. The
            // debounce useEffect would otherwise add 400ms of latency.
            onSearch?.('');
          }}
          // Full-width 44px hit target inside the (min-h-11) input; the
          // negative margin keeps the visual footprint compact.
          className="min-w-11 self-stretch -my-1 inline-flex items-center justify-center rounded text-fg-muted hover:text-fg transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : undefined}
      className={cn(className)}
      {...rest}
    />
  );
}
