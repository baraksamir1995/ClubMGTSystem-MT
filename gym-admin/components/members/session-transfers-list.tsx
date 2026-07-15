'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Gift, Repeat2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { dateLocale } from '@/lib/date-locale';

interface TransferRow {
  id: string;
  count: number;
  created_at: string;
  other_name: string | null;
  other_photo: string | null;
  other_gym_member_id?: string | null;
}

interface GrantRow {
  id: string;
  count: number;
  created_at: string;
  granted_by_name: string | null;
  note: string | null;
}

interface Props {
  gymMemberId: string;
}

export default function SessionTransfersList({ gymMemberId }: Props) {
  const t = useTranslations('members.sessionTransfers');
  const tc = useTranslations('common');
  const [sent, setSent] = useState<TransferRow[]>([]);
  const [received, setReceived] = useState<TransferRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [transfersRes, grantsRes] = await Promise.all([
          fetch(`/api/members/${gymMemberId}/session-transfers`),
          fetch(`/api/members/${gymMemberId}/session-grants`),
        ]);
        if (!transfersRes.ok || !grantsRes.ok) {
          if (!cancelled) setError('Failed to load history');
          return;
        }
        const [transfersJson, grantsJson] = await Promise.all([
          transfersRes.json(),
          grantsRes.json(),
        ]);
        if (cancelled) return;
        setSent(transfersJson.data?.sent ?? []);
        setReceived(transfersJson.data?.received ?? []);
        setGrants(grantsJson.data ?? []);
      } catch {
        if (!cancelled) setError('Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gymMemberId]);

  const totalCount = sent.length + received.length + grants.length;

  if (loading) {
    return (
      <div className="bg-surface-2 border border-line rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Repeat2 className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-semibold text-fg">{t('title')}</h2>
        </div>
        <p className="text-xs text-fg-faint">{tc('loading')}</p>
      </div>
    );
  }

  if (error) return null;

  return (
    <div className="bg-surface-2 border border-line rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Repeat2 className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-semibold text-fg">{t('title')}</h2>
        {totalCount > 0 && (
          <span className="ms-auto text-xs text-fg-faint">
            {t('sentReceived', { sent: sent.length, received: received.length })}
          </span>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="text-sm text-fg-faint">{t('noTransfers')}</p>
      ) : (
        <div className="space-y-2">
          {grants.map((gr) => (
            <GrantRow key={gr.id} row={gr} />
          ))}
          {sent.map((tr) => (
            <Row key={tr.id} row={tr} direction="sent" t={t} />
          ))}
          {received.map((tr) => (
            <Row key={tr.id} row={tr} direction="received" t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function GrantRow({ row }: { row: GrantRow }) {
  const locale = useLocale();
  const date = new Date(row.created_at);
  const dateStr = isNaN(date.getTime())
    ? row.created_at
    : date.toLocaleDateString(dateLocale(locale), { month: 'short', day: 'numeric', year: 'numeric' });
  const unit = row.count === 1 ? 'session' : 'sessions';

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface/40 border border-line">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand/15">
        <Gift className="w-4 h-4 text-brand" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-fg truncate">
          Added by {row.granted_by_name ?? 'Admin'}
          {row.note ? ` · ${row.note}` : ''}
        </p>
        <p className="text-xs text-fg-faint">{dateStr}</p>
      </div>
      <div className="text-sm font-semibold flex-shrink-0 text-brand">
        +{row.count} {unit}
      </div>
    </div>
  );
}

function Row({ row, direction, t }: { row: TransferRow; direction: 'sent' | 'received'; t: ReturnType<typeof useTranslations> }) {
  const locale = useLocale();
  const isSent = direction === 'sent';
  const date = new Date(row.created_at);
  const dateStr = isNaN(date.getTime())
    ? row.created_at
    : date.toLocaleDateString(dateLocale(locale), { month: 'short', day: 'numeric', year: 'numeric' });

  const sessionLabel = row.count === 1
    ? t('sessionSingle', { count: row.count })
    : t('sessionPlural', { count: row.count });

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface/40 border border-line">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isSent ? 'bg-warning-soft' : 'bg-success-soft'
        }`}
      >
        {isSent ? (
          <ArrowUpRight className="w-4 h-4 text-warning" aria-hidden />
        ) : (
          <ArrowDownLeft className="w-4 h-4 text-success" aria-hidden />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-fg truncate">
          {isSent
            ? t('sentTo', { name: row.other_name ?? '—' })
            : t('receivedFrom', { name: row.other_name ?? '—' })}
        </p>
        <p className="text-xs text-fg-faint">{dateStr}</p>
      </div>
      <div
        className={`text-sm font-semibold flex-shrink-0 ${
          isSent ? 'text-warning' : 'text-success'
        }`}
      >
        {isSent ? '−' : '+'}
        {sessionLabel}
      </div>
    </div>
  );
}
