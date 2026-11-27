'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge, Card, EmptyState } from '@/components/ui';
import { itemState } from '@/lib/offline/front-desk';
import type { OutboxRow } from '@/lib/offline/types';
import { useReasonText } from './use-reason-text';

/**
 * Latest records on this device with their sync state. Read-only by design:
 * pending/rejected items can't be edited or deleted (audit trail).
 */
export function DeviceRecords({ rows, memberName }: { rows: OutboxRow[]; memberName: (id: string) => string | null }) {
  const t = useTranslations('attendance.frontDesk.items');
  const reason = useReasonText();
  const format = useFormatter();

  return (
    <Card padding="none">
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-base font-semibold text-fg">{t('title')}</h2>
        <p className="text-xs text-fg-muted">{t('readOnly')}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState size="sm" icon={Clock} title={t('empty')} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const s = itemState(r);
            return (
              <li key={r.event_id} className="flex items-start gap-3 px-5 py-3">
                {s === 'synced' ? (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" aria-hidden />
                ) : s === 'rejected' ? (
                  <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" aria-hidden />
                ) : (
                  <Clock className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-fg truncate">{memberName(r.member_id) ?? r.member_id}</span>
                    <Badge size="sm" variant="neutral">{r.attendance_method === 'staff_qr' ? t('methodQr') : t('methodManual')}</Badge>
                    <span className="text-xs text-fg-muted">
                      {format.dateTime(new Date(r.recorded_at_ms), { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${s === 'synced' ? 'text-success' : s === 'rejected' ? 'text-danger' : 'text-warning'}`}>
                    {s === 'synced' ? t('synced') : s === 'rejected' ? t('rejected', { reason: reason(r.result_code, r.result_message) }) : t('waiting')}
                  </p>
                  {r.flags.length > 0 && <p className="text-xs text-warning">{t('flagged', { flags: r.flags.join(', ') })}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
