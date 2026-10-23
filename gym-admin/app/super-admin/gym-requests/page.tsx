'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Search, RefreshCw, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Calendar } from 'lucide-react';
import { responseErrorMessage, networkErrorMessage } from '@/lib/api-error';
import { GYM_REQUESTS_CHANGED_EVENT } from '@/lib/gym-request-events';
import { RequestStatusBadge, type GymRequestStatus } from './status-badge';

interface GymRequestRow {
  id: string;
  reference: string;
  status: GymRequestStatus;
  gym_name: string;
  logo_url: string | null;
  city: string;
  country: string;
  phone: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  created_at: string;
  reviewed_at: string | null;
  last_provisioning_error: string | null;
  last_email_error: string | null;
}

type SortKey = 'created_at' | 'gym_name' | 'owner_name' | 'city' | 'status';
interface Filters {
  status: '' | GymRequestStatus;
  search: string;
  from: string;
  to: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  page: number;
}

const STORAGE_KEY = 'super-admin:gym-requests:filters';
const DEFAULT_FILTERS: Filters = { status: 'pending', search: '', from: '', to: '', sort: 'created_at', dir: 'desc', page: 1 };
const PER_PAGE = 25;

function loadFilters(): Filters {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : DEFAULT_FILTERS;
  } catch { return DEFAULT_FILTERS; }
}

export default function GymRequestsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [hydrated, setHydrated] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState<GymRequestRow[]>([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [counts, setCounts] = useState({ pending: 0, approved: 0, declined: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore filters from this session (sessionStorage convention).
  useEffect(() => {
    const f = loadFilters();
    setFilters(f);
    setSearchInput(f.search);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch {}
  }, [filters, hydrated]);

  // Debounce the search box.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      setFilters(f => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim(), page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, hydrated]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sort: filters.sort, dir: filters.dir, page: String(filters.page), per_page: String(PER_PAGE),
      });
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await fetch(`/api/super-admin/gym-requests?${params}`);
      if (!res.ok) { setError(`Couldn't load gym requests — ${await responseErrorMessage(res)}`); return; }
      const json = await res.json();
      setRows(json.data ?? []);
      setMeta(json.meta ?? { current_page: 1, last_page: 1, total: 0 });
      setCounts(json.counts ?? { pending: 0, approved: 0, declined: 0 });
    } catch { setError(networkErrorMessage()); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { if (hydrated) fetchRows(); }, [fetchRows, hydrated]);

  useEffect(() => {
    window.addEventListener(GYM_REQUESTS_CHANGED_EVENT, fetchRows);
    return () => window.removeEventListener(GYM_REQUESTS_CHANGED_EVENT, fetchRows);
  }, [fetchRows]);

  const update = (patch: Partial<Filters>) => setFilters(f => ({ ...f, page: 1, ...patch }));

  const toggleSort = (key: SortKey) => {
    setFilters(f => ({
      ...f, page: 1, sort: key,
      dir: f.sort === key ? (f.dir === 'asc' ? 'desc' : 'asc') : key === 'created_at' ? 'desc' : 'asc',
    }));
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  const total = counts.pending + counts.approved + counts.declined;
  const tabs: { key: Filters['status']; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'approved', label: 'Approved', count: counts.approved },
    { key: 'declined', label: 'Declined', count: counts.declined },
    { key: '', label: 'All', count: total },
  ];

  const SortHeader = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => {
    const active = filters.sort === k;
    const Icon = !active ? ArrowUpDown : filters.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`text-left text-xs text-fg-muted font-medium px-4 py-3 ${className}`}>
        <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-fg uppercase">
          {label} <Icon className={`w-3 h-3 ${active ? 'text-brand' : 'opacity-50'}`} aria-hidden />
        </button>
      </th>
    );
  };

  const hasFilters = filters.search || filters.from || filters.to;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Gym Requests</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Self-onboarding submissions from clbyapp.com · <span className="text-warning">{counts.pending} awaiting review</span>
          </p>
        </div>
        <button onClick={fetchRows} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-line hover:bg-surface-3 text-fg-muted text-sm rounded-lg transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden /> Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div role="tablist" aria-label="Request status" className="flex items-center gap-1 border-b border-line">
        {tabs.map(t => {
          const active = filters.status === t.key;
          return (
            <button key={t.label} role="tab" aria-selected={active} onClick={() => update({ status: t.key })}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg'}`}>
              {t.label} <span className="ms-1 text-xs text-fg-faint">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" aria-hidden />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search gym, owner, email, reference…"
            aria-label="Search gym requests"
            className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-line-strong rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Calendar className="w-4 h-4" aria-hidden />
          <label className="sr-only" htmlFor="gr-from">Submitted from</label>
          <input id="gr-from" type="date" value={filters.from} max={filters.to || undefined}
            onChange={e => update({ from: e.target.value })}
            className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand" />
          <span aria-hidden>–</span>
          <label className="sr-only" htmlFor="gr-to">Submitted to</label>
          <input id="gr-to" type="date" value={filters.to} min={filters.from || undefined}
            onChange={e => update({ to: e.target.value })}
            className="bg-surface-2 border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand" />
        </div>
        {hasFilters && (
          <button onClick={() => { setSearchInput(''); update({ search: '', from: '', to: '' }); }}
            className="text-xs text-fg-muted hover:text-fg underline">
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <div className="bg-danger-soft border border-danger/30 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="text-sm text-fg">{error}</p>
            <button onClick={fetchRows} className="mt-2 text-sm text-brand hover:underline">Try again</button>
          </div>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-brand animate-spin" aria-label="Loading" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <ClipboardList className="w-10 h-10 text-fg-faint mx-auto mb-3" aria-hidden />
          <p className="text-sm text-fg-muted">
            {hasFilters ? 'No requests match these filters' : filters.status === 'pending' ? 'No requests awaiting review' : 'No gym requests yet'}
          </p>
        </div>
      ) : (
        <div className={`bg-surface-2 border border-line rounded-xl overflow-hidden ${loading ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-4 py-3">REQUEST</th>
                  <SortHeader k="gym_name" label="Gym" />
                  <SortHeader k="owner_name" label="Owner" />
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-4 py-3">CONTACT</th>
                  <SortHeader k="city" label="Location" />
                  <SortHeader k="created_at" label="Submitted" />
                  <SortHeader k="status" label="Status" />
                  <th scope="col" className="text-right text-xs text-fg-muted font-medium px-4 py-3">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(r => (
                  <tr key={r.id} onClick={() => router.push(`/super-admin/gym-requests/${r.id}`)}
                    className="hover:bg-surface-3/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3.5 font-mono text-xs text-fg-muted whitespace-nowrap">{r.reference}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {r.logo_url
                          ? <img src={r.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover bg-surface-3 flex-shrink-0" />
                          : <div className="w-8 h-8 rounded-lg bg-surface-3 flex-shrink-0" aria-hidden />}
                        <span className="text-fg font-medium">{r.gym_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-fg">{r.owner_name}</p>
                      <p className="text-xs text-fg-faint">{r.owner_email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-fg-muted font-mono text-xs whitespace-nowrap">{r.owner_phone || r.phone}</td>
                    <td className="px-4 py-3.5 text-fg-muted">{r.city}, {r.country}</td>
                    <td className="px-4 py-3.5 text-fg-faint text-xs whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <RequestStatusBadge status={r.status} />
                        {(r.last_provisioning_error || r.last_email_error) && (
                          <AlertTriangle className="w-3.5 h-3.5 text-warning"
                            aria-label={r.last_provisioning_error ? 'Provisioning failed' : 'Email delivery failed'} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link href={`/super-admin/gym-requests/${r.id}`} onClick={e => e.stopPropagation()}
                        className="px-2.5 py-1 rounded-lg text-xs text-brand hover:bg-brand/10 transition-colors">
                        {r.status === 'pending' ? 'Review' : 'View'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta.last_page > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-line text-sm text-fg-muted">
              <span>
                {(meta.current_page - 1) * PER_PAGE + 1}–{Math.min(meta.current_page * PER_PAGE, meta.total)} of {meta.total}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={meta.current_page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                  aria-label="Previous page"
                  className="p-1.5 rounded-lg hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" aria-hidden />
                </button>
                <span className="px-2">Page {meta.current_page} of {meta.last_page}</span>
                <button disabled={meta.current_page >= meta.last_page} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                  aria-label="Next page"
                  className="p-1.5 rounded-lg hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
