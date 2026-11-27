'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarX2, Pause, Pencil, Play, SkipForward } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { fmtDateTimeGym } from '@/lib/time';
import { apiErrorMessage } from '@/lib/api-error';
import { Badge, Button, Modal } from '@/components/ui';
import { scheduleLabel, type ScheduleDetail, type ScheduleEvent } from '@/lib/recurring-expenses';
import { expenseMethodLabel, statusVariant } from './expense-modal';

interface Props {
  scheduleId: string | null;
  today: string;
  canEdit: boolean;
  canDelete: boolean;
  fmtMoney: (n: number, currency?: string) => string;
  fmtDay: (ymd: string) => string;
  onClose: () => void;
  /** Switch to another version (split chain). */
  onOpenSchedule: (id: string) => void;
  onEditSchedule: (s: ScheduleDetail, from: string) => void;
  onEditUpcoming: (s: ScheduleDetail, date: string) => void;
  /** Something changed server-side: refresh the overview. */
  onChanged: () => void;
  /** Bumped by the parent after an edit saved elsewhere, to refetch. */
  reloadKey?: number;
}

type Confirm =
  | { kind: 'pause' }
  | { kind: 'end' }
  | { kind: 'skip'; date: string };

/**
 * Recurring expense details: definition, status + lifecycle actions,
 * next occurrences (edit-only / skip), occurrence history and activity.
 */
export default function RecurringScheduleModal({
  scheduleId, today, canEdit, canDelete, fmtMoney, fmtDay, onClose, onOpenSchedule, onEditSchedule, onEditUpcoming, onChanged, reloadKey,
}: Props) {
  const t = useTranslations('payments.financial');
  const tr = useTranslations('payments.financial.recurring');
  const tm = useTranslations('payments.method');
  const tc = useTranslations('common');
  const tErr = useTranslations('common.errors');
  const locale = useLocale();

  const [data, setData] = useState<ScheduleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const load = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/expenses/recurring/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(apiErrorMessage(json, res.status, tErr)); return; }
      setData(json as ScheduleDetail);
    } catch {
      setError(tc('networkError'));
    }
  }, [tErr, tc]);

  useEffect(() => {
    setData(null);
    setConfirm(null);
    if (scheduleId) load(scheduleId);
  }, [scheduleId, load, reloadKey]);

  const act = async (url: string, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr) || tr('toast.actionFailed')); return; }
      toast.success(okMsg);
      setConfirm(null);
      onChanged();
      if (scheduleId) await load(scheduleId);
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setBusy(false);
    }
  };

  const money = (n: number) => fmtMoney(n, data?.currency);
  const s = data;
  const editable = !!s && s.status !== 'ended';

  const eventText = (e: ScheduleEvent) => {
    const d = (e.details ?? {}) as Record<string, unknown>;
    const date = typeof d.scheduled_date === 'string' ? fmtDay(d.scheduled_date)
      : typeof d.effective_from === 'string' ? fmtDay(d.effective_from) : '';
    return tr(`events.${e.action}` as any, { date });
  };

  return (
    <>
      <Modal open={scheduleId !== null && confirm === null} onClose={onClose} size="lg">
        <Modal.Header>{tr('detailsTitle')}</Modal.Header>
        <Modal.Body>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {!s && !error && <p className="text-sm text-fg-muted">…</p>}
          {s && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-fg break-words">{s.title}</p>
                  <p className="text-sm text-fg-muted">{scheduleLabel(s, tr as any, locale)}</p>
                </div>
                <Badge variant={statusVariant(s.status)}>{t(`scheduleStatus.${s.status}` as any)}</Badge>
              </div>

              {s.continued_by && (
                <Notice text={tr('continuedBy')} action={tr('openNew')} onClick={() => onOpenSchedule(s.continued_by!)} />
              )}
              {s.previous_id && (
                <Notice text={tr('continues')} action={tr('openPrevious')} onClick={() => onOpenSchedule(s.previous_id!)} />
              )}

              <dl className="divide-y divide-line border-y border-line">
                {([
                  [t('form.amount'), money(s.amount)],
                  [tr('currency'), s.currency],
                  [t('form.category'), t(`categories.${s.category}` as any)],
                  [t('form.method'), expenseMethodLabel(tm, s.payment_method, t('form.noMethod'))],
                  [t('form.vendor'), s.vendor || '—'],
                  [tr('frequency'), t(`frequency.${s.frequency}` as any)],
                  [tr('startDate'), fmtDay(s.start_date)],
                  [tr('endDate'), s.end_date ? fmtDay(s.end_date) : tr('ongoing')],
                  [tr('nextOccurrence'), s.next_occurrence ? fmtDay(s.next_occurrence) : '—'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 py-2 text-sm">
                    <dt className="text-fg-muted">{k}</dt>
                    <dd className="text-fg text-end break-words min-w-0">{v}</dd>
                  </div>
                ))}
              </dl>
              {s.description && (
                <div>
                  <p className="text-xs text-fg-muted uppercase tracking-wide font-medium mb-1">{t('form.description')}</p>
                  <p className="text-sm text-fg whitespace-pre-wrap break-words">{s.description}</p>
                </div>
              )}

              {(canEdit || canDelete) && editable && (
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <Button size="sm" variant="secondary" leftIcon={<Pencil className="w-4 h-4" />}
                      onClick={() => onEditSchedule(s, s.next_occurrence && s.next_occurrence > today ? s.next_occurrence : today)}>
                      {tr('editSchedule')}
                    </Button>
                  )}
                  {canEdit && s.status === 'active' && (
                    <Button size="sm" variant="secondary" leftIcon={<Pause className="w-4 h-4" />} onClick={() => setConfirm({ kind: 'pause' })}>
                      {tr('pause')}
                    </Button>
                  )}
                  {canEdit && s.status === 'paused' && (
                    <Button size="sm" variant="secondary" isLoading={busy} leftIcon={<Play className="w-4 h-4" />}
                      onClick={() => act(`/api/expenses/recurring/${s.id}/resume`, tr('toast.resumed'))}>
                      {tr('resume')}
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="sm" variant="danger" leftIcon={<CalendarX2 className="w-4 h-4" />} onClick={() => setConfirm({ kind: 'end' })}>
                      {tr('end')}
                    </Button>
                  )}
                </div>
              )}

              {s.status === 'active' && s.upcoming.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-fg mb-2">{tr('upcomingTitle')}</h3>
                  <ul className="divide-y divide-line border border-line rounded-lg">
                    {s.upcoming.map(d => (
                      <li key={d} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="text-fg">{fmtDay(d)}</span>
                        <span className="flex items-center gap-1">
                          <Badge size="sm" variant="brand">{t('occurrenceStatus.upcoming')}</Badge>
                          {canEdit && (
                            <Button size="sm" variant="ghost" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => onEditUpcoming(s, d)}>
                              {tc('edit')}
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="ghost" leftIcon={<SkipForward className="w-3.5 h-3.5" />} onClick={() => setConfirm({ kind: 'skip', date: d })}>
                              {tr('skip')}
                            </Button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold text-fg mb-2">{tr('historyTitle')}</h3>
                {s.occurrences.length === 0 ? (
                  <p className="text-sm text-fg-muted">{tr('historyEmpty')}</p>
                ) : (
                  <div className="overflow-x-auto border border-line rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-2 text-fg-muted text-xs">
                        <tr>
                          <th className="text-start font-medium px-3 py-2">{tr('historyCol.scheduled')}</th>
                          <th className="text-end font-medium px-3 py-2">{tr('historyCol.amount')}</th>
                          <th className="text-start font-medium px-3 py-2">{tr('historyCol.status')}</th>
                          <th className="text-start font-medium px-3 py-2">{tr('historyCol.recorded')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {s.occurrences.map(o => (
                          <tr key={o.id}>
                            <td className="px-3 py-2 text-fg whitespace-nowrap">{fmtDay(o.scheduled_date)}</td>
                            <td className="px-3 py-2 text-fg text-end tabular-nums whitespace-nowrap">{fmtMoney(o.amount, o.currency)}</td>
                            <td className="px-3 py-2"><Badge size="sm" variant={statusVariant(o.status)}>{t(`occurrenceStatus.${o.status}` as any)}</Badge></td>
                            <td className="px-3 py-2 text-fg-muted whitespace-nowrap">{o.recorded_at ? fmtDateTimeGym(o.recorded_at) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {s.events.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-fg mb-2">{tr('auditTitle')}</h3>
                  <ul className="space-y-1.5 text-xs">
                    {s.events.map((e, i) => (
                      <li key={i} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                        <span className="text-fg">{eventText(e)}</span>
                        <span className="text-fg-faint">{e.actor_name ?? tr('auditSystem')} · {fmtDateTimeGym(e.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={onClose}>{tc('close')}</Button>
        </Modal.Footer>
      </Modal>

      {/* Destructive / state-changing confirmations. */}
      <Modal open={confirm !== null && !!s} onClose={() => !busy && setConfirm(null)} size="sm" closeOnBackdrop={false}>
        {confirm && s && (
          <>
            <Modal.Header>
              {confirm.kind === 'end' ? tr('confirm.endTitle') : confirm.kind === 'pause' ? tr('confirm.pauseTitle') : tr('confirm.skipTitle')}
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-fg-muted">
                {confirm.kind === 'end' ? tr('confirm.endBody', { title: s.title })
                  : confirm.kind === 'pause' ? tr('confirm.pauseBody')
                    : tr('confirm.skipBody', { title: s.title, date: fmtDay(confirm.date) })}
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" fullWidth onClick={() => setConfirm(null)} disabled={busy}>{tc('cancel')}</Button>
              <Button
                variant={confirm.kind === 'pause' ? 'primary' : 'danger'}
                fullWidth
                isLoading={busy}
                onClick={() => {
                  if (confirm.kind === 'end') act(`/api/expenses/recurring/${s.id}/end`, tr('toast.ended'));
                  else if (confirm.kind === 'pause') act(`/api/expenses/recurring/${s.id}/pause`, tr('toast.paused'));
                  else act(`/api/expenses/recurring/${s.id}/occurrences/${confirm.date}/skip`, tr('toast.skipped'));
                }}
              >
                {confirm.kind === 'end' ? tr('confirm.endConfirm') : confirm.kind === 'pause' ? tr('confirm.pauseConfirm') : tr('confirm.skipConfirm')}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </>
  );
}

function Notice({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-fg-muted">
      <span>{text}</span>
      <Button size="sm" variant="ghost" onClick={onClick}>{action}</Button>
    </div>
  );
}
