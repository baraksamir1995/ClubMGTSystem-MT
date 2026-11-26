'use client';

import { useCallback, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Select } from '@/components/ui';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import type { OutboxRow, ReviewEvent, ReviewEventsPage } from '@/lib/offline/types';

type ServerFilter = 'needs_review' | 'rejected';

/**
 * "Failed & flagged" inspector: rejected records on this device + the server
 * review list (whole gym) when online. Read-only — corrections go through the
 * existing attendance screens/permissions.
 */
export function FailedInspector({
  localRejected,
  memberName,
  online,
}: {
  localRejected: OutboxRow[];
  memberName: (id: string) => string | null;
  online: boolean;
}) {
  const t = useTranslations('attendance.frontDesk.inspector');
  const tErr = useTranslations('common.errors');
  const format = useFormatter();
  const [filter, setFilter] = useState<ServerFilter>('needs_review');
  const [items, setItems] = useState<ReviewEvent[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: 'short', timeStyle: 'short' }) : '—';

  const load = useCallback(
    async (more: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams(filter === 'needs_review' ? { needs_review: '1' } : { result: 'rejected' });
        if (more && cursor) qs.set('cursor', cursor);
        const res = await fetch(`/api/attendance/offline/events?${qs}`, { cache: 'no-store', redirect: 'manual' });
        const json = (await res.json().catch(() => null)) as ReviewEventsPage | null;
        if (!res.ok || !json) {
          setError(apiErrorMessage(json, res.status || 500, tErr));
          return;
        }
        setItems((prev) => (more && prev ? [...prev, ...(json.data ?? [])] : json.data ?? []));
        setCursor(json.next_cursor ?? null);
      } catch {
        setError(networkErrorMessage(tErr));
      } finally {
        setLoading(false);
      }
    },
    [cursor, filter, tErr],
  );

  return (
    <Card padding="lg" className="space-y-5">
      <h2 className="text-base font-semibold text-fg">{t('title')}</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-fg-muted">{t('local')}</h3>
        {localRejected.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('emptyLocal')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {localRejected.map((r) => (
              <li key={r.event_id} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{memberName(r.member_id) ?? r.member_id}</span>
                  {r.result_code && <Badge size="sm" variant="danger">{r.result_code}</Badge>}
                </div>
                {r.result_message && <p className="text-fg-muted">{r.result_message}</p>}
                <p className="text-xs text-fg-faint">
                  {t('recordedAt')}: {when(r.device_recorded_at)} · {t('receivedAt')}: {when(r.server_received_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-sm font-medium text-fg-muted">{t('server')}</h3>
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as ServerFilter);
                setItems(null);
                setCursor(null);
              }}
              aria-label={t('server')}
            >
              <option value="needs_review">{t('filterFlagged')}</option>
              <option value="rejected">{t('filterRejected')}</option>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => load(false)} disabled={!online || loading} isLoading={loading}>
              {loading ? t('loading') : t('load')}
            </Button>
          </div>
        </div>
        {!online && <p className="text-sm text-fg-muted">{t('offline')}</p>}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {t('loadFailed')} {error}
          </p>
        )}
        {items && items.length === 0 && <EmptyState size="sm" icon={AlertTriangle} title={t('emptyServer')} />}
        {items && items.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {items.map((e) => (
              <li key={e.event_id} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{e.member_name ?? '—'}</span>
                  <Badge size="sm" variant={e.result === 'rejected' ? 'danger' : 'warning'}>{e.result}</Badge>
                  {e.code && <Badge size="sm" variant="neutral">{e.code}</Badge>}
                  {e.flags?.map((f) => (
                    <Badge key={f} size="sm" variant="warning">{f}</Badge>
                  ))}
                </div>
                {e.message && <p className="text-fg-muted">{e.message}</p>}
                <p className="text-xs text-fg-faint">
                  {t('recordedAt')}: {when(e.device_recorded_at)} · {t('receivedAt')}: {when(e.server_received_at)}
                  {e.actor_name ? ` · ${t('by', { name: e.actor_name })}` : ''}
                  {e.device_label ? ` · ${t('device', { label: e.device_label })}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        {cursor && items && (
          <Button size="sm" variant="ghost" onClick={() => load(true)} disabled={!online || loading}>
            {t('more')}
          </Button>
        )}
      </section>
    </Card>
  );
}
