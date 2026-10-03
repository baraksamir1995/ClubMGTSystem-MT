'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Modal } from '@/components/ui';
import { networkErrorMessage, responseErrorMessage } from '@/lib/api-error';

export interface BillingReminder {
  id: string;
  status: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
}

/**
 * Yellow "outstanding payment" banner(s) for platform SaaS invoices.
 *
 * One banner per invoice so each can be claimed or snoozed independently.
 * Never shows an amount — the API doesn't send one. "I Have Paid" only
 * asks the super-admin to confirm; the invoice stays unpaid until they do.
 * Dismiss snoozes that one reminder for 24h server-side, so it holds
 * across devices and staff sessions.
 */
export default function PaymentReminderBanner({ initial }: { initial: BillingReminder[] }) {
  const t = useTranslations('billing.reminder');
  const tErr = useTranslations('common.errors');
  const locale = useLocale();
  const [reminders, setReminders] = useState(initial);
  const [confirming, setConfirming] = useState<BillingReminder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (reminders.length === 0) return null;

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  const act = async (r: BillingReminder, action: 'settle' | 'dismiss') => {
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/billing/reminders/${r.id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        toast.error(t('failed', { error: await responseErrorMessage(res, tErr) }));
        return;
      }
      setReminders(prev => prev.filter(x => x.id !== r.id));
      toast.success(action === 'settle' ? t('sent') : t('dismissed'));
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setBusyId(null);
      setConfirming(null);
    }
  };

  return (
    <div className="space-y-3">
      {reminders.map(r => (
        <div key={r.id} role="alert"
          className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl border border-warning bg-warning-soft px-4 py-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">{t('title')}</p>
              <p className="text-sm text-fg mt-0.5">{t('message')}</p>
              {r.billing_period_start && (
                <p className="text-xs text-fg-muted mt-1">
                  {t('period', { start: fmtDate(r.billing_period_start), end: fmtDate(r.billing_period_end) })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="ghost" title={t('dismissHint')}
              disabled={busyId === r.id} onClick={() => act(r, 'dismiss')}>
              {t('dismiss')}
            </Button>
            <Button size="sm" variant="primary"
              disabled={busyId === r.id} onClick={() => setConfirming(r)}>
              {t('iHavePaid')}
            </Button>
          </div>
        </div>
      ))}

      <Modal open={confirming !== null} onClose={() => setConfirming(null)} size="sm">
        <Modal.Header>{t('confirmTitle')}</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-fg-muted">{t('confirmBody')}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setConfirming(null)}>{t('cancel')}</Button>
          <Button variant="primary" fullWidth isLoading={busyId === confirming?.id}
            onClick={() => confirming && act(confirming, 'settle')}>
            {t('confirm')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
