'use client';

/**
 * Full-screen rotating branch QR (PHASE3-CONTRACT §5). Shows the token valid
 * at the estimated server time (monotonic-anchored, ./server-clock), advances
 * every 60 s, keeps working offline from the stored batch, warns under 1 h,
 * refreshes automatically when online and under 6 h. Camera not used.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Maximize, Minimize, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { getKioskBatch, isIndexedDbAvailable } from '@/lib/offline/db';
import {
  downloadKioskBatch,
  kioskStatus,
  shouldAttemptRefresh,
  type BatchFetch,
  type KioskStatus,
} from '@/lib/offline/kiosk';
import { estimateServerNow } from '@/lib/offline/server-clock';
import { getOfflineSession, type OfflineSession } from '@/lib/offline/session';
import type { KioskBatch } from '@/lib/offline/types';

interface Props {
  userId: string;
  gymId: string;
  role: string;
  branchId: string;
  branchName: string;
}

type Problem = 'auth_required' | 'forbidden' | 'failed' | null;

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

export default function KioskScreen({ userId, gymId, role, branchId, branchName }: Props) {
  const t = useTranslations('attendance.kiosk');
  const format = useFormatter();
  const router = useRouter();
  const identity = useMemo(() => ({ userId, gymId, role }), [userId, gymId, role]);
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<OfflineSession | null>(null);
  const batchRef = useRef<KioskBatch | null>(null);
  const lastAttemptRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  const [status, setStatus] = useState<KioskStatus>(() => kioskStatus(null, Date.now()));
  const [batch, setBatch] = useState<KioskBatch | null>(null);
  const [online, setOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [wakeLockOk, setWakeLockOk] = useState(true);

  const refresh = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    lastAttemptRef.current = Date.now();
    try {
      const res: BatchFetch = await downloadKioskBatch(s.db, { id: branchId, name: branchName });
      if (res.ok) {
        batchRef.current = res.batch;
        setBatch(res.batch);
        setProblem(null);
      } else {
        setProblem(res.reason === 'auth_required' ? 'auth_required' : res.reason === 'forbidden' ? 'forbidden' : 'failed');
      }
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [branchId, branchName]);

  // open the user's store + load the cached batch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isIndexedDbAvailable()) return;
      try {
        const s = await getOfflineSession(identity);
        if (cancelled) return;
        sessionRef.current = s;
        const cached = (await getKioskBatch(s.db, branchId)) ?? null;
        batchRef.current = cached;
        setBatch(cached);
      } catch {
        setProblem('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identity, branchId]);

  // 1 s tick: pick the current token at the estimated server time; auto-refresh
  useEffect(() => {
    const tick = async () => {
      const s = sessionRef.current;
      const est = s ? await estimateServerNow(s.db) : { serverNowMs: null };
      const now = est.serverNowMs ?? Date.now();
      const st = kioskStatus(batchRef.current, now);
      setStatus(st);
      const isOnline = navigator.onLine;
      setOnline(isOnline);
      if (s && shouldAttemptRefresh(st, isOnline, lastAttemptRef.current, Date.now())) void refresh();
    };
    void tick();
    const timer = setInterval(() => void tick(), 1000);
    const onOnline = () => {
      lastAttemptRef.current = null; // retry straight away on reconnect
      void tick();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  }, [refresh]);

  // screen wake lock where supported (re-acquired when the tab becomes visible again)
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) {
      setWakeLockOk(false);
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen');
        if (disposed) await lock.release();
        else sentinel = lock;
        setWakeLockOk(true);
      } catch {
        setWakeLockOk(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      // not allowed (e.g. iframe) — the overlay still covers the dashboard
    }
  };

  const seconds = Math.ceil(status.msToNext / 1000);
  const time = (ms: number) => format.dateTime(new Date(ms), { timeStyle: 'short' });

  // an actionable problem wins over the "codes running low" warning
  const notice: string | null =
    problem === 'auth_required'
      ? t('authRequired')
      : problem === 'forbidden'
        ? t('forbidden')
        : status.phase === 'low'
          ? t('lowWarning')
          : null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[70] flex flex-col bg-white text-black"
      role="region"
      aria-label={t('title')}
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={() => router.push('/dashboard/attendance')}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-black/70 hover:bg-black/5"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" aria-hidden /> {t('back')}
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-black/70" role="status" aria-live="polite">
            {online ? <Wifi className="w-4 h-4" aria-hidden /> : <WifiOff className="w-4 h-4" aria-hidden />}
            {online ? t('online') : t('offline')}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!online || refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-black/70 hover:bg-black/5 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            {refreshing ? t('refreshing') : t('refresh')}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-black/70 hover:bg-black/5"
          >
            {fullscreen ? <Minimize className="w-4 h-4" aria-hidden /> : <Maximize className="w-4 h-4" aria-hidden />}
            {fullscreen ? t('exitFullscreen') : t('enterFullscreen')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center" data-kiosk-body>
        <h1 className="text-3xl sm:text-5xl font-bold">{branchName}</h1>
        {status.token ? (
          <>
            <div className="rounded-2xl bg-white p-4" style={{ width: 'min(70vh, 85vw)', height: 'min(70vh, 85vw)' }}>
              <QRCodeSVG
                value={status.token.qr}
                size={1024}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin
                style={{ width: '100%', height: '100%' }}
                aria-label={t('scanInstruction')}
              />
            </div>
            <p className="text-xl sm:text-2xl">{t('scanInstruction')}</p>
            <p className="text-lg text-black/70 tabular-nums" aria-live="off">
              {t('nextIn', { seconds })}
            </p>
          </>
        ) : (
          <p className="max-w-xl rounded-2xl border-2 border-black px-6 py-8 text-2xl font-semibold" role="alert">
            {status.phase === 'exhausted'
              ? t('exhausted')
              : status.phase === 'not_started'
                ? t('notStarted')
                : t('empty')}
          </p>
        )}
        {notice && (
          <p className="max-w-xl rounded-xl bg-black px-4 py-3 text-base font-medium text-white" role="alert">
            {notice}
          </p>
        )}
        {problem === 'failed' && !status.token && <p className="text-base text-black/70">{t('refreshFailed')}</p>}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 p-3 text-sm text-black/60">
        {status.endsAtMs != null && <span>{t('validUntil', { time: time(status.endsAtMs) })}</span>}
        {batch && <span>{t('downloaded', { time: time(batch.stored_at) })}</span>}
        {!wakeLockOk && <span>{t('wakeLockOff')}</span>}
      </footer>
    </div>
  );
}
