'use client';

import { useTranslations } from 'next-intl';
import { Cloud, CloudOff, LogIn, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui';
import { pillFor, type Connectivity } from '@/lib/offline/manual-checkin';
import type { SyncEngineState } from '@/lib/offline/types';

/** Online / Offline / Reconnecting (+ pending count) for the Attendance page (Amendments 3 + 4). */
export function AttendanceStatusPill({ connectivity, engine }: { connectivity: Connectivity; engine: SyncEngineState | null }) {
  const t = useTranslations('attendance.offline.pill');
  const { key, pending } = pillFor(connectivity, engine);
  const variant = key === 'online' ? 'success' : key === 'offline' || key === 'loginRequired' ? 'danger' : 'warning';
  const Icon = key === 'offline' ? CloudOff : key === 'loginRequired' ? LogIn : key === 'online' ? Cloud : RefreshCw;
  const label = t(key);
  return (
    <Badge variant={variant} role="status" aria-live="polite" className="gap-1.5" data-testid="attendance-status-pill">
      <Icon className={`w-3.5 h-3.5 ${key === 'reconnecting' || key === 'syncing' ? 'animate-spin' : ''}`} aria-hidden />
      {pending > 0 ? t('withPending', { label, count: pending }) : label}
    </Badge>
  );
}
