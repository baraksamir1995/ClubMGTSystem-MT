'use client';

/**
 * Wires the Phase 1 offline lib into the front-desk screen:
 * open the per-user session on mount, store the server-checked permission
 * snapshot, fetch status (policy + clock), bootstrap when the cache is stale,
 * start the sync lifecycle, and expose state for rendering.
 *
 * Everything after the first load runs client-side against IndexedDB + the
 * same-origin proxies, so the page keeps working when the connection drops.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  countCachedMembers,
  getMeta,
  isIndexedDbAvailable,
  listBranches,
  listClassSessions,
  listOutbox,
  listOutboxByStatus,
  setMeta,
} from '@/lib/offline/db';
import { fetchOfflineStatus, getStaleness, type BootstrapResult } from '@/lib/offline/bootstrap';
import {
  permissionGate,
  revalidateAttendancePermission,
  type PermissionGate,
} from '@/lib/offline/front-desk';
import { getOfflineSession, type OfflineIdentity, type OfflineSession } from '@/lib/offline/session';
import {
  DEFAULT_POLICY,
  type CachedBranch,
  type CachedClassSession,
  type OfflinePolicy,
  type OutboxRow,
  type SyncEngineState,
} from '@/lib/offline/types';

export interface FrontDeskData {
  policy: OfflinePolicy;
  memberCount: number;
  sessions: CachedClassSession[];
  branches: CachedBranch[];
  records: OutboxRow[];
  /** every locally rejected record (for the inspector) */
  rejected: OutboxRow[];
  gate: PermissionGate;
  /** snapshot time for "as of" labels */
  asOf: string | null;
}

const EMPTY: FrontDeskData = {
  policy: DEFAULT_POLICY,
  memberCount: 0,
  sessions: [],
  branches: [],
  records: [],
  rejected: [],
  gate: 'unknown',
  asOf: null,
};

const PERMISSION_RECHECK_MS = 5 * 60_000;

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useFrontDesk(identity: OfflineIdentity, canRecord: boolean) {
  const [session, setSession] = useState<OfflineSession | null>(null);
  const [state, setState] = useState<SyncEngineState | null>(null);
  const [data, setData] = useState<FrontDeskData>(EMPTY);
  const [fatal, setFatal] = useState<'no_storage' | 'open_failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const sessionRef = useRef<OfflineSession | null>(null);

  const reload = useCallback(async (s: OfflineSession) => {
    const [policy, memberCount, sessions, branches, records, snapshot, asOf, rejected] = await Promise.all([
      getMeta(s.db, 'policy'),
      countCachedMembers(s.db),
      listClassSessions(s.db),
      listBranches(s.db),
      listOutbox(s.db),
      getMeta(s.db, 'permissions_snapshot'),
      getMeta(s.db, 'as_of'),
      listOutboxByStatus(s.db, 'rejected'),
    ]);
    const p = policy ?? DEFAULT_POLICY;
    setData({
      policy: p,
      memberCount,
      sessions,
      branches,
      records: records.slice(0, 30),
      rejected: rejected.reverse(),
      gate: permissionGate(snapshot, Date.now(), p.max_data_age_hours * 3_600_000),
      asOf: asOf ?? null,
    });
  }, []);

  const refreshData = useCallback(async (): Promise<BootstrapResult | null> => {
    const s = sessionRef.current;
    if (!s) return null;
    setRefreshing(true);
    try {
      await fetchOfflineStatus(s.db, s.deviceId).catch(() => null);
      const res = await s.bootstrap();
      await reload(s);
      await s.engine.refresh();
      return res;
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  // open session + lifecycle
  useEffect(() => {
    let cancelled = false;
    let stopLifecycle: (() => void) | null = null;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      if (!isIndexedDbAvailable()) {
        setFatal('no_storage');
        return;
      }
      let s: OfflineSession;
      try {
        s = await getOfflineSession(identity);
      } catch {
        if (!cancelled) setFatal('open_failed');
        return;
      }
      if (cancelled) return;
      sessionRef.current = s;
      // The server guard just ran for this page load: cache its verdict.
      await setMeta(s.db, 'permissions_snapshot', { attendance: canRecord, checked_at: Date.now() });
      setSession(s);
      unsubscribe = s.engine.subscribe((st) => {
        setState(st);
        void reload(s);
      });
      if (isOnline()) {
        await fetchOfflineStatus(s.db, s.deviceId).catch(() => null);
        const staleness = await getStaleness(s.db);
        if (staleness.stale && !cancelled) {
          setRefreshing(true);
          await s.bootstrap().catch(() => null);
          if (!cancelled) setRefreshing(false);
        }
      }
      if (cancelled) return;
      await reload(s);
      stopLifecycle = s.engine.startSyncLifecycle({ intervalMs: 30_000 });
    })();

    return () => {
      cancelled = true;
      stopLifecycle?.();
      unsubscribe?.();
      // The session itself stays open (module singleton) for sign-out cleanup.
    };
  }, [identity, canRecord, reload]);

  // Re-validate the permission snapshot online once it gets old.
  useEffect(() => {
    const tick = async () => {
      const s = sessionRef.current;
      if (!s) return;
      const snapshot = await getMeta(s.db, 'permissions_snapshot');
      const policy = (await getMeta(s.db, 'policy')) ?? DEFAULT_POLICY;
      const gate = permissionGate(snapshot, Date.now(), policy.max_data_age_hours * 3_600_000);
      if (gate === 'stale' && isOnline()) {
        const ok = await revalidateAttendancePermission();
        if (ok !== null) await setMeta(s.db, 'permissions_snapshot', { attendance: ok, checked_at: Date.now() });
      }
      await reload(s);
    };
    const timer = setInterval(() => void tick(), PERMISSION_RECHECK_MS);
    const onOnline = () => void tick();
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [reload]);

  const syncNow = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    if (s.engine.getState().paused) await s.engine.resume();
    else await s.engine.syncNow({ force: true });
  }, []);

  const reloadNow = useCallback(async () => {
    if (sessionRef.current) await reload(sessionRef.current);
  }, [reload]);

  return { session, state, data, fatal, refreshing, refreshData, syncNow, reload: reloadNow };
}
