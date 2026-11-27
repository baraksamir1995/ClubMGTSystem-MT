'use client';

/**
 * Offline support for the Attendance & Access page (PHASE3-CONTRACT
 * Amendments 3 + 4): connectivity (Online / Offline / Reconnecting), the
 * user's offline session (member cache, outbox, sync engine, server clock),
 * the pending count for the status pill, rejection notices, and the branch
 * list for the Gym QR modal cache. No separate offline page.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createConnectivity, type ConnectivityState } from '@/lib/offline/connectivity';
import { saveQrBranches } from '@/lib/offline/branch-qr-cache';
import { fetchOfflineStatus, getStaleness } from '@/lib/offline/bootstrap';
import { getMeta, isIndexedDbAvailable, listOutboxByStatus, setMeta } from '@/lib/offline/db';
import { unacknowledgedRejections } from '@/lib/offline/manual-checkin';
import { getOfflineSession, type OfflineSession } from '@/lib/offline/session';
import { DEFAULT_POLICY, type OfflinePolicy, type OutboxRow, type SyncEngineState } from '@/lib/offline/types';

interface Options {
  user: { id: string; role: string } | null;
  gymId: string;
  canRecord: boolean;
  branches: { id: string; name: string }[];
  /** called after reconnecting and after offline check-ins synced */
  onBackOnline: () => void;
}

const RECORDING_ROLES = new Set(['gym_admin', 'staff', 'trainer']);

export function useAttendanceOffline({ user, gymId, canRecord, branches, onBackOnline }: Options) {
  const connectivity = useMemo(() => createConnectivity(), []);
  const [conn, setConn] = useState<ConnectivityState>('online');
  const [session, setSession] = useState<OfflineSession | null>(null);
  const [engine, setEngine] = useState<SyncEngineState | null>(null);
  const [policy, setPolicy] = useState<OfflinePolicy>(DEFAULT_POLICY);
  const [rejected, setRejected] = useState<OutboxRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const backOnline = useRef(onBackOnline);
  backOnline.current = onBackOnline;
  const lastSynced = useRef<number | null>(null);

  // connectivity
  useEffect(() => {
    const unsub = connectivity.subscribe(setConn);
    const stop = connectivity.start();
    const offReconnect = connectivity.onReconnect(() => backOnline.current());
    return () => {
      unsub();
      stop();
      offReconnect();
    };
  }, [connectivity]);

  const reloadLocal = useCallback(async (s: OfflineSession) => {
    const [p, rows, dismissed, a] = await Promise.all([
      getMeta(s.db, 'policy'),
      listOutboxByStatus(s.db, 'rejected'),
      getMeta(s.db, 'dismissed_rejections'),
      getMeta(s.db, 'as_of'),
    ]);
    setPolicy(p ?? DEFAULT_POLICY);
    setRejected(unacknowledgedRejections(rows, dismissed ?? []).reverse());
    setAsOf(a ?? null);
  }, []);

  // offline session: cache, outbox, sync
  useEffect(() => {
    if (!user || !gymId || !RECORDING_ROLES.has(user.role) || !isIndexedDbAvailable()) return;
    let cancelled = false;
    let stopLifecycle: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      let s: OfflineSession;
      try {
        s = await getOfflineSession({ userId: user.id, gymId, role: user.role });
      } catch {
        return;
      }
      if (cancelled) return;
      await setMeta(s.db, 'permissions_snapshot', { attendance: canRecord, checked_at: Date.now() }).catch(() => undefined);
      setSession(s);
      unsubscribe = s.engine.subscribe((st) => {
        setEngine(st);
        void reloadLocal(s);
        // offline check-ins were confirmed: let the page refresh its lists
        if (lastSynced.current != null && st.counts.synced > lastSynced.current && !st.running) backOnline.current();
        lastSynced.current = st.counts.synced;
      });
      if (navigator.onLine) {
        await fetchOfflineStatus(s.db, s.deviceId).catch(() => null);
        const st = await getStaleness(s.db).catch(() => null);
        if (st?.stale && !cancelled) await s.bootstrap().catch(() => null);
      }
      if (cancelled) return;
      await reloadLocal(s);
      stopLifecycle = s.engine.startSyncLifecycle({ intervalMs: 30_000 });
    })();
    return () => {
      cancelled = true;
      stopLifecycle?.();
      unsubscribe?.();
    };
  }, [user, gymId, canRecord, reloadLocal]);

  // branch list for the Gym QR modal, kept for offline use
  useEffect(() => {
    if (session && branches.length > 0) void saveQrBranches(session.db, branches).catch(() => undefined);
  }, [session, branches]);

  const dismissRejection = useCallback(
    async (eventId: string) => {
      if (!session) return;
      const dismissed = (await getMeta(session.db, 'dismissed_rejections')) ?? [];
      await setMeta(session.db, 'dismissed_rejections', [...new Set([...dismissed, eventId])]);
      await reloadLocal(session);
    },
    [session, reloadLocal],
  );

  return {
    connectivity: conn,
    reportFailure: connectivity.reportFailure,
    session,
    engine,
    policy,
    rejected,
    asOf,
    dismissRejection,
    reload: () => (session ? reloadLocal(session) : Promise.resolve()),
  };
}
