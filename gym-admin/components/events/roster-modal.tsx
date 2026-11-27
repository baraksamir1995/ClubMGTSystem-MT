'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Avatar, Badge, Button, EmptyState, Modal, Select, type BadgeProps } from '@/components/ui';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import { fmtDateTimeGym } from '@/lib/time';
import {
  DESK_PAYMENT_METHODS, METHOD_LABEL_KEY, fmtEventPrice,
  type BranchOption, type DeskPaymentMethod, type EventRegistration, type GymEvent,
} from '@/lib/types/store-events';

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  confirmed: 'success',
  pending_payment: 'warning',
  cancelled: 'danger',
};
const PAYMENT_VARIANT: Record<string, BadgeProps['variant']> = {
  paid: 'success',
  unpaid: 'warning',
  refunded: 'neutral',
  na: 'neutral',
};

export default function RosterModal({ event, branches, canEdit, canMarkPaid, onClose }: {
  event: GymEvent;
  branches: BranchOption[];
  canEdit: boolean;
  canMarkPaid: boolean;
  /** `changed` = something was mutated, so the caller should refresh counts. */
  onClose: (changed: boolean) => void;
}) {
  const t    = useTranslations('events.roster');
  const te   = useTranslations('events');
  const tc   = useTranslations('common');
  const tp   = useTranslations('payments');
  const tErr = useTranslations('common.errors');

  const [regs, setRegs]               = useState<EventRegistration[] | null>(null);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [busyId, setBusyId]           = useState<string | null>(null);
  const [payingId, setPayingId]       = useState<string | null>(null);
  const [method, setMethod]           = useState<DeskPaymentMethod>('cash');
  const [branchId, setBranchId]       = useState(branches.length === 1 ? branches[0].id : '');
  const changed = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/registrations`);
      const json = await res.json().catch(() => null);
      if (!res.ok) { setLoadError(apiErrorMessage(json, res.status, tErr)); setRegs([]); return; }
      setRegs((json?.data ?? json ?? []) as EventRegistration[]);
    } catch {
      setLoadError(networkErrorMessage(tErr));
      setRegs([]);
    }
  }, [event.id, tErr]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const list = regs ?? [];
    return {
      active:    list.filter(r => r.status !== 'cancelled').length,
      confirmed: list.filter(r => r.status === 'confirmed').length,
      pending:   list.filter(r => r.status === 'pending_payment').length,
      attended:  list.filter(r => r.attended && r.status !== 'cancelled').length,
      cancelled: list.filter(r => r.status === 'cancelled').length,
    };
  }, [regs]);

  const visible = (regs ?? []).filter(r => showCancelled || r.status !== 'cancelled');

  const setAttended = async (r: EventRegistration, attended: boolean) => {
    setBusyId(r.id);
    // Optimistic: flip locally, roll back on failure.
    setRegs(prev => prev?.map(x => (x.id === r.id ? { ...x, attended } : x)) ?? prev);
    try {
      const res = await fetch(`/api/event-registrations/${r.id}/attended`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attended }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setRegs(prev => prev?.map(x => (x.id === r.id ? { ...x, attended: !attended } : x)) ?? prev);
        toast.error(apiErrorMessage(json, res.status, tErr));
        return;
      }
      changed.current = true;
    } catch {
      setRegs(prev => prev?.map(x => (x.id === r.id ? { ...x, attended: !attended } : x)) ?? prev);
      toast.error(networkErrorMessage(tErr));
    } finally {
      setBusyId(null);
    }
  };

  const markPaid = async (r: EventRegistration) => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/event-registrations/${r.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: method, branch_id: branchId || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      toast.success(t('markedPaid'));
      changed.current = true;
      setPayingId(null);
      await load();
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open onClose={() => onClose(changed.current)} size="xl">
      <Modal.Header>{t('title', { title: event.title })}</Modal.Header>
      <Modal.Body>
        <p className="text-sm text-fg-muted">
          {fmtDateTimeGym(event.starts_at)}
          {' · '}
          {event.is_paid ? fmtEventPrice(event) : te('free')}
          {event.capacity ? ` · ${t('capacity', { count: event.capacity })}` : ''}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Count label={t('counts.registered')} value={event.capacity ? `${counts.active}/${event.capacity}` : counts.active} />
          <Count label={t('counts.confirmed')} value={counts.confirmed} />
          <Count label={t('counts.pending')} value={counts.pending} tone={counts.pending > 0 ? 'warning' : undefined} />
          <Count label={t('counts.attended')} value={counts.attended} />
        </div>

        {counts.cancelled > 0 && (
          <label className="flex items-center gap-2 text-sm text-fg-muted cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-brand" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
            {t('showCancelled', { count: counts.cancelled })}
          </label>
        )}

        {loadError && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">{loadError}</p>
        )}

        {regs === null ? (
          <p className="py-8 text-center text-sm text-fg-muted">{tc('loading')}</p>
        ) : visible.length === 0 ? (
          <EmptyState icon={Users} size="sm" title={t('empty')} description={t('emptyHint')} />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {visible.map(r => {
              const cancelled = r.status === 'cancelled';
              return (
                <li key={r.id} className={`px-4 py-3 ${cancelled ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={r.member_name ?? '?'} src={r.member_photo_url ?? undefined} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg truncate">{r.member_name ?? '—'}</p>
                      <p className="text-xs text-fg-faint truncate">
                        {r.member_number != null ? `#${r.member_number}` : ''}
                        {r.member_phone ? ` · ${r.member_phone}` : ''}
                        {` · ${fmtDateTimeGym(r.created_at)}`}
                      </p>
                      {r.configuration_name && (
                        <p className="text-xs text-fg-muted truncate">
                          {event.configuration_label || te('optionFallback')}: <span className="text-fg">{r.configuration_name}</span>
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge size="sm" variant={STATUS_VARIANT[r.status] ?? 'neutral'}>{t(`status.${r.status}`)}</Badge>
                        <Badge size="sm" variant={PAYMENT_VARIANT[r.payment_status] ?? 'neutral'}>{t(`payment.${r.payment_status}`)}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === 'pending_payment' && canMarkPaid && payingId !== r.id && (
                        <Button size="sm" variant="secondary" onClick={() => setPayingId(r.id)}>{t('markPaid')}</Button>
                      )}
                      {!cancelled && (
                        <label className={`flex items-center gap-2 rounded-lg border border-line px-2.5 min-h-9 text-sm ${canEdit ? 'cursor-pointer hover:bg-surface-3' : 'opacity-60'}`}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-brand"
                            checked={r.attended}
                            disabled={!canEdit || busyId === r.id}
                            onChange={e => setAttended(r, e.target.checked)}
                          />
                          <span className="text-fg">{t('attended')}</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {payingId === r.id && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface-2 p-3">
                      <div className="min-w-[160px] flex-1">
                        <p className="text-xs font-medium text-fg-muted mb-1">{tp('table.method')}</p>
                        <Select value={method} onChange={e => setMethod(e.target.value as DeskPaymentMethod)} aria-label={tp('table.method')}>
                          {DESK_PAYMENT_METHODS.map(m => (
                            <option key={m} value={m}>{tp(`method.${METHOD_LABEL_KEY[m]}`)}</option>
                          ))}
                        </Select>
                      </div>
                      {branches.length > 0 && (
                        <div className="min-w-[160px] flex-1">
                          <p className="text-xs font-medium text-fg-muted mb-1">{tc('branch')}</p>
                          <Select value={branchId} onChange={e => setBranchId(e.target.value)} aria-label={tc('branch')}>
                            <option value="">—</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </Select>
                        </div>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setPayingId(null)}>{tc('cancel')}</Button>
                      <Button size="sm" isLoading={busyId === r.id} leftIcon={<Check className="w-4 h-4" />} onClick={() => markPaid(r)}>
                        {t('confirmPaid', { amount: fmtEventPrice(event) })}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onClose(changed.current)}>{tc('close')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

function Count({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warning' }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[11px] text-fg-faint">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone === 'warning' ? 'text-warning' : 'text-fg'}`}>{value}</p>
    </div>
  );
}
