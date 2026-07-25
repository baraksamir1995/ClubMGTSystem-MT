'use client';

import { Phone, MessageCircle, Flame, Clock, UserX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SCORE_STYLES, STAGE_LABELS, labelize, telHref, waHref } from './lib';

/** hot = red, warm = amber, cold = sky. Null score → muted "Unscored". */
export function ScoreChip({ score, className }: { score: string | null | undefined; className?: string }) {
  if (!score) {
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-3 text-fg-faint', className)}>
        Unscored
      </span>
    );
  }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize',
      SCORE_STYLES[score] ?? 'bg-surface-3 text-fg-muted',
      className,
    )}>
      {score === 'hot' && <Flame className="w-3 h-3" />}
      {score}
    </span>
  );
}

export function StageChip({ stage, className }: { stage: string; className?: string }) {
  const tone =
    stage === 'converted' ? 'bg-success-soft text-success'
    : stage === 'lost'    ? 'bg-danger-soft text-danger'
    :                       'bg-surface-3 text-fg-muted';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', tone, className)}>
      {STAGE_LABELS[stage] ?? labelize(stage)}
    </span>
  );
}

/** SLA / follow-up warning badges from the list endpoint's `flags`. */
export function FlagBadges({ flags, className }: {
  flags: { unassigned_sla_breach?: boolean; uncontacted?: boolean; unqualified_sla_breach?: boolean } | null | undefined;
  className?: string;
}) {
  if (!flags) return null;
  const items: Array<{ key: string; label: string; icon: typeof Clock }> = [];
  if (flags.unassigned_sla_breach) items.push({ key: 'unassigned', label: 'Unassigned SLA', icon: UserX });
  if (flags.uncontacted)           items.push({ key: 'uncontacted', label: 'Uncontacted', icon: Phone });
  if (flags.unqualified_sla_breach) items.push({ key: 'unqualified', label: 'Qualify overdue', icon: Clock });
  if (items.length === 0) return null;
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {items.map(({ key, label, icon: Icon }) => (
        <span key={key} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-danger-soft text-danger">
          <Icon className="w-2.5 h-2.5" />
          {label}
        </span>
      ))}
    </span>
  );
}

/**
 * Tap-friendly call + WhatsApp buttons for a phone number. Stops
 * propagation so they work inside clickable rows/cards.
 */
export function ContactLinks({ phone, compact = false }: { phone: string; compact?: boolean }) {
  const size = compact ? 'w-9 h-9' : 'w-11 h-11';
  return (
    <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <a
        href={telHref(phone)}
        aria-label={`Call ${phone}`}
        title="Call"
        className={cn(size, 'inline-flex items-center justify-center rounded-lg bg-surface-3 text-fg-muted hover:text-brand hover:bg-brand/15 transition-colors')}
      >
        <Phone className="w-4 h-4" />
      </a>
      <a
        href={waHref(phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`WhatsApp ${phone}`}
        title="WhatsApp"
        className={cn(size, 'inline-flex items-center justify-center rounded-lg bg-surface-3 text-fg-muted hover:text-success hover:bg-success-soft transition-colors')}
      >
        <MessageCircle className="w-4 h-4" />
      </a>
    </span>
  );
}
