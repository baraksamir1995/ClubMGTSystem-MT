import type { ElementType, ReactNode } from 'react';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Optional small neutral icon next to the label (no coloured tile). */
  icon?: ElementType;
  /** Secondary line under the value. */
  sub?: ReactNode;
  /**
   * Colour the value only when the colour carries meaning (good/bad
   * outcome, needs attention). Default is the normal text colour.
   */
  tone?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const TONE: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

/**
 * Single metric tile used across dashboard pages. Deliberately plain:
 * one neutral icon, one label, one value. Avoid per-card colours that
 * don't mean anything.
 */
export function StatCard({ label, value, icon: Icon, sub, tone = 'default', className = '' }: StatCardProps) {
  return (
    <div className={`bg-surface-2 border border-line rounded-xl p-4 ${className}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
        {Icon && <Icon aria-hidden className="w-3.5 h-3.5 text-fg-faint" />}
        {label}
      </p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${TONE[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-fg-faint mt-0.5">{sub}</p>}
    </div>
  );
}
