'use client';

import { useFormatter, useNow, useTranslations } from 'next-intl';
import { DownloadCloud, RefreshCw } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import type { OfflinePolicy, SyncEngineState } from '@/lib/offline/types';

interface Props {
  state: SyncEngineState | null;
  policy: OfflinePolicy;
  memberCount: number;
  sessionCount: number;
  refreshing: boolean;
  online: boolean;
  onRefresh: () => void;
  onSyncNow: () => void;
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warning' | 'danger' | 'success' }) {
  const toneClass = tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-fg';
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className={`text-sm font-medium text-end ${toneClass}`}>{value}</dd>
    </div>
  );
}

/** Readiness panel + sync summary (PHASE2-CONTRACT UI requirements). */
export function ReadinessPanel({ state, policy, memberCount, sessionCount, refreshing, online, onRefresh, onSyncNow }: Props) {
  const t = useTranslations('attendance.frontDesk.readiness');
  const format = useFormatter();
  const now = useNow({ updateInterval: 30_000 });

  const dateTime = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const counts = state?.counts ?? { pending: 0, syncing: 0, synced: 0, rejected: 0 };
  const offsetMin = state?.clock_offset_ms == null ? null : Math.round(state.clock_offset_ms / 60_000);

  return (
    <Card padding="lg" className="space-y-4">
      <h2 className="text-base font-semibold text-fg">{t('title')}</h2>
      <dl className="divide-y divide-line">
        <Row
          label={t('lastSync')}
          value={state?.last_successful_sync_at ? format.relativeTime(new Date(state.last_successful_sync_at), now) : t('never')}
        />
        <Row
          label={t('dataAsOf')}
          tone={state?.data_expired ? 'warning' : undefined}
          value={
            state?.data_as_of ? (
              <span>
                {dateTime(state.data_as_of)}
                <span className="block text-xs text-fg-muted">{format.relativeTime(new Date(state.data_as_of), now)}</span>
              </span>
            ) : (
              t('noData')
            )
          }
        />
        <Row label={t('members')} value={format.number(memberCount)} />
        <Row label={t('classes')} value={format.number(sessionCount)} />
        <Row label={t('policy')} value={policy.enabled ? t('policyOn') : t('policyOff')} tone={policy.enabled ? 'success' : 'warning'} />
        <Row label={t('pending')} value={format.number(counts.pending + counts.syncing)} tone={counts.pending ? 'warning' : undefined} />
        <Row label={t('synced')} value={format.number(counts.synced)} />
        <Row label={t('rejected')} value={format.number(counts.rejected)} tone={counts.rejected ? 'danger' : undefined} />
        {state && state.held > 0 && <Row label={t('held')} value={format.number(state.held)} tone="danger" />}
        <Row
          label={t('clockOffset')}
          value={offsetMin == null ? t('clockUnknown') : format.number(offsetMin, { style: 'unit', unit: 'minute', signDisplay: 'exceptZero' })}
        />
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={!online || refreshing}
          isLoading={refreshing}
          leftIcon={<DownloadCloud className="w-4 h-4" />}
        >
          {refreshing ? t('refreshing') : t('refresh')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSyncNow}
          disabled={!online || !!state?.running}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {t('syncNow')}
        </Button>
      </div>
    </Card>
  );
}
