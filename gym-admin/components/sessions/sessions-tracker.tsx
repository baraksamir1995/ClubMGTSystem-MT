'use client';

import { useState, useMemo } from 'react';
import {
  Search, Plus, ExternalLink, AlertTriangle,
  Clock, RefreshCw, History, Users,
} from 'lucide-react';
import Link from 'next/link';
import { fmt12, fmtTime12 } from '@/lib/time';

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
}

type SortKey = 'name' | 'pctUsed' | 'sessionsRemaining' | 'endDate';
type Tab = 'members' | 'history';

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionsTracker({ initialMembers }: Props) {
  const [activeTab, setActiveTab]   = useState<Tab>('members');
  const [members, setMembers]       = useState<SessionsMember[]>(initialMembers);
  const [logs, setLogs]             = useState<SessionLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const [search, setSearch]         = useState('');
  const [sortKey, setSortKey]       = useState<SortKey>('pctUsed');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [loadingId, setLoadingId]   = useState<string | null>(null);
  const [editId, setEditId]         = useState<string | null>(null);
  const [editValue, setEditValue]   = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/sessions/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function loadHistory() {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/sessions/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setLogsLoaded(true);
      }
    } finally {
      setLogsLoading(false);
    }
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'history' && !logsLoaded) loadHistory();
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  // Coerce each field to a safe number so a malformed row can't poison the reduce with NaN.
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const totalSessions  = members.reduce((s, m) => s + n(m.sessionCount),      0);
  const totalUsed      = members.reduce((s, m) => s + n(m.sessionsUsed),      0);
  const totalRemaining = members.reduce((s, m) => s + n(m.sessionsRemaining), 0);
  const overallPct     = totalSessions > 0 ? Math.round((totalUsed / totalSessions) * 100) : 0;

  // ── Members filter + sort ────────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase();
    let list = members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q) ||
        m.planName.toLowerCase().includes(q),
    );
    list = [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'name')               { av = a.fullName;          bv = b.fullName; }
      else if (sortKey === 'pctUsed')       { av = a.pctUsed;           bv = b.pctUsed; }
      else if (sortKey === 'sessionsRemaining') { av = a.sessionsRemaining; bv = b.sessionsRemaining; }
      else                                  { av = a.endDate ?? '';     bv = b.endDate ?? ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [members, search, sortKey, sortDir]);

  // ── Logs filter ──────────────────────────────────────────────────────────

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.fullName.toLowerCase().includes(q) ||
        l.memberNumber.toLowerCase().includes(q) ||
        l.planName.toLowerCase().includes(q) ||
        (l.className ?? '').toLowerCase().includes(q),
    );
  }, [logs, search]);

  // ── Actions ──────────────────────────────────────────────────────────────

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
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
      if (logsLoaded) loadHistory();
    } finally {
      setLoadingId(null);
    }
  }

  async function saveEdit(membershipId: string, sessionCount: number) {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0 || val > sessionCount) return;
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
    } finally {
      setLoadingId(null);
      setEditId(null);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function statusBadge(m: SessionsMember) {
    if (m.sessionsRemaining === 0)
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">Exhausted</span>;
    if (m.pctUsed >= 80)
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">Low</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">Active</span>;
  }

  function expiryWarning(endDate: string | null) {
    if (!endDate) return null;
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
    if (days < 0)  return <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Expired</span>;
    if (days <= 7) return <span className="text-xs text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3" />{days}d left</span>;
    return null;
  }

  function sourceLabel(source: string) {
    if (source === 'class_qr') return { label: 'QR Scan', cls: 'bg-blue-500/20 text-blue-400' };
    if (source === 'manual')   return { label: 'Manual',  cls: 'bg-amber-500/20 text-amber-400' };
    return                            { label: source,    cls: 'bg-gray-500/20 text-fg-muted' };
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Members on plan',      value: members.length, sub: 'Sessions-based plans' },
          { label: 'Total sessions issued', value: totalSessions,  sub: 'Across all members' },
          { label: 'Sessions consumed',     value: totalUsed,      sub: `${overallPct}% overall usage` },
          { label: 'Sessions remaining',    value: totalRemaining, sub: 'Across all members' },
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
          Members Overview
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
          Scan History
          {logsLoaded && logs.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-surface-3 text-fg-muted">
              {logs.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Search + Refresh ────────────────────────────────────────── */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
          <input
            type="text"
            placeholder={
              activeTab === 'history'
                ? 'Search by name, member #, plan, or class…'
                : 'Search by name, email, member #, or plan…'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surface-2 border border-line rounded-lg text-sm text-fg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        {activeTab === 'members' && (
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 border border-line hover:bg-surface-3 rounded-lg text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
        {activeTab === 'history' && (
          <button
            onClick={loadHistory}
            disabled={logsLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 border border-line hover:bg-surface-3 rounded-lg text-sm text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
            Refresh
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
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('name')} className="hover:text-fg transition-colors">
                      Member{sortArrow('name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('pctUsed')} className="hover:text-fg transition-colors">
                      Sessions usage{sortArrow('pctUsed')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <button onClick={() => toggleSort('sessionsRemaining')} className="hover:text-fg transition-colors">
                      Remaining{sortArrow('sessionsRemaining')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort('endDate')} className="hover:text-fg transition-colors">
                      Expires{sortArrow('endDate')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-fg-faint">
                      No members found
                    </td>
                  </tr>
                )}
                {filteredMembers.map((m) => (
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
                            >Save</button>
                            <button
                              onClick={() => setEditId(null)}
                              className="px-2 py-1 bg-surface-3 hover:bg-surface-4 rounded text-fg-muted text-xs transition-colors"
                            >✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditId(m.membershipId); setEditValue(String(m.sessionsUsed)); }}
                            className="group flex-1" title="Click to edit"
                          >
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-fg-muted group-hover:text-gray-200 transition-colors">{m.sessionsUsed} used</span>
                              <span className="text-fg-faint">{m.pctUsed}%</span>
                            </div>
                            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden w-36">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  m.pctUsed >= 100 ? 'bg-red-500' : m.pctUsed >= 80 ? 'bg-amber-500' : 'bg-brand'
                                }`}
                                style={{ width: `${m.pctUsed}%` }}
                              />
                            </div>
                            <p className="text-xs text-fg-faint mt-0.5">of {m.sessionCount} sessions</p>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${
                        m.sessionsRemaining === 0 ? 'text-red-400'
                        : m.sessionsRemaining <= 3 ? 'text-amber-400'
                        : 'text-fg'
                      }`}>{m.sessionsRemaining}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-fg-muted text-xs">
                          {m.endDate
                            ? new Date(m.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
                          Session
                        </button>
                        <Link
                          href={`/dashboard/members/${m.memberId}`}
                          className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted hover:text-fg transition-colors"
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
        </div>
      )}

      {/* ── Scan History table ───────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-surface-2 rounded-xl border border-line overflow-hidden">
          {logsLoading ? (
            <div className="py-16 text-center text-fg-faint text-sm">Loading history…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Date & Time</th>
                    <th className="px-4 py-3 text-left">Member</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-left">Class / Source</th>
                    <th className="px-4 py-3 text-center">Sessions at time</th>
                    <th className="px-4 py-3 text-center">Source</th>
                    <th className="px-4 py-3 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-fg-faint">
                        {logsLoaded ? 'No scan history found' : 'Switch to this tab to load history'}
                      </td>
                    </tr>
                  )}
                  {filteredLogs.map((l) => {
                    const src = sourceLabel(l.source);
                    const isReversed = !!l.reversedAt;
                    return (
                      <tr key={l.id} className={`hover:bg-surface-3/30 transition-colors ${isReversed ? 'opacity-50' : ''}`}>
                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-fg text-xs font-medium">
                            {new Date(l.consumedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-fg-faint text-xs">
                            {fmtTime12(new Date(l.consumedAt))}
                          </p>
                          {isReversed && (
                            <p className="text-xs text-red-400 mt-0.5">Reversed</p>
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
                            l.membershipStatus === 'active'    ? 'bg-emerald-500/10 text-emerald-400' :
                            l.membershipStatus === 'exhausted' ? 'bg-red-500/10 text-red-400' :
                            l.membershipStatus === 'expired'   ? 'bg-gray-500/10 text-fg-muted' :
                            'bg-gray-500/10 text-fg-muted'
                          }`}>{l.membershipStatus}</span>
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
                                <p className="text-gray-200 text-xs font-medium">{l.className}</p>
                                {l.sessionDate && (
                                  <p className="text-fg-faint text-xs">
                                    {new Date(l.sessionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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
                        <td className="px-4 py-3 text-right">
                          {l.memberId && (
                            <Link
                              href={`/dashboard/members/${l.memberId}`}
                              className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted hover:text-fg transition-colors inline-flex"
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
          )}
        </div>
      )}

      <p className="text-xs text-fg-faint text-center">
        {activeTab === 'members'
          ? `${filteredMembers.length} of ${members.length} members shown`
          : `${filteredLogs.length} of ${logs.length} entries shown`}
        {search && ` · filtered by "${search}"`}
      </p>
    </div>
  );
}
