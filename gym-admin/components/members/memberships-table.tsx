'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, X, Filter, ChevronLeft, ChevronRight, Download, Eye,
  RefreshCw, BadgeCheck, AlertTriangle, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDateGym as fmtDate } from '@/lib/time';

const PAGE_SIZE = 25;
const DEFAULT_EXPIRING_DAYS = 7;

export type DisplayStatus = 'active' | 'expiring_soon' | 'expired';

export interface MembershipRow {
  id: string;
  gym_member_id: string;
  member_number: string | null;
  member_name: string | null;
  member_email: string | null;
  member_photo_url: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_type: string | null;
  status: string;
  payment_status: string;
  source_type: string;
  start_date: string;
  end_date: string | null;
  sessions_total: number | null;
  sessions_used: number;
  sessions_remaining: number | null;
  days_remaining: number | null;
  display_status: DisplayStatus;
  last_check_in_at: string | null;
}

interface Pagination { page: number; limit: number; total: number; pages: number }
interface Summary { active: number; expiring_soon: number; expired: number }

interface ApiResponse {
  data?: MembershipRow[];
  pagination?: Pagination;
  summary?: Summary;
  error?: string;
}

const PLAN_TYPES = [
  { value: 'all',              label: 'All plan types' },
  { value: 'sessions',         label: 'Sessions' },
  { value: 'duration',         label: 'Duration' },
  { value: 'duration_session', label: 'Duration + Sessions' },
] as const;

const STATUS_FILTERS = [
  { value: 'all',           label: 'All statuses' },
  { value: 'active',        label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring soon' },
  { value: 'expired',       label: 'Expired' },
] as const;

// Source filters — paid subscriptions vs gifted (transferred) buckets.
// The session-transfer feature creates one membership row per gift, so a
// recipient can accumulate many transfer rows; defaulting the operational
// view to subscriptions only keeps the table actionable.
const SOURCE_FILTERS = [
  { value: 'subscription', label: 'Subscriptions only' },
  { value: 'all',          label: 'All sources' },
  { value: 'transfer',     label: 'Transferred only' },
] as const;

// Filter state is persisted in sessionStorage so navigating to a member
// detail and back keeps the same filtered view. Cleared when the tab
// closes — that's the natural "session" boundary the user expects.
const STORAGE_KEY = 'memberships-table-filters-v1';

interface PersistedFilters {
  search: string;
  status: string;
  planType: string;
  sourceType: string;
  startFrom: string;
  startTo: string;
  endFrom: string;
  endTo: string;
  expiringDays: number;
  showFilters: boolean;
}

const DEFAULT_FILTERS: PersistedFilters = {
  search: '',
  status: 'all',
  planType: 'all',
  // Default to subscriptions — most operational follow-ups (renewals,
  // expiring plans) are about paid plans, not gifted session buckets.
  sourceType: 'subscription',
  startFrom: '',
  startTo: '',
  endFrom: '',
  endTo: '',
  expiringDays: DEFAULT_EXPIRING_DAYS,
  showFilters: false,
};

function loadPersistedFilters(): PersistedFilters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FILTERS, ...parsed };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export default function MembershipsTable() {
  const [rows, setRows]               = useState<MembershipRow[]>([]);
  const [summary, setSummary]         = useState<Summary>({ active: 0, expiring_soon: 0, expired: 0 });
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Filters — initialized from sessionStorage on first render so the user
  // returns to the same filtered view after a navigation.
  const initial = useRef<PersistedFilters>(loadPersistedFilters());
  const [search, setSearch]               = useState(initial.current.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.current.search);
  const [status, setStatus]               = useState<string>(initial.current.status);
  const [planType, setPlanType]           = useState<string>(initial.current.planType);
  const [sourceType, setSourceType]       = useState<string>(initial.current.sourceType);
  const [startFrom, setStartFrom]         = useState<string>(initial.current.startFrom);
  const [startTo, setStartTo]             = useState<string>(initial.current.startTo);
  const [endFrom, setEndFrom]             = useState<string>(initial.current.endFrom);
  const [endTo, setEndTo]                 = useState<string>(initial.current.endTo);
  const [expiringDays, setExpiringDays]   = useState<number>(initial.current.expiringDays);
  const [showFilters, setShowFilters]     = useState(initial.current.showFilters);

  // Persist filters whenever any of them change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const snapshot: PersistedFilters = {
        search, status, planType, sourceType,
        startFrom, startTo, endFrom, endTo,
        expiringDays, showFilters,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {/* sessionStorage may be unavailable in private mode */}
  }, [search, status, planType, sourceType, startFrom, startTo, endFrom, endTo, expiringDays, showFilters]);

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const fetchRows = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', String(PAGE_SIZE));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status !== 'all') params.set('status', status);
    if (planType !== 'all') params.set('plan_type', planType);
    if (sourceType !== 'all') params.set('source_type', sourceType);
    if (startFrom) params.set('start_from', startFrom);
    if (startTo)   params.set('start_to',   startTo);
    if (endFrom)   params.set('end_from',   endFrom);
    if (endTo)     params.set('end_to',     endTo);
    if (expiringDays !== DEFAULT_EXPIRING_DAYS) params.set('expiring_days', String(expiringDays));

    try {
      const res = await fetch(`/api/memberships?${params}`);
      const data: ApiResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load memberships');
        return;
      }
      setRows(data.data ?? []);
      if (data.pagination) {
        setPage(data.pagination.page);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
      if (data.summary) setSummary(data.summary);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, planType, sourceType, startFrom, startTo, endFrom, endTo, expiringDays]);

  useEffect(() => {
    fetchRows(1);
    setSelected(new Set());
  }, [fetchRows]);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const clearFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setStatus('all'); setPlanType('all'); setSourceType('subscription');
    setStartFrom(''); setStartTo(''); setEndFrom(''); setEndTo('');
    setExpiringDays(DEFAULT_EXPIRING_DAYS);
  };

  const hasFilters = !!debouncedSearch || status !== 'all' || planType !== 'all'
    || sourceType !== 'subscription'
    || !!startFrom || !!startTo || !!endFrom || !!endTo
    || expiringDays !== DEFAULT_EXPIRING_DAYS;

  const exportCsv = () => {
    if (rows.length === 0) { toast.error('Nothing to export'); return; }
    const exportRows = selected.size > 0 ? rows.filter(r => selected.has(r.id)) : rows;
    const headers = [
      'Member Name', 'Member Number', 'Plan', 'Plan Type',
      'Start Date', 'End Date', 'Status', 'Days Remaining',
      'Sessions Remaining', 'Last Check-in',
    ];
    const lines = exportRows.map(r => [
      r.member_name ?? '',
      r.member_number ?? '',
      r.plan_name ?? '',
      r.plan_type ?? '',
      r.start_date ? fmtDate(r.start_date) : '',
      r.end_date ? fmtDate(r.end_date) : '',
      labelForStatus(r.display_status),
      r.days_remaining ?? '',
      r.sessions_remaining ?? '',
      r.last_check_in_at ? fmtDate(r.last_check_in_at) : '',
    ].map(escapeCsv).join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memberships-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${exportRows.length} row${exportRows.length === 1 ? '' : 's'}`);
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Memberships</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total > 0 ? `${total} memberships across your gym` : 'Aggregated view for follow-ups and renewals'}
          </p>
        </div>
      </div>

      {/* ── Summary metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryTile
          icon={<BadgeCheck className="w-5 h-5" />}
          label="Active memberships"
          value={summary.active}
          tint="emerald"
          onClick={() => setStatus('active')}
        />
        <SummaryTile
          icon={<AlertTriangle className="w-5 h-5" />}
          label={`Expiring in ${expiringDays} day${expiringDays === 1 ? '' : 's'}`}
          value={summary.expiring_soon}
          tint="amber"
          onClick={() => setStatus('expiring_soon')}
        />
        <SummaryTile
          icon={<Clock className="w-5 h-5" />}
          label="Expired"
          value={summary.expired}
          tint="rose"
          onClick={() => setStatus('expired')}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or member number…"
            className="w-full pl-9 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
        >
          {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          value={planType}
          onChange={e => setPlanType(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
        >
          {PLAN_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <select
          value={sourceType}
          onChange={e => setSourceType(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
          title="Source — paid subscription rows vs gifted/transferred buckets"
        >
          {SOURCE_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
            showFilters ? 'bg-purple-600/15 border-purple-500/40 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Date filters
        </button>

        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}

        <div className="flex-1" />

        <button onClick={() => fetchRows(page)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition-colors">
          <Download className="w-3.5 h-3.5" />
          Export {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
      </div>

      {/* Date range filters (collapsible) */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gray-800/40 border border-gray-700/50 rounded-xl">
          <DateField label="Start date from" value={startFrom} onChange={setStartFrom} />
          <DateField label="Start date to"   value={startTo}   onChange={setStartTo} />
          <DateField label="End date from"   value={endFrom}   onChange={setEndFrom} />
          <DateField label="End date to"     value={endTo}     onChange={setEndTo} />
          <div className="lg:col-span-4 flex items-center gap-3">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Expiring threshold</label>
            <input type="number" min={1} max={90} value={expiringDays}
              onChange={e => setExpiringDays(Math.max(1, Math.min(90, Number(e.target.value) || DEFAULT_EXPIRING_DAYS)))}
              className="w-20 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <span className="text-xs text-gray-500">days before end date</span>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        {error ? (
          <div className="p-12 text-center">
            <p className="text-sm text-rose-400 mb-3">{error}</p>
            <button onClick={() => fetchRows(page)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg">
              Try again
            </button>
          </div>
        ) : rows.length === 0 && !loading ? (
          <div className="p-12 text-center">
            <BadgeCheck className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {hasFilters ? 'No memberships match these filters.' : 'No memberships yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 sticky top-0 z-10">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500/30 focus:ring-offset-0"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Days left</th>
                  <th className="px-4 py-3 font-medium text-right">Sessions left</th>
                  <th className="px-4 py-3 font-medium">Last check-in</th>
                  <th className="px-4 py-3 font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {rows.map(r => (
                  <Row key={r.id} row={r} selected={selected.has(r.id)} onToggle={() => toggleOne(r.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              {selected.size > 0 && <span className="ml-2 text-purple-400">· {selected.size} selected</span>}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchRows(Math.max(1, page - 1))} disabled={page === 1 || loading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageRange(page, totalPages).map(n => (
                <button key={n} onClick={() => fetchRows(n)} disabled={loading}
                  className={`w-8 h-8 text-xs rounded-lg transition-colors ${n === page ? 'bg-purple-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                  {n}
                </button>
              ))}
              <button onClick={() => fetchRows(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────
function Row({ row, selected, onToggle }: { row: MembershipRow; selected: boolean; onToggle: () => void }) {
  const isExpiring = row.display_status === 'expiring_soon';
  return (
    <tr className={`transition-colors ${
      isExpiring ? 'bg-amber-400/[0.04] hover:bg-amber-400/[0.08]' : 'hover:bg-gray-700/20'
    }`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500/30 focus:ring-offset-0"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={row.member_name} number={row.member_number} photoUrl={row.member_photo_url} />
          <div className="min-w-0">
            <p className="text-white font-medium truncate">{row.member_name ?? '—'}</p>
            <p className="text-xs text-gray-500 font-mono truncate">{row.member_number ? `#${row.member_number}` : '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-white truncate max-w-[200px]">{row.plan_name ?? '—'}</p>
          {row.source_type === 'transfer' && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-400/15 text-purple-300 flex-shrink-0"
              title="Transferred from another member"
            >
              Transferred
            </span>
          )}
        </div>
        {row.plan_type && (
          <p className="text-xs text-gray-500 capitalize">{row.plan_type.replace('_', ' + ')}</p>
        )}
      </td>
      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtDate(row.start_date)}</td>
      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{row.end_date ? fmtDate(row.end_date) : '—'}</td>
      <td className="px-4 py-3"><StatusBadge status={row.display_status} /></td>
      <td className="px-4 py-3 text-right tabular-nums">
        <RemainingDays days={row.days_remaining} status={row.display_status} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        <Sessions row={row} />
      </td>
      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
        {row.last_check_in_at ? fmtDate(row.last_check_in_at) : <span className="text-gray-500">Never</span>}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/members/${row.gym_member_id}`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-purple-300 hover:text-white hover:bg-purple-600/20 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> View
        </Link>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  const meta = {
    active:        { bg: 'bg-emerald-400/10', text: 'text-emerald-400', label: 'Active' },
    expiring_soon: { bg: 'bg-amber-400/15',  text: 'text-amber-300',   label: 'Expiring soon' },
    expired:       { bg: 'bg-rose-400/10',    text: 'text-rose-400',    label: 'Expired' },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

function RemainingDays({ days, status }: { days: number | null; status: DisplayStatus }) {
  if (days === null) return <span className="text-gray-500">—</span>;
  if (status === 'expired') {
    return <span className="text-rose-400">{Math.abs(days)} ago</span>;
  }
  const tone = status === 'expiring_soon' ? 'text-amber-300 font-medium' : 'text-gray-300';
  return <span className={tone}>{days}</span>;
}

function Sessions({ row }: { row: MembershipRow }) {
  if (row.sessions_total === null || row.sessions_total === undefined) {
    // Unlimited (no finite count) — only meaningful for non-sessions plans.
    return <span className="text-gray-500">∞</span>;
  }
  const total = row.sessions_total ?? 0;
  const remaining = row.sessions_remaining ?? Math.max(0, total - row.sessions_used);
  const used = total - remaining;
  const tone = remaining <= 0
    ? 'text-rose-400'
    : remaining <= total / 4
      ? 'text-amber-300'
      : 'text-white';
  return (
    <div
      className="text-right leading-tight tabular-nums"
      title={`${remaining} session${remaining === 1 ? '' : 's'} left, ${used} used (out of ${total})`}
    >
      <div>
        <span className={`font-semibold ${tone}`}>{remaining}</span>
        <span className="text-gray-500 font-normal text-xs ml-1">left</span>
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">
        {used} / {total} used
      </div>
    </div>
  );
}

function Avatar({ name, number, photoUrl }: { name: string | null; number: string | null; photoUrl: string | null }) {
  const fallback = useMemo(() => {
    const source = (name ?? number ?? '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [name, number]);

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={name ?? number ?? ''} className="w-9 h-9 rounded-full object-cover bg-gray-700 flex-shrink-0" />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-purple-400">{fallback}</span>
    </div>
  );
}

// ─── Summary tile ────────────────────────────────────────────────────────────
function SummaryTile({
  icon, label, value, tint, onClick,
}: {
  icon: React.ReactNode; label: string; value: number;
  tint: 'emerald' | 'amber' | 'rose';
  onClick?: () => void;
}) {
  const tints = {
    emerald: { bg: 'bg-emerald-400/10', text: 'text-emerald-400', border: 'border-emerald-400/20' },
    amber:   { bg: 'bg-amber-400/10',   text: 'text-amber-300',   border: 'border-amber-400/20' },
    rose:    { bg: 'bg-rose-400/10',    text: 'text-rose-400',    border: 'border-rose-400/20' },
  }[tint];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 bg-gray-800 border ${tints.border} rounded-xl hover:bg-gray-800/70 transition-colors text-left`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tints.bg} ${tints.text}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      </div>
    </button>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
      />
    </label>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function pageRange(current: number, totalPages: number): number[] {
  const len = Math.min(totalPages, 5);
  const start = Math.max(1, Math.min(current - 2, totalPages - len + 1));
  return Array.from({ length: len }, (_, i) => start + i);
}

function labelForStatus(s: DisplayStatus): string {
  return s === 'active' ? 'Active' : s === 'expiring_soon' ? 'Expiring soon' : 'Expired';
}

function escapeCsv(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
