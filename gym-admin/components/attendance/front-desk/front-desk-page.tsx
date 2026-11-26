'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { ArrowLeft, DownloadCloud } from 'lucide-react';
import { Button } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api-error';
import { getCachedMember } from '@/lib/offline/db';
import {
  confirmScan,
  indicatorFor,
  recordingPath,
  scanMemberPass,
  submitAttendance,
  type ScanCandidate,
  type SubmitDeps,
  type SubmitInput,
  type SubmitOutcome,
} from '@/lib/offline/front-desk';
import { looksLikeMemberPass } from '@/lib/offline/member-pass';
import type { OfflineIdentity } from '@/lib/offline/session';
import { DeviceRecords } from './device-records';
import { FailedInspector } from './failed-inspector';
import { ManualCheckin } from './manual-checkin';
import { PassScanner } from './pass-scanner';
import { ReadinessPanel } from './readiness-panel';
import { ScanConfirmModal } from './scan-confirm-modal';
import { SyncIndicator } from './sync-indicator';
import { useFrontDesk } from './use-front-desk';

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export default function FrontDeskPage({
  userId,
  gymId,
  role,
  canRecord,
}: {
  userId: string;
  gymId: string;
  role: string;
  canRecord: boolean;
}) {
  const t = useTranslations('attendance.frontDesk');
  const tErr = useTranslations('common.errors');
  const router = useRouter();
  const identity = useMemo<OfflineIdentity>(() => ({ userId, gymId, role }), [userId, gymId, role]);
  const { session, state, data, fatal, refreshing, refreshData, syncNow, reload } = useFrontDesk(identity, canRecord);
  const online = useOnline();
  const [candidate, setCandidate] = useState<ScanCandidate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [scanMessage, setScanMessage] = useState<React.ReactNode>(null);
  const [names, setNames] = useState<Record<string, string | null>>({});

  const path = recordingPath(data.policy);
  const hours = data.policy.max_data_age_hours;

  // Why recording is blocked right now (null = allowed).
  const blockedReason = useMemo(() => {
    if (data.gate === 'denied') return t('notes.permDenied');
    if (data.gate === 'stale' && !online) return t('notes.permStale', { hours });
    if (path === 'online' && !online) return t('notes.offModeOffOffline');
    return null;
  }, [data.gate, online, path, hours, t]);

  // Member names for the records list (from the cache).
  useEffect(() => {
    if (!session) return;
    const missing = [...new Set([...data.records, ...data.rejected].map((r) => r.member_id))].filter((id) => !(id in names));
    if (missing.length === 0) return;
    Promise.all(missing.map(async (id) => [id, (await getCachedMember(session.db, id))?.full_name ?? null] as const)).then(
      (pairs) => setNames((prev) => ({ ...prev, ...Object.fromEntries(pairs) })),
    );
  }, [data.records, data.rejected, names, session]);
  const memberName = useCallback((id: string) => names[id] ?? null, [names]);

  const deps = useMemo<SubmitDeps | null>(
    () =>
      session
        ? { policy: data.policy, record: session.record, syncNow: () => session.engine.syncNow() }
        : null,
    [session, data.policy],
  );

  const report = useCallback(
    async (outcome: SubmitOutcome): Promise<boolean> => {
      if (outcome.path === 'outbox') {
        if (outcome.result.ok) {
          toast.success(t('results.savedLocal'));
          await reload();
          return true;
        }
        toast.error(t(`results.${outcome.result.reason}`));
        return false;
      }
      if (outcome.ok) {
        toast.success(t('results.savedOnline'));
        return true;
      }
      toast.error(apiErrorMessage(outcome.body, outcome.status || 503, tErr));
      return false;
    },
    [reload, t, tErr],
  );

  const submit = useCallback(
    async (input: SubmitInput) => {
      if (!deps) return false;
      return report(await submitAttendance(deps, input));
    },
    [deps, report],
  );

  const onDecoded = useCallback(
    async (raw: string) => {
      setScanMessage(null);
      if (!session) return;
      if (!looksLikeMemberPass(raw)) {
        setScanMessage(<p className="text-sm text-danger" role="alert">{t('scan.notPass')}</p>);
        return;
      }
      const res = await scanMemberPass(session.db, gymId, raw);
      if (res.ok) {
        setCandidate(res.candidate);
        return;
      }
      setScanMessage(
        <div className="space-y-2" role="alert">
          <p className="text-sm text-danger">{t(`scan.${res.code}`)}</p>
          {(res.code === 'qr_unknown_key' || res.code === 'member_not_found') && online && (
            <Button size="sm" variant="secondary" onClick={() => void refreshData()} leftIcon={<DownloadCloud className="w-4 h-4" />}>
              {t('readiness.refresh')}
            </Button>
          )}
        </div>,
      );
    },
    [gymId, online, refreshData, session, t],
  );

  const onConfirm = async () => {
    if (!deps || !candidate) return;
    setConfirming(true);
    try {
      const ok = await report(await confirmScan(deps, candidate));
      if (ok) setCandidate(null);
    } finally {
      setConfirming(false);
    }
  };

  const onRefresh = async () => {
    const res = await refreshData();
    if (res?.ok) toast.success(t('readiness.refreshed'));
    else toast.error(t('readiness.refreshFailed'));
  };

  const indicator = state ? indicatorFor(state) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/attendance')}
            leftIcon={<ArrowLeft className="w-4 h-4 rtl:rotate-180" />}
          >
            {t('back')}
          </Button>
          <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
          <p className="text-sm text-fg-muted max-w-2xl">{t('subtitle')}</p>
        </div>
        <SyncIndicator state={state} />
      </div>

      {fatal && <Banner tone="danger">{tErr('unknown')}</Banner>}
      {path === 'online' && <Banner tone="warning">{t('notes.offModeOff')}</Banner>}
      {indicator === 'authRequired' && <Banner tone="danger">{t('notes.authRequired')}</Banner>}
      {indicator === 'deviceBlocked' && <Banner tone="danger">{t('notes.deviceBlocked')}</Banner>}
      {state?.data_as_of && state.data_expired && <Banner tone="warning">{t('notes.expired', { hours })}</Banner>}
      {session && !state?.data_as_of && !refreshing && <Banner tone="warning">{t('notes.noData')}</Banner>}
      {blockedReason && <Banner tone="warning">{blockedReason}</Banner>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <PassScanner onDecoded={onDecoded} disabled={!session || !!blockedReason} message={scanMessage} />
          <ManualCheckin
            db={session?.db ?? null}
            sessions={data.sessions}
            branches={data.branches}
            asOf={data.asOf}
            blockedReason={blockedReason}
            submit={submit}
          />
          <DeviceRecords rows={data.records} memberName={memberName} />
        </div>
        <div className="space-y-5">
          <ReadinessPanel
            state={state}
            policy={data.policy}
            memberCount={data.memberCount}
            sessionCount={data.sessions.length}
            refreshing={refreshing}
            online={online}
            onRefresh={onRefresh}
            onSyncNow={() => void syncNow()}
          />
          <FailedInspector localRejected={data.rejected} memberName={memberName} online={online} />
        </div>
      </div>

      <ScanConfirmModal
        candidate={candidate}
        busy={confirming}
        blockedReason={blockedReason}
        onConfirm={onConfirm}
        onCancel={() => setCandidate(null)}
      />
    </div>
  );
}

function Banner({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  const cls = tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning';
  return (
    <div className={`rounded-lg px-4 py-3 text-sm ${cls}`} role="status">
      {children}
    </div>
  );
}
