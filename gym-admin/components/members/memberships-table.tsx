'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Download, Eye, RefreshCw, BadgeCheck, AlertTriangle, Clock, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { fmtDateGym as fmtDate } from '@/lib/time';
import {
  Avatar,
  Badge,
  type BadgeProps,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  FilterDropdown,
  Input,
  Pagination,
  SearchInput,
} from '@/components/ui';

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

interface PaginationMeta { page: number; limit: number; total: number; pages: number }
interface Summary { active: number; expiring_soon: number; expired: number }

interface ApiResponse {
  data?: MembershipRow[];
  pagination?: PaginationMeta;
  summary?: Summary;
  error?: string;
}

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

const STATUS_VARIANT: Record<DisplayStatus, BadgeProps['variant']> = {
  active:        'success',
  expiring_soon: 'warning',
  expired:       'danger',
};

export default function MembershipsTable() {
  const t = useTranslations('members.memberships');
  const tc = useTranslations('common');

  const PLAN_TYPES = [
    { value: 'all',              label: t('planType.all') },
    { value: 'sessions',         label: t('planType.sessions') },
    { value: 'duration',         label: t('planType.duration') },
    { value: 'duration_session', label: t('planType.durationSession') },
  ];

  const STATUS_FILTERS = [
    { value: 'all',           label: t('statusFilter.all') },
    { value: 'active',        label: t('statusFilter.active') },
    { value: 'expiring_soon', label: t('statusFilter.expiringSoon') },
    { value: 'expired',       label: t('statusFilter.expired') },
  ];

  const SOURCE_FILTERS = [
    { value: 'subscription', label: t('sourceFilter.subscription') },
    { value: 'all',          label: t('sourceFilter.all') },
    { value: 'transfer',     label: t('sourceFilter.transfer') },
  ];

  const STATUS_LABEL: Record<DisplayStatus, string> = {
    active:        t('displayStatus.active'),
    expiring_soon: t('displayStatus.expiringSoon'),
    expired:       t('displayStatus.expired'),
  };

  const [rows, setRows]               = useState<MembershipRow[]>([]);
  const [summary, setSummary]         = useState<Summary>({ active: 0, expiring_soon: 0, expired: 0 });
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

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

  const [selected, setSelected] = useState<Set<string>>(new Set());

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
        setError(data.error ?? tc('somethingWrong'));
        return;
      }
      setRows(data.data ?? []);
      if (data.pagination) {
        setPage(data.pagination.page);
        setTotal(data.pagination.total);
      }
      if (data.summary) setSummary(data.summary);
    } catch {
      setError(tc('networkError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, planType, sourceType, startFrom, startTo, endFrom, endTo, expiringDays, tc]);

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
    if (rows.length === 0) { toast.error(t('toast.nothingToExport')); return; }
    const exportRows = selected.size > 0 ? rows.filter(r => selected.has(r.id)) : rows;
    const headers = [
      t('csvHeaders.memberName'), t('csvHeaders.memberNumber'), t('csvHeaders.plan'), t('csvHeaders.planType'),
      t('csvHeaders.startDate'), t('csvHeaders.endDate'), t('csvHeaders.status'), t('csvHeaders.daysRemaining'),
      t('csvHeaders.sessionsRemaining'), t('csvHeaders.lastCheckIn'),
    ];
    const lines = exportRows.map(r => [
      r.member_name ?? '',
      r.member_number ?? '',
      r.plan_name ?? '',
      r.plan_type ?? '',
      r.start_date ? fmtDate(r.start_date) : '',
      r.end_date ? fmtDate(r.end_date) : '',
      STATUS_LABEL[r.display_status],
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
    const count = exportRows.length;
    toast.success(count === 1 ? t('toast.exported', { count }) : t('toast.exportedPlural', { count }));
  };

  const columns: DataTableColumn<MembershipRow>[] = [
    {
      key: 'select',
      width: 40,
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          aria-label="Select all rows"
          className="rounded border-line bg-surface-3 accent-brand focus:ring-0 focus:ring-offset-0"
        />
      ),
      cell: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggleOne(r.id)}
          aria-label={`Select ${r.member_name ?? r.member_number ?? 'row'}`}
          className="rounded border-line bg-surface-3 accent-brand focus:ring-0 focus:ring-offset-0"
        />
      ),
    },
    {
      key: 'member',
      header: t('col.member'),
      cell: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={r.member_name ?? r.member_number ?? '?'} src={r.member_photo_url} size={36} />
          <div className="min-w-0">
            <p className="text-fg font-medium truncate">{r.member_name ?? '—'}</p>
            <p className="text-xs text-fg-faint font-mono truncate">{r.member_number ? `#${r.member_number}` : '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: t('col.plan'),
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-fg truncate max-w-[200px]">{r.plan_name ?? '—'}</p>
            {r.source_type === 'transfer' && (
              <Badge variant="brand" size="sm" className="uppercase tracking-wider flex-shrink-0" title={t('transferred')}>
                {t('transferred')}
              </Badge>
            )}
          </div>
          {r.plan_type && (
            <p className="text-xs text-fg-faint capitalize">{r.plan_type.replace('_', ' + ')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'start',
      header: t('col.start'),
      hideOnMobile: true,
      cell: (r) => <span className="text-fg-muted whitespace-nowrap">{fmtDate(r.start_date)}</span>,
    },
    {
      key: 'end',
      header: t('col.end'),
      hideOnMobile: true,
      cell: (r) => <span className="text-fg-muted whitespace-nowrap">{r.end_date ? fmtDate(r.end_date) : '—'}</span>,
    },
    {
      key: 'status',
      header: t('col.status'),
      cell: (r) => <Badge variant={STATUS_VARIANT[r.display_status]}>{STATUS_LABEL[r.display_status]}</Badge>,
    },
    {
      key: 'days',
      header: t('col.daysLeft'),
      align: 'right',
      cell: (r) => <RemainingDays days={r.days_remaining} status={r.display_status} agoLabel={t('agoLabel', { days: r.days_remaining != null ? Math.abs(r.days_remaining) : 0 })} />,
    },
    {
      key: 'sessions',
      header: t('col.sessionsLeft'),
      align: 'right',
      cell: (r) => <Sessions row={r} leftLabel={t('leftLabel')} usedLabel={(used: number, total: number) => t('usedLabel', { used, total })} />,
    },
    {
      key: 'last_check_in',
      header: t('col.lastCheckIn'),
      hideOnMobile: true,
      cell: (r) => (
        r.last_check_in_at
          ? <span className="text-fg-muted whitespace-nowrap">{fmtDate(r.last_check_in_at)}</span>
          : <span className="text-fg-faint">{t('neverCheckedIn')}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <Link
          href={`/dashboard/members/${r.gym_member_id}`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-brand hover:text-fg hover:bg-surface-3 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" aria-hidden /> {t('col.view')}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            {total > 0 ? t('subtitleWithCount', { total }) : t('subtitleEmpty')}
          </p>
        </div>
      </div>

      {/* ── Summary metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryTile
          icon={<BadgeCheck className="w-5 h-5" />}
          label={t('activeLabel')}
          value={summary.active}
          tone="success"
          onClick={() => setStatus('active')}
        />
        <SummaryTile
          icon={<AlertTriangle className="w-5 h-5" />}
          label={expiringDays === 1 ? t('expiringLabel', { days: expiringDays }) : t('expiringLabelPlural', { days: expiringDays })}
          value={summary.expiring_soon}
          tone="warning"
          onClick={() => setStatus('expiring_soon')}
        />
        <SummaryTile
          icon={<Clock className="w-5 h-5" />}
          label={t('expiredLabel')}
          value={summary.expired}
          tone="danger"
          onClick={() => setStatus('expired')}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="flex-1 min-w-[200px] max-w-md"
          value={search}
          onValueChange={setSearch}
          onSearch={setDebouncedSearch}
          placeholder={t('searchPlaceholder')}
        />

        <FilterDropdown label={tc('status')} value={status} onChange={setStatus} options={STATUS_FILTERS} />
        <FilterDropdown label={tc('type')} value={planType} onChange={setPlanType} options={PLAN_TYPES} />
        <FilterDropdown label={tc('filter')} value={sourceType} onChange={setSourceType} options={SOURCE_FILTERS} />

        <Button
          variant={showFilters ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowFilters(v => !v)}
          leftIcon={<Filter className="w-3.5 h-3.5" />}
        >
          {t('dateFilters')}
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>{tc('clear')}</Button>
        )}

        <div className="flex-1" />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchRows(page)}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          {t('refresh')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportCsv}
          leftIcon={<Download className="w-3.5 h-3.5" />}
        >
          {selected.size > 0 ? t('exportSelected', { count: selected.size }) : t('export')}
        </Button>
      </div>

      {/* Date range filters (collapsible) */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-surface-2/40 border border-line rounded-xl">
          <Field label={t('startDateFrom')}>
            <Input type="date" value={startFrom} onChange={e => setStartFrom(e.target.value)} className="[color-scheme:dark]" />
          </Field>
          <Field label={t('startDateTo')}>
            <Input type="date" value={startTo} onChange={e => setStartTo(e.target.value)} className="[color-scheme:dark]" />
          </Field>
          <Field label={t('endDateFrom')}>
            <Input type="date" value={endFrom} onChange={e => setEndFrom(e.target.value)} className="[color-scheme:dark]" />
          </Field>
          <Field label={t('endDateTo')}>
            <Input type="date" value={endTo} onChange={e => setEndTo(e.target.value)} className="[color-scheme:dark]" />
          </Field>
          <div className="lg:col-span-4 flex items-center gap-3">
            <label className="text-xs text-fg-muted font-medium uppercase tracking-wide">{t('expiringThreshold')}</label>
            <Input
              type="number"
              min={1}
              max={90}
              value={expiringDays}
              onChange={e => setExpiringDays(Math.max(1, Math.min(90, Number(e.target.value) || DEFAULT_EXPIRING_DAYS)))}
              className="w-20"
            />
            <span className="text-xs text-fg-faint">{t('daysBeforeEndDate')}</span>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {error ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <p className="text-sm text-danger mb-3">{error}</p>
          <Button variant="primary" size="sm" onClick={() => fetchRows(page)}>{tc('tryAgain')}</Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          rowClassName={(r) => r.display_status === 'expiring_soon' ? 'bg-warning/[0.06]' : undefined}
          empty={
            <EmptyState
              icon={BadgeCheck}
              title={hasFilters ? t('noMembershipsFiltered') : t('noMembershipsYet')}
            />
          }
        />
      )}

      {/* Pagination */}
      <Pagination
        total={total}
        limit={PAGE_SIZE}
        offset={(page - 1) * PAGE_SIZE}
        onChange={(o) => fetchRows(Math.floor(o / PAGE_SIZE) + 1)}
        loading={loading}
        summary={
          <>
            {t('showingRange', {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
            {selected.size > 0 && <span className="ms-2 text-brand">{t('selected', { count: selected.size })}</span>}
          </>
        }
      />
    </div>
  );
}

// ─── Cells ───────────────────────────────────────────────────────────────────
function RemainingDays({ days, status, agoLabel }: { days: number | null; status: DisplayStatus; agoLabel: string }) {
  if (days === null) return <span className="text-fg-faint">—</span>;
  if (status === 'expired') {
    return <span className="text-danger">{agoLabel}</span>;
  }
  const tone = status === 'expiring_soon' ? 'text-warning font-medium' : 'text-fg-muted';
  return <span className={tone}>{days}</span>;
}

function Sessions({
  row,
  leftLabel,
  usedLabel,
}: {
  row: MembershipRow;
  leftLabel: string;
  usedLabel: (used: number, total: number) => string;
}) {
  if (row.sessions_total === null || row.sessions_total === undefined) {
    return <span className="text-fg-faint">∞</span>;
  }
  const total = row.sessions_total ?? 0;
  const remaining = row.sessions_remaining ?? Math.max(0, total - row.sessions_used);
  const used = total - remaining;
  const tone = remaining <= 0
    ? 'text-danger'
    : remaining <= total / 4
      ? 'text-warning'
      : 'text-fg';
  return (
    <div
      className="text-end leading-tight tabular-nums"
      title={`${remaining} sessions left, ${used} used (out of ${total})`}
    >
      <div>
        <span className={`font-semibold ${tone}`}>{remaining}</span>
        <span className="text-fg-faint font-normal text-xs ms-1">{leftLabel}</span>
      </div>
      <div className="text-[10px] text-fg-faint mt-0.5">
        {usedLabel(used, total)}
      </div>
    </div>
  );
}

// ─── Summary tile ────────────────────────────────────────────────────────────
function SummaryTile({
  icon, label, value, tone, onClick,
}: {
  icon: React.ReactNode; label: string; value: number;
  tone: 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const tones = {
    success: { bg: 'bg-success-soft', text: 'text-success', border: 'border-success/20' },
    warning: { bg: 'bg-warning-soft', text: 'text-warning', border: 'border-warning/20' },
    danger:  { bg: 'bg-danger-soft',  text: 'text-danger',  border: 'border-danger/20' },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 p-4 bg-surface-2 border ${tones.border} rounded-xl hover:bg-surface-3 transition-colors text-start`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones.bg} ${tones.text}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-fg-muted uppercase tracking-wide font-medium">{label}</p>
        <p className="text-2xl font-bold text-fg tabular-nums">{value}</p>
      </div>
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function escapeCsv(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
