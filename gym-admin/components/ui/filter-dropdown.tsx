'use client';

import { type ComponentType, type ReactNode } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * FilterDropdown — labelled native `<select>` for filter bars.
 * Displays as a compact pill so it sits inline next to other filter
 * controls.
 *
 *   <FilterDropdown
 *     label="Specialist"
 *     value={trainerId}
 *     onChange={setTrainerId}
 *     options={[
 *       { value: '',   label: 'All specialists' },
 *       ...trainers.map(t => ({ value: t.id, label: t.name })),
 *     ]}
 *   />
 *
 * Pass `icon={SomeLucideIcon}` to override the default Filter glyph.
 */
export interface FilterOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface FilterDropdownProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  /** Leading icon (lucide-react). Defaults to `Filter`. */
  icon?: ComponentType<{ className?: string }>;
  /** Disable the whole control. */
  disabled?: boolean;
  className?: string;
}

export function FilterDropdown({
  label,
  value,
  onChange,
  options,
  icon: Icon = Filter,
  disabled,
  className,
}: FilterDropdownProps) {
  return (
    <label
      className={cn(
        'relative inline-flex items-center gap-2 pl-2.5 pr-7 py-2',
        'bg-surface-2 border border-line rounded-lg',
        'text-xs text-fg',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-3',
        'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30',
        'transition-colors duration-150',
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5 text-fg-muted" aria-hidden />
      <span className="text-fg-muted">{label}:</span>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-fg outline-none cursor-pointer disabled:cursor-not-allowed"
      >
        {options.map((opt) => (
          <option
            key={opt.value || '_all'}
            value={opt.value}
            disabled={opt.disabled}
            // Inline bg for the native popup — Chrome ignores Tailwind here.
            style={{ background: '#0A0A0A', color: '#F5F5F2' }}
          >
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted"
        aria-hidden
      />
    </label>
  );
}
