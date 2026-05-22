'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Radio, ClipboardList, Plus, RefreshCw, Search, X, Filter, QrCode, ChevronLeft, ChevronRight, MapPin, User as UserIcon, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRefresh } from '@/lib/use-refresh';
import ManualLogModal from './manual-log-modal';
import GymQRModal from './gym-qr-modal';
import type { AttendanceLog, MemberOption, SessionOption } from '@/app/dashboard/attendance/page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { can, type Permission } from '@/lib/get-permissions';
import { Button, Input, Select, Tabs } from '@/components/ui';

interface Props {
  initialLogs: AttendanceLog[];
  members: MemberOption[];
  accessPoints: string[];
  sessionEntryPoints: string[];
  sessionOptions: SessionOption[];
  gymId: string;
  branches: GymBranch[];
  permissions: Permission[] | null;
}

const METHODS: Record<string, string> = {
  manual: 'Manual', qr: 'QR Code', app: 'App', card: 'Card', pin: 'PIN',
};

import { fmtTime12 as fmtTime, fmtDateGym as fmtDate, fmtDateTimeGym as fmtDateTime } from '@/lib/time';

export default function AttendancePage({ initialLogs, members, accessPoints: initialAccessPoints, sessionEntryPoints, sessionOptions, gymId, branches, permissions }: Props) {
  const refresh = useRefresh();
  const [activeTab,     setActiveTab]     = useState<'live' | 'logs'>('live');
  const [logs,          setLogs]          = useState<AttendanceLog[]>(initialLogs);
  const [showManual,    setShowManual]    = useState(false);
  const [showQR,        setShowQR]        = useState(false);
  const [liveLoading,   setLiveLoading]   = useState(false);
  const [lastRefresh,   setLastRefresh]   = useState(new Date());
  const [livePage,      setLivePage]      = useState(1);
  const [liveTotalPages, setLiveTotalPages] = useState(1);
  const [liveTotal,     setLiveTotal]     = useState(0);
  // 1 row goes in the hero card, the next 5 fill the compact list below.
  const LIVE_PAGE_SIZE = 6;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Logs tab filters
  const [search,        setSearch]        = useState('');
  const [fromDate,      setFromDate]      = useState('');
  const [toDate,        setToDate]        = useState('');
  const [filterMember,  setFilterMember]  = useState('');
  const [filterPoint,   setFilterPoint]   = useState('');
  const [logsData,      setLogsData]      = useState<AttendanceLog[]>(initialLogs);
  const [logsLoading,   setLogsLoading]   = useState(false);
  const [logsPage,      setLogsPage]      = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotal,     setLogsTotal]     = useState(0);
  const LOGS_PAGE_SIZE = 25;


  const allAccessPoints = useMemo(() => {
    const pts = [...initialAccessPoints];
    [...logs, ...logsData].forEach(l => { if (l.access_point && !pts.includes(l.access_point)) pts.push(l.access_point); });
    return [...new Set(pts)];
  }, [logs, logsData, initialAccessPoints]);

  // ── Live Feed ──
  const fetchLive = useCallback(async (page = 1, silent = false) => {
    if (!silent) setLiveLoading(true);
    try {
      const res = await fetch(`/api/attendance?limit=${LIVE_PAGE_SIZE}&page=${page}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs ?? []);
        setLastRefresh(new Date());
        if (data.pagination) {
          setLivePage(data.pagination.page);
          setLiveTotalPages(data.pagination.pages);
          setLiveTotal(data.pagination.total);
        }
      }
    } catch {}
    finally { if (!silent) setLiveLoading(false); }
  }, []);

  // Fetch live data on mount to get pagination metadata
  useEffect(() => {
    fetchLive(1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Background poll every 60s for cross-device check-ins (QR scans, mobile app).
  // Only polls when tab is visible. Same-device check-ins update instantly via onSaved.
  useEffect(() => {
    if (activeTab !== 'live') return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (!interval) interval = setInterval(() => fetchLive(livePage, true), 60_000);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const onVisibility = () => document.hidden ? stop() : start();

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeTab, fetchLive, livePage]);

  // ── Logs tab fetch (server-side pagination) ──
  const fetchLogs = useCallback(async (page = 1) => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LOGS_PAGE_SIZE), page: String(page) });
      if (fromDate)      params.set('from', fromDate);
      if (toDate)        params.set('to', toDate);
      if (filterMember)  params.set('member_id', filterMember);
      if (filterPoint)   params.set('access_point', filterPoint);
      const res = await fetch(`/api/attendance?${params}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to load logs'); return; }
      setLogsData(data.logs ?? []);
      if (data.pagination) {
        setLogsPage(data.pagination.page);
        setLogsTotalPages(data.pagination.pages);
        setLogsTotal(data.pagination.total);
      }
    } catch { toast.error('Failed to load logs'); }
    finally { setLogsLoading(false); }
  }, [fromDate, toDate, filterMember, filterPoint]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs(1);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side search within current page
  const displayedLogs = useMemo(() => {
    if (!search.trim()) return logsData;
    const q = search.toLowerCase();
    return logsData.filter(l =>
      String(l.member_number ?? '').toLowerCase().includes(q) ||
      l.full_name?.toLowerCase().includes(q) ||
      l.access_point?.toLowerCase().includes(q)
    );
  }, [logsData, search]);

  const paginatedLogs = displayedLogs;

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">Attendance & Access</h1>
            <p className="text-sm text-fg-muted mt-0.5">Live check-ins and logs</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowQR(true)} leftIcon={<QrCode className="w-4 h-4" />}>
              Gym QR Code
            </Button>
            {can(permissions, 'attendance', 'create') && (
              <Button variant="primary" onClick={() => setShowManual(true)} leftIcon={<Plus className="w-4 h-4" />}>
                Manual Check-in
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'live' | 'logs')}>
          <Tabs.List>
            <Tabs.Trigger value="live" icon={Radio}>
              Live Feed
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            </Tabs.Trigger>
            <Tabs.Trigger value="logs" icon={ClipboardList}>Logs &amp; Access</Tabs.Trigger>
          </Tabs.List>
        </Tabs>

        {/* ── LIVE FEED ── */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm text-fg-muted">Updates on check-in · refreshes every 60s</span>
                <span className="text-xs text-fg-faint">· Last: {fmtTime(lastRefresh.toISOString())}</span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => fetchLive(livePage)} disabled={liveLoading}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`} />}>
                Refresh
              </Button>
            </div>

            {logs.length === 0 ? (
              <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
                <Radio className="w-10 h-10 text-fg-faint mx-auto mb-3" />
                <p className="text-sm text-fg-muted">No recent check-ins</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Hero card — magnified view of the most recent check-in on this page */}
                <LatestScanHero log={logs[0]} isLive={livePage === 1} />

                {logs.length > 1 && (
                  <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-line/50 flex items-center justify-between">
                      <p className="text-xs text-fg-faint uppercase tracking-wider font-semibold">Recent</p>
                      <p className="text-xs text-fg-faint">{logs.length - 1} earlier on this page</p>
                    </div>
                    <div className="divide-y divide-line">
                      {logs.slice(1).map((log) => (
                        <div key={log.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-3/20 transition-colors">
                          <Avatar log={log} size={36} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-fg font-medium truncate">{log.full_name ?? '—'}</p>
                            <p className="text-xs text-fg-faint font-mono">{log.member_number || '—'}</p>
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0 items-end">
                            {scanLocation(log) && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 max-w-[180px] truncate">
                                {scanLocation(log)}
                              </span>
                            )}
                            {log.branch_name && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                                {log.branch_name}
                              </span>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm text-fg">{fmtTime(log.check_in_at)}</p>
                            <p className="text-xs text-fg-faint">{fmtDate(log.check_in_at)}</p>
                          </div>
                          <span className="text-xs text-fg-faint flex-shrink-0 hidden lg:inline">
                            {METHODS[log.method ?? ''] ?? log.method ?? '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {liveTotalPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-line">
                        <p className="text-xs text-fg-faint">
                          Showing {(livePage - 1) * LIVE_PAGE_SIZE + 1}–{Math.min(livePage * LIVE_PAGE_SIZE, liveTotal)} of {liveTotal}
                        </p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => fetchLive(Math.max(1, livePage - 1))} disabled={livePage === 1 || liveLoading}
                            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          {Array.from({ length: Math.min(liveTotalPages, 5) }, (_, i) => {
                            const start = Math.max(1, Math.min(livePage - 2, liveTotalPages - 4));
                            return start + i;
                          }).map(n => (
                            <button key={n} onClick={() => fetchLive(n)} disabled={liveLoading}
                              className={`w-8 h-8 text-xs rounded-lg transition-colors ${n === livePage ? 'bg-brand text-brand-ink font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>
                              {n}
                            </button>
                          ))}
                          <button onClick={() => fetchLive(Math.min(liveTotalPages, livePage + 1))} disabled={livePage === liveTotalPages || liveLoading}
                            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── LOGS & ACCESS ── */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Filter className="w-4 h-4 text-fg-muted" />
                <span className="text-sm font-medium text-fg">Filters</span>
                {(fromDate || toDate || filterMember || filterPoint) && (
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setFromDate(''); setToDate(''); setFilterMember(''); setFilterPoint(''); }}>Clear all</Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-fg-faint mb-1">From</label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="[color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs text-fg-faint mb-1">To</label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="[color-scheme:dark]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-fg-faint mb-1">Member</label>
                  <Select value={filterMember} onChange={e => setFilterMember(e.target.value)}>
                    <option value="">All members</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name ?? m.member_number}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-fg-faint mb-1">Entry Point</label>
                  <Select value={filterPoint} onChange={e => setFilterPoint(e.target.value)}>
                    <option value="">All entry points</option>
                    <optgroup label="Gym">
                      {allAccessPoints
                        .filter(p => !sessionEntryPoints.includes(p))
                        .map(p => <option key={p} value={p}>{p}</option>)}
                    </optgroup>
                    {sessionEntryPoints.length > 0 && (
                      <optgroup label="Today's Classes">
                        {sessionEntryPoints.map(p => <option key={p} value={p}>{p}</option>)}
                      </optgroup>
                    )}
                  </Select>
                </div>
              </div>
              <Button variant="primary" fullWidth onClick={() => fetchLogs(1)} isLoading={logsLoading}>
                Apply Filters
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint z-10" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, ID, or entry point…"
                className="pl-9" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg z-10"><X className="w-3.5 h-3.5" /></button>}
            </div>

            <div className="text-xs text-fg-faint">{logsTotal > 0 ? `${logsTotal} records` : `${displayedLogs.length} records`}</div>

            {/* Table */}
            <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
              {displayedLogs.length === 0 ? (
                <div className="p-12 text-center">
                  <ClipboardList className="w-10 h-10 text-fg-faint mx-auto mb-3" />
                  <p className="text-sm text-fg-muted">No logs found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">MEMBER</th>
                          <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">CHECK-IN</th>
                          <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">BRANCH</th>
                          <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">ENTRY POINT</th>
                          <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">SPECIALIST</th>
                          <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">METHOD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {paginatedLogs.map(log => (
                          <tr key={log.id} className="hover:bg-surface-3/20 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="text-fg font-medium">{log.full_name ?? '—'}</p>
                              <p className="text-xs text-fg-faint font-mono">{log.member_number}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="text-fg">{fmtTime(log.check_in_at)}</p>
                              <p className="text-xs text-fg-faint">{fmtDate(log.check_in_at)}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              {log.branch_name
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand">{log.branch_name}</span>
                                : <span className="text-fg-faint text-xs">—</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              {log.access_point
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{log.access_point}</span>
                                : <span className="text-fg-faint text-xs">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-fg-muted text-sm">
                              {log.instructor_name ?? <span className="text-fg-faint text-xs">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-fg-muted text-xs capitalize">
                              {METHODS[log.method ?? ''] ?? log.method ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {logsTotalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-line">
                      <p className="text-xs text-fg-faint">
                        Showing {(logsPage - 1) * LOGS_PAGE_SIZE + 1}–{Math.min(logsPage * LOGS_PAGE_SIZE, logsTotal)} of {logsTotal}
                      </p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => fetchLogs(Math.max(1, logsPage - 1))} disabled={logsPage === 1 || logsLoading}
                          className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(logsTotalPages, 5) }, (_, i) => {
                          const start = Math.max(1, Math.min(logsPage - 2, logsTotalPages - 4));
                          return start + i;
                        }).map(n => (
                          <button key={n} onClick={() => fetchLogs(n)} disabled={logsLoading}
                            className={`w-8 h-8 text-xs rounded-lg transition-colors ${n === logsPage ? 'bg-brand text-brand-ink font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>
                            {n}
                          </button>
                        ))}
                        <button onClick={() => fetchLogs(Math.min(logsTotalPages, logsPage + 1))} disabled={logsPage === logsTotalPages || logsLoading}
                          className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {showManual && (
        <ManualLogModal
          members={members}
          accessPoints={allAccessPoints}
          sessionEntryPoints={sessionEntryPoints}
          sessionOptions={sessionOptions}
          branches={branches}
          onClose={() => setShowManual(false)}
          onSaved={log => {
            if (livePage === 1) {
              setLogs(prev => [log, ...prev].slice(0, LIVE_PAGE_SIZE));
            } else {
              fetchLive(1);
            }
            setLogsData(prev => [log, ...prev]);
            refresh();
          }}
        />
      )}

      {showQR && (
        <GymQRModal gymId={gymId} branches={branches} onClose={() => setShowQR(false)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Feed helpers
// ─────────────────────────────────────────────────────────────────────────────

// Best label for the scan location: class > studio > legacy access_point.
// Branch is rendered separately because it always sits next to the scan,
// regardless of whether the scan was at a class, studio, or front door.
function scanLocation(log: AttendanceLog): string | null {
  return log.class_name || log.studio_name || log.access_point;
}

// Trainer / specialist name. Class instructors take priority because they're
// the formal owner of the session; specialist_name falls back for service
// (PT / nutrition) check-ins where no class session exists.
function trainerName(log: AttendanceLog): string | null {
  return log.instructor_name || log.specialist_name;
}

function planLabel(log: AttendanceLog): string | null {
  if (log.plan_name) return log.plan_name;
  if (log.plan_type) {
    return ({
      sessions: 'Sessions plan',
      duration: 'Duration plan',
      duration_session: 'Duration + sessions',
    } as Record<string, string>)[log.plan_type] ?? log.plan_type;
  }
  return null;
}

function initials(name: string | null, fallback: string | null): string {
  const source = (name ?? fallback ?? '?').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface AvatarProps {
  log: AttendanceLog;
  size: number;
  ring?: boolean;
}

function Avatar({ log, size, ring }: AvatarProps) {
  const dim = `${size}px`;
  const fontPx = size >= 80 ? 'text-2xl' : size >= 56 ? 'text-base' : 'text-xs';
  if (log.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={log.photo_url}
        alt={log.full_name ?? log.member_number}
        style={{ width: dim, height: dim }}
        className={`rounded-full object-cover bg-surface-3 flex-shrink-0 ${ring ? 'ring-2 ring-success/50' : ''}`}
      />
    );
  }
  return (
    <div
      style={{ width: dim, height: dim }}
      className={`rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0 ${ring ? 'ring-2 ring-success/50' : ''}`}
    >
      <span className={`font-bold text-brand ${fontPx}`}>{initials(log.full_name, log.member_number)}</span>
    </div>
  );
}

interface LatestScanHeroProps {
  log: AttendanceLog;
  isLive: boolean;
}

function LatestScanHero({ log, isLive }: LatestScanHeroProps) {
  const where = scanLocation(log);
  const trainer = trainerName(log);
  const plan = planLabel(log);
  const dt = new Date(log.check_in_at);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-success/20 bg-gradient-to-br from-surface-2 via-surface-2 to-surface-2/60 p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-success-soft blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex items-center gap-5">
          <Avatar log={log} size={88} ring={isLive} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success-soft text-success text-[10px] font-bold uppercase tracking-wider">
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                Latest
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
                {METHODS[log.method ?? ''] ?? log.method ?? 'Check-in'}
              </span>
            </div>
            <p className="text-2xl font-bold text-fg truncate">{log.full_name ?? '—'}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-fg-muted font-mono">#{log.member_number || '—'}</span>
              {plan && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                  {plan}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 lg:border-l lg:border-line/60 lg:pl-8">
          <HeroField icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={where ?? log.branch_name ?? 'Gym entrance'} sub={where && log.branch_name ? log.branch_name : null} />
          <HeroField icon={<UserIcon className="w-3.5 h-3.5" />} label="Trainer" value={trainer ?? '—'} mute={!trainer} />
          <HeroField icon={<Calendar className="w-3.5 h-3.5" />} label="Date" value={fmtDate(log.check_in_at)} sub={dt.toLocaleDateString('en-US', { weekday: 'long' })} />
          <HeroField icon={<Clock className="w-3.5 h-3.5" />} label="Time" value={fmtTime(log.check_in_at)} sub={relativeTime(dt)} />
        </div>
      </div>
    </div>
  );
}

interface HeroFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
  mute?: boolean;
}

function HeroField({ icon, label, value, sub, mute }: HeroFieldProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fg-faint mb-1">
        {icon}
        {label}
      </div>
      <p className={`text-sm font-semibold truncate ${mute ? 'text-fg-faint' : 'text-fg'}`}>{value}</p>
      {sub && <p className="text-xs text-fg-faint truncate">{sub}</p>}
    </div>
  );
}

function relativeTime(dt: Date): string {
  const diffMs = Date.now() - dt.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}
