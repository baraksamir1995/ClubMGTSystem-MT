'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, Plus, ExternalLink, AlertTriangle,
  Clock, RefreshCw, History, Users, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { fmt12, fmtTime12 } from '@/lib/time';
import type { PageMeta, TrackerStats } from '@/lib/sessions-tracker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionsMember {
  membershipId: string;
  memberId: string;
  memberNumber: string;
  fullName: string;
  email: string | null;
  planId: string;
  planName: string;
  sessionCount: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  pctUsed: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface SessionLog {
  id: string;
  consumedAt: string;
  source: string;
  reversedAt: string | null;
  memberId: string;
  memberNumber: string;
  fullName: string;
  email: string | null;
  membershipId: string;
  planName: string;
  planType: string;
  membershipStatus: string;
  sessionsUsed: number | null;
  sessionsTotal: number | null;
  className: string | null;
  classType: string | null;
  classColor: string | null;
  sessionDate: string | null;
  sessionTime: string | null;
}

interface Props {
  initialMembers: SessionsMember[];
  initialMeta: PageMeta;
  initialStats: TrackerStats;
}

type SortKey = 'name' | 'pctUsed' | 'sessionsRemaining' | 'endDate';
type Tab = 'members' | 'history';

const SORT_PARAM: Record<SortKey, string> = {
  name: 'name',
  pctUsed: 'pct_used',
  sessionsRemaining: 'sessions_remaining',
  endDate: 'end_date',
};

function pageWindow(current: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const wanted = [...new Set([1, current - 1, current, current + 1, last])]
    .filter((p) => p >= 1 && p <= last)
    .sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  wanted.forEach((p, i) => {
    if (i > 0 && p - wanted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionsTracker({ initialMembers, initialMeta, initialStats }: Props) {
  const t  = useTranslations('classes');
  const tc = useTranslations('common');
  const locale = useLocale();
  const dateLocale = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';

  const [activeTab, setActiveTab]   = useState<Tab>('members');
  const [members, setMembers]       = useState<SessionsMember[]>(initialMembers);
  const [membersMeta, setMembersMeta] = useState<PageMeta>(initialMeta);
  const [stats, setStats]           = useState<TrackerStats>(initialStats);
  const [logs, setLogs]             = useState<SessionLog[]>([]);
  const [logsMeta, setLogsMeta]     = useState<PageMeta>({ page: 1, perPage: 10, total: 0, lastPage: 1 });
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const [search, setSearch]         = useState('');
  const [sortKey, setSortKey]       = useState<SortKey>('pctUsed');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [loadingId, setLoadingId]   = useState<string | null>(null);
  const [editId, setEditId]         = useState<string | null>(null);
  const [editValue, setEditValue]   = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ── Server-side data fetching ────────────────────────────────────────────

  async function loadMembers(opts: { page?: number; sort?: SortKey; dir?: 'asc' | 'desc'; query?: string } = {}) {
    const page  = opts.page ?? membersMeta.page;
    const sort  = opts.sort ?? sortKey;
    const dir   = opts.dir ?? sortDir;
    const query = opts.query ?? search;
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '10', sort: SORT_PARAM[sort], dir });
      if (query) params.set('search', query);
      const res = await fetch(`/api/sessions/members?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
        if (data.meta) setMembersMeta(data.meta);
        if (data.stats) setStats(data.stats);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function loadLogs(opts: { page?: number; query?: string } = {}) {
    const page  = opts.page ?? logsMeta.page;
    const query = opts.query ?? search;
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '10' });
      if (query) params.set('search', query);
      const res = await fetch(`/api/sessions/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        if (data.meta) setLogsMeta(data.meta);
        setLogsLoaded(true);
      }
    } finally {
      setLogsLoading(false);
    }
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'history' && !logsLoaded) loadLogs({ page: 1 });
  }

  // Debounced server-side search for the active tab.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) { searchMounted.current = true; return; }
    const timer = setTimeout(() => {
      if (activeTab === 'members') loadMembers({ page: 1, query: search });
      else loadLogs({ page: 1, query: search });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Actions ──────────────────────────────────────────────────────────────

  function toggleSort(key: SortKey) {
    const nextDir: 'asc' | 'desc' = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    setSortKey(key);
    setSortDir(nextDir);
    loadMembers({ page: 1, sort: key, dir: nextDir });
  }

  async function logSession(membershipId: string) {
    setLoadingId(membershipId);
    try {
      const res = await fetch(`/api/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log' }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setMembers((prev) =>
        prev.map((m) => {
          if (m.membershipId !== membershipId) return m;
          // Trust server response when present, otherwise fall back to a local +1 on the
          // existing row so we never write undefined into state.
          const sessionCount      = Number(updated.sessionCount      ?? m.sessionCount)      || 0;
          const sessionsUsed      = Number(updated.sessionsUsed      ?? m.sessionsUsed + 1)  || 0;
          const sessionsRemaining = Number(updated.sessionsRemaining ?? Math.max(0, sessionCount - sessionsUsed)) || 0;
          const pctUsed = sessionCount > 0 ? Math.round((sessionsUsed / sessionCount) * 100) : 0;
          return { ...m, sessionCount, sessionsUsed, sessionsRemaining, pctUsed };
        }),
      );
      setStats((s) => ({ ...s, totalUsed: s.totalUsed + 1, totalRemaining: Math.max(0, s.totalRemaining - 1) }));
      if (logsLoaded) loadLogs({ page: logsMeta.page });
    } finally {
      setLoadingId(null);
    }
  }

  async function saveEdit(membershipId: string, sessionCount: number) {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0 || val > sessionCount) return;
    const prevUsed = members.find((m) => m.membershipId === membershipId)?.sessionsUsed ?? 0;
    setLoadingId(membershipId);
    try {
      const res = await fetch(`/api/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', value: val }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setMembers((prev) =>
        prev.map((m) =>
          m.membershipId === membershipId
            ? {
                ...m,
                sessionsUsed:      updated.sessionsUsed,
                sessionsRemaining: updated.sessionsRemaining,
                pctUsed: updated.sessionCount > 0
                  ? Math.round((updated.sessionsUsed / updated.sessionCount) * 100)
                  : 0,
              }
            : m,
        ),
      );
      const delta = (updated.sessionsUsed ?? val) - prevUsed;
      setStats((s) => ({ ...s, totalUsed: s.totalUsed + delta, totalRemaining: Math.max(0, s.totalRemaining - delta) }));
    } finally {
      setLoadingId(null);
      setEditId(null);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function statusBadge(m: SessionsMember) {
    if (m.sessionsRemaining === 0)
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-danger-soft text-danger">{t('sessionsTracker.exhausted')}</span>;
    if (m.pctUsed >= 80)
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-warning-soft text-warning">{t('sessionsTracker.low')}</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success-soft text-success">{tc('active')}</span>;
  }

  function expiryWarning(endDate: string | null) {
    if (!endDate) return null;
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
    if (days < 0)  return <span className="text-xs text-danger flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t('sessionsTracker.expired')}</span>;
    if (days <= 7) return <span className="text-xs text-warning flex items-center gap-1"><Clock className="w-3 h-3" />{t('sessionsTracker.daysLeft', { days })}</span>;
    return null;
  }

  function sourceLabel(source: string) {
    if (source === 'class_qr') return { label: t('sessionsTracker.sourceQr'),     cls: 'bg-info-soft text-info' };
    if (source === 'manual')   return { label: t('sessionsTracker.sourceManual'), cls: 'bg-warning-soft text-warning' };
    return                            { label: source,                             cls: 'bg-surface-3 text-fg-muted' };
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  function paginationBar(meta: PageMeta, onPage: (p: number) => void, disabled: boolean) {
    if (meta.lastPage <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-line">
        <p className="text-xs text-fg-muted">{t('sessionsTracker.pageOf', { page: meta.page, total: meta.lastPage })}</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(Math.max(1, meta.page - 1))}
            disabled={disabled || meta.page === 1}
            aria-label={tc('previous')}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden />
          </button>
          {pageWindow(meta.page, meta.lastPage).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-fg-faint">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                disabled={disabled}
                className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                  p === meta.page ? 'bg-brand text-brand-ink font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-3'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => onPage(Math.min(meta.lastPage, meta.page + 1))}
            disabled={disabled || meta.page === meta.lastPage}
            aria-label={tc('next')}
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('sessionsTracker.statMembersOnPlan'),      value: stats.members,        sub: t('sessionsTracker.statMembersOnPlanSub') },
          { label: t('sessionsTracker.statTotalIssued'),        value: stats.totalSessions,  sub: t('sessionsTracker.statAcrossAllMembers') },
          { label: t('sessionsTracker.statConsumed'),           value: stats.totalUsed,      sub: t('sessionsTracker.statOverallPct', { pct: stats.totalSessions > 0 ? Math.round((stats.totalUsed / stats.totalSessions) * 100) : 0 }) },
          { label: t('sessionsTracker.statRemaining'),          value: stats.totalRemaining, sub: t('sessionsTracker.statAcrossAllMembers') },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-2 rounded-xl p-4 border border-line">
            <p className="text-2xl font-bold text-fg">{stat.value}</p>
            <p className="text-sm font-medium text-fg-muted mt-0.5">{stat.label}</p>
            <p className="text-xs text-fg-faint mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-line">
        <button
          onClick={() => switchTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'members'
              ? 'border-brand text-brand'
              : 'border-transparent text-fg-muted hover:text-fg'
          }`}
        >
          <Users className="w-4 h-4" />
          {t('sessionsTracker.tabMembers')}
        </button>
        <button
          onClick={() => switchTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === 'history'
              ? 'border-brand text-brand'
              : 'border-transparent text-fg-muted hover:text-fg'
          }`}
        >
          <History className="w-4 h-4" />
          {t('sessionsTracker.tabHistory')}
          {logsLoaded && logsMeta.total > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-surface-3 text-fg-muted">
              {logsMeta.total}
            </span>
          )}
        </button>
      </div>

      {/* ── Search + Refresh ────────────────────────────────────────── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
          <input
            type="text"
            placeholder={
              activeTab === 'history'
                ? t('sessionsTracker.searchHistoryPlaceholder')
                : t('sessionsTracker.searchMembersPlaceholder')
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-9 pe-4 py-2.5 bg-surface-2 border border-line rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        {activeTab === 'members' && (
          <button
            onClick={() => loadMembers()}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 border border-line hover:bg-surface-3 rounded-lg text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t('sessionsTracker.refresh')}
          </button>
        )}
        {activeTab === 'history' && (
          <button
            onClick={() => loadLogs()}
            disabled={logsLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 border border-line hover:bg-surface-3 rounded-lg text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
            {t('sessionsTracker.refresh')}
          </button>
        )}
      </div>

      {/* ── Members table ───────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="bg-surface-2 rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                  <th scope="col" className="px-4 py-3 text-start">
                    <button onClick={() => toggleSort('name')} className="hover:text-fg transition-colors">
                      {t('sessionsTracker.colMember')}{sortArrow('name')}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-start">{t('sessionsTracker.colPlan')}</th>
                  <th scope="col" className="px-4 py-3 text-start">
                    <button onClick={() => toggleSort('pctUsed')} className="hover:text-fg transition-colors">
                      {t('sessionsTracker.colSessionsUsage')}{sortArrow('pctUsed')}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    <button onClick={() => toggleSort('sessionsRemaining')} className="hover:text-fg transition-colors">
                      {t('sessionsTracker.colRemaining')}{sortArrow('sessionsRemaining')}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-start">
                    <button onClick={() => toggleSort('endDate')} className="hover:text-fg transition-colors">
                      {t('sessionsTracker.colExpires')}{sortArrow('endDate')}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">{tc('status')}</th>
                  <th scope="col" className="px-4 py-3 text-end">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-fg-faint">
                      {t('sessionsTracker.noMembersFound')}
                    </td>
                  </tr>
                )}
                {members.map((m) => (
                  <tr key={m.membershipId} className="hover:bg-surface-3/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-brand-ink text-xs font-bold flex-shrink-0">
                          {m.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-fg font-medium leading-tight">{m.fullName}</p>
                          <p className="text-fg-faint text-xs">{m.memberNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-fg-muted">{m.planName}</span>
                    </td>
                    <td className="px-4 py-3 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        {editId === m.membershipId ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" min={0} max={m.sessionCount}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-16 px-2 py-1 bg-surface-3 border border-line rounded text-fg text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                            />
                            <span className="text-fg-faint text-xs">/ {m.sessionCount}</span>
                            <button
                              onClick={() => saveEdit(m.membershipId, m.sessionCount)}
                              disabled={loadingId === m.membershipId}
                              className="px-2 py-1 bg-brand hover:bg-brand-dim rounded text-brand-ink text-xs font-medium transition-colors disabled:opacity-50"
                            >{tc('save')}</button>
                            <button
                              onClick={() => setEditId(null)}
                              className="px-2 py-1 bg-surface-3 hover:bg-surface-4 rounded text-fg-muted text-xs transition-colors"
                            >✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditId(m.membershipId); setEditValue(String(m.sessionsUsed)); }}
                            className="group flex-1" title={t('sessionsTracker.clickToEdit')}
                          >
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-fg-muted group-hover:text-fg transition-colors">{t('sessionsTracker.sessionsUsedLabel', { count: m.sessionsUsed })}</span>
                              <span className="text-fg-faint">{m.pctUsed}%</span>
                            </div>
                            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden w-36">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  m.pctUsed >= 100 ? 'bg-danger' : m.pctUsed >= 80 ? 'bg-warning' : 'bg-brand'
                                }`}
                                style={{ width: `${m.pctUsed}%` }}
                              />
                            </div>
                            <p className="text-xs text-fg-faint mt-0.5">{t('sessionsTracker.ofSessionsTotal', { count: m.sessionCount })}</p>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${
                        m.sessionsRemaining === 0 ? 'text-danger'
                        : m.sessionsRemaining <= 3 ? 'text-warning'
                        : 'text-fg'
                      }`}>{m.sessionsRemaining}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-fg-muted text-xs">
                          {m.endDate
                            ? new Date(m.endDate).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </p>
                        {expiryWarning(m.endDate)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(m)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => logSession(m.membershipId)}
                          disabled={loadingId === m.membershipId || m.sessionsRemaining === 0}
                          className="flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dim disabled:opacity-40 rounded-lg text-brand-ink text-xs font-medium transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          {t('sessionsTracker.logSession')}
                        </button>
                        <Link
                          href={`/dashboard/members/${m.memberId}`}
                          className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted hover:text-fg transition-colors"
                          title={t('sessionsTracker.colProfile')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginationBar(membersMeta, (p) => loadMembers({ page: p }), refreshing)}
        </div>
      )}

      {/* ── Scan History table ───────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-surface-2 rounded-xl border border-line overflow-hidden">
          {logsLoading ? (
            <div className="py-16 text-center text-fg-faint text-sm">{tc('loading')}</div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                    <th scope="col" className="px-4 py-3 text-start">{t('sessionsTracker.colDateTime')}</th>
                    <th scope="col" className="px-4 py-3 text-start">{t('sessionsTracker.colMember')}</th>
                    <th scope="col" className="px-4 py-3 text-start">{t('sessionsTracker.colPlan')}</th>
                    <th scope="col" className="px-4 py-3 text-start">{t('sessionsTracker.colClassSource')}</th>
                    <th scope="col" className="px-4 py-3 text-center">{t('sessionsTracker.colSessionsAtTime')}</th>
                    <th scope="col" className="px-4 py-3 text-center">{t('sessionsTracker.colSource')}</th>
                    <th scope="col" className="px-4 py-3 text-end">{t('sessionsTracker.colProfile')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-fg-faint">
                        {logsLoaded ? t('sessionsTracker.noHistoryFound') : t('sessionsTracker.switchToLoadHistory')}
                      </td>
                    </tr>
                  )}
                  {logs.map((l) => {
                    const src = sourceLabel(l.source);
                    const isReversed = !!l.reversedAt;
                    return (
                      <tr key={l.id} className={`hover:bg-surface-3/30 transition-colors ${isReversed ? 'opacity-50' : ''}`}>
                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-fg text-xs font-medium">
                            {new Date(l.consumedAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-fg-faint text-xs">
                            {fmtTime12(new Date(l.consumedAt))}
                          </p>
                          {isReversed && (
                            <p className="text-xs text-danger mt-0.5">{t('sessionsTracker.reversed')}</p>
                          )}
                        </td>

                        {/* Member */}
                        <td className="px-4 py-3">
                          <p className="text-fg font-medium text-sm leading-tight">{l.fullName}</p>
                          <p className="text-fg-faint text-xs">{l.memberNumber}</p>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3">
                          <p className="text-fg-muted text-xs">{l.planName}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                            l.membershipStatus === 'active'    ? 'bg-success-soft text-success' :
                            l.membershipStatus === 'exhausted' ? 'bg-danger-soft text-danger' :
                            l.membershipStatus === 'expired'   ? 'bg-surface-3 text-fg-muted' :
                            'bg-surface-3 text-fg-muted'
                          }`}>{l.membershipStatus === 'active' ? tc('active') : l.membershipStatus === 'exhausted' ? t('sessionsTracker.exhausted') : l.membershipStatus === 'expired' ? t('sessionsTracker.expired') : l.membershipStatus}</span>
                        </td>

                        {/* Class */}
                        <td className="px-4 py-3">
                          {l.className ? (
                            <div className="flex items-center gap-2">
                              {l.classColor && (
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: l.classColor }}
                                />
                              )}
                              <div>
                                <p className="text-fg text-xs font-medium">{l.className}</p>
                                {l.sessionDate && (
                                  <p className="text-fg-faint text-xs">
                                    {new Date(l.sessionDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}
                                    {l.sessionTime && ` · ${fmt12(l.sessionTime)}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-fg-faint text-xs">—</span>
                          )}
                        </td>

                        {/* Sessions at time */}
                        <td className="px-4 py-3 text-center">
                          {l.sessionsUsed != null && l.sessionsTotal != null ? (
                            <span className="text-xs text-fg-muted">
                              {l.sessionsUsed} / {l.sessionsTotal}
                            </span>
                          ) : (
                            <span className="text-fg-faint text-xs">—</span>
                          )}
                        </td>

                        {/* Source badge */}
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${src.cls}`}>
                            {src.label}
                          </span>
                        </td>

                        {/* Profile link */}
                        <td className="px-4 py-3 text-end">
                          {l.memberId && (
                            <Link
                              href={`/dashboard/members/${l.memberId}`}
                              className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted hover:text-fg transition-colors inline-flex"
                              title={t('sessionsTracker.colProfile')}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {paginationBar(logsMeta, (p) => loadLogs({ page: p }), logsLoading)}
            </>
          )}
        </div>
      )}

      <p className="text-xs text-fg-faint text-center">
        {activeTab === 'members'
          ? t('sessionsTracker.footerMembers', { shown: members.length, total: membersMeta.total })
          : t('sessionsTracker.footerEntries', { shown: logs.length, total: logsMeta.total })}
        {search && ` · ${t('sessionsTracker.filteredBy', { query: search })}`}
      </p>
    </div>
  );
}
