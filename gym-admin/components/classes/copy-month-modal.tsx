'use client';

import { useState } from 'react';
import { CalendarPlus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';

interface Props {
  branchId: string | null;
  branchName: string | null;
  onClose: () => void;
  onCopied: () => void;
}

const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

function monthLabel(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return MONTH_FMT.format(d);
}

/** 'YYYY-MM' for a month offset from today, in local time. */
function monthValue(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * A rolling window of months around today, as {value,label}.
 *
 * Deliberately NOT the calendar year: in December a year-bounded list leaves
 * exactly one selectable target (December itself, which is also the source),
 * making the December -> January roll — the most common use of this feature —
 * impossible. The window spans `back` months of history to copy FROM and
 * `forward` months ahead to copy INTO, and always crosses the year boundary.
 */
function monthWindow(back: number, forward: number): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: back + forward + 1 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back + i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTH_FMT.format(d),
    };
  });
}

function labelFor(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return MONTH_FMT.format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Format an ISO date (YYYY-MM-DD) as "Month YYYY" in UTC, so a server tz of
 * UTC and a client tz east-of-UTC don't disagree about which month it is.
 */
function monthLabelFromIso(iso: string): string {
  return MONTH_FMT.format(new Date(iso + 'T00:00:00Z'));
}

export default function CopyMonthModal({ branchId, branchName, onClose, onCopied }: Props) {
  const t = useTranslations('classes');
  const tc = useTranslations('common');
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState<{ existing: number; targetStart: string; targetEnd: string } | null>(null);

  // 12 months back to copy from, 12 forward to copy into.
  const months = monthWindow(12, 12);
  // Default to the old behaviour: this month -> next month. Both are always
  // inside the rolling window, including across a year boundary.
  const [source, setSource] = useState(() => monthValue(0));
  const [target, setTarget] = useState(() => monthValue(1));

  const sourceLabel = labelFor(source);
  const targetLabel = labelFor(target);

  // Mirror the two server-side guards so the user sees the problem before
  // spending a round trip on it.
  const thisMonth = monthValue(0);
  const targetInPast = target < thisMonth;
  const sameMonth = source === target;
  const invalid = targetInPast || sameMonth;

  const handleCopy = async () => {
    setLoading(true);
    setConflict(null);
    try {
      const res = await fetch('/api/sessions/copy-to-next-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, sourceMonth: source, targetMonth: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.existing_count != null) {
          setConflict({
            existing: data.existing_count,
            targetStart: data.target_start,
            targetEnd: data.target_end,
          });
        } else {
          toast.error(data.error ?? t('copyMonth.failedToCopy'));
        }
        return;
      }
      // Use the backend's resolved target month for the toast — server tz
      // (Postgres CURRENT_DATE) is the source of truth, not local Date().
      const targetMonth = data.target_start ? monthLabelFromIso(data.target_start) : targetLabel;
      toast.success(t('copyMonth.copySuccess', { created: data.created, templates: data.templates, month: targetMonth }));
      onCopied();
      onClose();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-brand" /> {t('copyMonth.title')}</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-3 px-3 bg-surface border border-line rounded-xl">
          <label className="flex-1 text-center">
            <span className="block text-xs text-fg-faint uppercase tracking-wide">{t('copyMonth.from')}</span>
            <select
              value={source}
              onChange={e => { setSource(e.target.value); setConflict(null); }}
              disabled={loading}
              className="mt-1 w-full bg-surface-2 border border-line rounded-lg px-2 py-1.5 text-sm font-semibold text-fg text-center focus:border-brand focus:outline-none disabled:opacity-50"
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <div className="text-fg-faint pt-4">→</div>
          <label className="flex-1 text-center">
            <span className="block text-xs text-fg-faint uppercase tracking-wide">{t('copyMonth.to')}</span>
            <select
              value={target}
              onChange={e => { setTarget(e.target.value); setConflict(null); }}
              disabled={loading}
              className="mt-1 w-full bg-surface-2 border border-line rounded-lg px-2 py-1.5 text-sm font-semibold text-brand text-center focus:border-brand focus:outline-none disabled:opacity-50"
            >
              {months.map(m => (
                <option key={m.value} value={m.value} disabled={m.value < thisMonth}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>

        {invalid && (
          <p className="text-xs text-warning text-center">
            {sameMonth ? t('copyMonth.errSameMonth') : t('copyMonth.errTargetInPast')}
          </p>
        )}

        {branchName && (
          <p className="text-xs text-fg-muted text-center">
            {t('copyMonth.branch')} <span className="text-fg font-medium">{branchName}</span>
          </p>
        )}

        <ul className="text-xs text-fg-muted space-y-1.5 leading-relaxed">
          <li>· {t('copyMonth.bulletRecurringOnly')}</li>
          <li>· {t('copyMonth.bulletWeekdayPattern', { month: targetLabel })}</li>
          <li>· {t('copyMonth.bulletUnpublished')}</li>
          <li>· {t('copyMonth.bulletNewTemplate', { month: sourceLabel })}</li>
        </ul>

        {conflict && (
          <div className="flex items-start gap-2 p-3 bg-warning-soft border border-warning/30 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">{t('copyMonth.conflictTitle')}</p>
              <p className="text-xs text-fg-muted mt-0.5">
                {t('copyMonth.conflictBody', {
                  month: targetLabel,
                  count: conflict.existing,
                  plural: conflict.existing !== 1 ? t('copyMonth.conflictPluralSuffix') : '',
                  branch: branchName ? `${t('copyMonth.conflictBranchPrefix')}${branchName}` : '',
                })}
              </p>
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleCopy} disabled={!!conflict || invalid} isLoading={loading}
          leftIcon={<CalendarPlus className="w-3.5 h-3.5" />}>
          {t('copyMonth.copySchedule')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
