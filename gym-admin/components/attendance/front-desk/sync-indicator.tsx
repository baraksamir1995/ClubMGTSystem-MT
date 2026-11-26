'use client';

import { useTranslations } from 'next-intl';
import { CloudOff, Cloud, RefreshCw, Clock, AlertTriangle, LogIn, ShieldOff, Hourglass } from 'lucide-react';
import { Badge } from '@/components/ui';
import { indicatorFor, type IndicatorKey } from '@/lib/offline/front-desk';
import type { SyncEngineState } from '@/lib/offline/types';

const VARIANT: Record<IndicatorKey, 'success' | 'warning' | 'danger' | 'neutral' | 'brand'> = {
  online: 'success',
  offline: 'neutral',
  syncing: 'brand',
  pending: 'warning',
  failed: 'danger',
  expired: 'warning',
  authRequired: 'danger',
  deviceBlocked: 'danger',
};

const ICON: Record<IndicatorKey, typeof Cloud> = {
  online: Cloud,
  offline: CloudOff,
  syncing: RefreshCw,
  pending: Clock,
  failed: AlertTriangle,
  expired: Hourglass,
  authRequired: LogIn,
  deviceBlocked: ShieldOff,
};

/** Connection / sync indicator (PHASE2-CONTRACT UI requirements). */
export function SyncIndicator({ state }: { state: SyncEngineState | null }) {
  const t = useTranslations('attendance.frontDesk.status');
  if (!state) {
    return (
      <Badge variant="neutral" role="status" aria-live="polite">
        {t('starting')}
      </Badge>
    );
  }
  const key = indicatorFor(state);
  const Icon = ICON[key];
  const label = key === 'pending' ? t('pending', { count: state.counts.pending }) : t(key);
  return (
    <Badge variant={VARIANT[key]} role="status" aria-live="polite" className="gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${key === 'syncing' ? 'animate-spin' : ''}`} aria-hidden />
      {label}
    </Badge>
  );
}
