'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Download, Eye, RefreshCw, BadgeCheck, AlertTriangle, Clock, Filter,
  Snowflake, CreditCard, TrendingUp,
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

// Matches the local formatter in payments-table.tsx. The gym's currency isn't
// exposed to client components yet (lib/time.ts has the same pattern for
// timezone), so EGP is the default the rest of the admin already assumes.
const fmtMoney = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

export type DisplayStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  /** freeze_status='frozen' — entitlement suspended, check-in blocked. */
  | 'frozen'
  /** Issued but never settled (payment_status != 'paid'). */
  | 'pending'
  /** Deliberately ended — distinct from a natural lapse. */
  | 'cancelled';
/** Derived server-side from the member's membership history — never stored. */
export type MembershipKind = 'new' | 'renew';

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
  final_price: string | number | null;
  frozen_until: string | null;
  /** Frozen past frozen_until — no auto-unfreeze job exists, so these need action. */
  freeze_overdue: boolean;
  /** null for 'transfer' rows — a transfer isn't a purchased membership. */
  membership_kind: MembershipKind | null;
  last_check_in_at: string | null;
}

interface PaginationMeta { page: number; limit: number; total: number; pages: number }
interface Summary {
  active: number;
  expiring_soon: number;
  expired: number;
  frozen: number;
  pending: number;
  cancelled: number;
  new: number;
  renew: number;
  expiring_revenue: number;
  pending_revenue: number;
}

const EMPTY_SUMMARY: Summary = {
  active: 0, expiring_soon: 0, expired: 0, frozen: 0, pending: 0,
  cancelled: 0, new: 0, renew: 0, expiring_revenue: 0, pending_revenue: 0,
};

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
  membershipKind: string;
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
  membershipKind: 'all',
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

// `new` is deliberately not `brand`: the TRANSFERRED tag beside it in the
// plan cell already uses brand, and two adjacent brand chips are
// indistinguishable at a glance.
const KIND_VARIANT: Record<MembershipKind, BadgeProps['variant']> = {
  new:   'success',
  renew: 'neutral',
};

const STATUS_VARIANT: Record<DisplayStatus, BadgeProps['variant']> = {
  active:        'success',
  expiring_soon: 'warning',
  expired:       'danger',
  frozen:        'brand',
  pending:       'warning',
  cancelled:     'neutral',
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
    { value: 'frozen',        label: t('statusFilter.frozen') },
    { value: 'pending',       label: t('statusFilter.pending') },
    { value: 'expired',       label: t('statusFilter.expired') },
    { value: 'cancelled',     label: t('statusFilter.cancelled') },
  ];

  const SOURCE_FILTERS = [
    { value: 'subscription', label: t('sourceFilter.subscription') },
    { value: 'all',          label: t('sourceFilter.all') },
    { value: 'transfer',     label: t('sourceFilter.transfer') },
  ];

  const KIND_FILTERS = [
    { value: 'all',   label: t('kindFilter.all') },
    { value: 'new',   label: t('kindFilter.new') },
    { value: 'renew', label: t('kindFilter.renew') },
  ];

  const KIND_LABEL: Record<MembershipKind, string> = {
    new:   t('kind.new'),
    renew: t('kind.renew'),
  };

  const STATUS_LABEL: Record<DisplayStatus, string> = {
    active:        t('displayStatus.active'),
    expiring_soon: t('displayStatus.expiringSoon'),
    expired:       t('displayStatus.expired'),
    frozen:        t('displayStatus.frozen'),
    pending:       t('displayStatus.pending'),
    cancelled:     t('displayStatus.cancelled'),
  };

  const [rows, setRows]               = useState<MembershipRow[]>([]);
  const [summary, setSummary]         = useState<Summary>(EMPTY_SUMMARY);
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
  const [membershipKind, setMembershipKind] = useState<string>(initial.current.membershipKind);
  const [startFrom, setStartFrom]         = useState<string>(initial.current.startFrom);
  const [startTo, setStartTo]             = useState<string>(initial.current.startTo);
  const [endFrom, setEndFrom]             = useState<string>(initial.current.endFrom);
  const [endTo, setEndTo]                 = useState<string>(initial.current.endTo);
  const [expiringDays, setExpiringDays]   = useState<number>(initial.current.expiringDays);
  // The input is a free-typed number; each keystroke would otherwise fire a
  // full request (three queries server-side). The input stays controlled by
  // `expiringDays` for responsiveness while the query keys off this mirror.
  const [debouncedExpiringDays, setDebouncedExpiringDays] = useState<number>(initial.current.expiringDays);
  const [showFilters, setShowFilters]     = useState(initial.current.showFilters);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedExpiringDays(expiringDays), 400);
    return () => clearTimeout(id);
  }, [expiringDays]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const snapshot: PersistedFilters = {
        search, status, planType, sourceType, membershipKind,
        startFrom, startTo, endFrom, endTo,
        expiringDays, showFilters,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {/* sessionStorage may be unavailable in private mode */}
  }, [search, status, planType, sourceType, membershipKind, startFrom, startTo, endFrom, endTo, expiringDays, showFilters]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Builds the query for the current filter set. Shared by the paged fetch
  // and the export so the two can never disagree about what's being shown.
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status !== 'all') params.set('status', status);
    if (planType !== 'all') params.set('plan_type', planType);
    if (sourceType !== 'all') params.set('source_type', sourceType);
    if (membershipKind !== 'all') params.set('membership_kind', membershipKind);
    if (startFrom) params.set('start_from', startFrom);
    if (startTo)   params.set('start_to',   startTo);
    if (endFrom)   params.set('end_from',   endFrom);
    if (endTo)     params.set('end_to',     endTo);
    if (debouncedExpiringDays !== DEFAULT_EXPIRING_DAYS) params.set('expiring_days', String(debouncedExpiringDays));
    return params;
  }, [debouncedSearch, status, planType, sourceType, membershipKind, startFrom, startTo, endFrom, endTo, debouncedExpiringDays]);

  const fetchRows = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    const params = buildParams();
    params.set('page', String(p));
    params.set('limit', String(PAGE_SIZE));

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
  }, [buildParams, tc]);

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
    setMembershipKind('all');
    setStartFrom(''); setStartTo(''); setEndFrom(''); setEndTo('');
    setExpiringDays(DEFAULT_EXPIRING_DAYS); setDebouncedExpiringDays(DEFAULT_EXPIRING_DAYS);
  };

  const hasFilters = !!debouncedSearch || status !== 'all' || planType !== 'all'
    || sourceType !== 'subscription' || membershipKind !== 'all'
    || !!startFrom || !!startTo || !!endFrom || !!endTo
    || expiringDays !== DEFAULT_EXPIRING_DAYS;

  const [exporting, setExporting] = useState(false);

  // Export covers the whole filtered result set, not just the visible page.
  // It previously serialized `rows` — so a 400-row filtered view exported 25
  // and reported "Exported 25" with no sign that 375 were dropped.
  // An explicit checkbox selection still wins and exports exactly that.
  const exportCsv = async () => {
    if (total === 0) { toast.error(t('toast.nothingToExport')); return; }

    let exportRows: MembershipRow[];
    if (selected.size > 0) {
      exportRows = rows.filter(r => selected.has(r.id));
    } else {
      setExporting(true);
      const toastId = toast.loading(t('toast.exporting'));
      try {
        // API caps limit at 200, so page through the filtered set.
        const params = buildParams();
        params.set('limit', '200');
        const collected: MembershipRow[] = [];
        let p = 1;
        let pages = 1;
        do {
          params.set('page', String(p));
          const res = await fetch(`/api/memberships?${params}`);
          const data: ApiResponse = await res.json();
          if (!res.ok) throw new Error(data.error ?? 'failed');
          collected.push(...(data.data ?? []));
          pages = data.pagination?.pages ?? 1;
          p += 1;
        } while (p <= pages);
        exportRows = collected;
        toast.dismiss(toastId);
      } catch {
        toast.dismiss(toastId);
        toast.error(t('toast.exportFailed'));
        return;
      } finally {
        setExporting(false);
      }
    }

    if (exportRows.length === 0) { toast.error(t('toast.nothingToExport')); return; }

    const headers = [
      t('csvHeaders.memberName'), t('csvHeaders.memberNumber'), t('csvHeaders.plan'), t('csvHeaders.planType'),
      t('csvHeaders.membershipKind'), t('csvHeaders.price'),
      t('csvHeaders.startDate'), t('csvHeaders.endDate'), t('csvHeaders.status'), t('csvHeaders.daysRemaining'),
      t('csvHeaders.sessionsRemaining'), t('csvHeaders.frozenUntil'), t('csvHeaders.lastCheckIn'),
    ];
    const lines = exportRows.map(r => [
      r.member_name ?? '',
      r.member_number ?? '',
      r.plan_name ?? '',
      r.plan_type ?? '',
      r.membership_kind ? KIND_LABEL[r.membership_kind] : '',
      r.final_price != null ? Number(r.final_price) : '',
      r.start_date ? fmtDate(r.start_date) : '',
      r.end_date ? fmtDate(r.end_date) : '',
      STATUS_LABEL[r.display_status],
      r.days_remaining ?? '',
      r.sessions_remaining ?? '',
      r.frozen_until ? fmtDate(r.frozen_until) : '',
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
          aria-label={t('selectAllRows')}
          className="rounded border-line bg-surface-3 accent-brand focus:ring-0 focus:ring-offset-0"
        />
      ),
      cell: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggleOne(r.id)}
          aria-label={t('selectRow', { name: r.member_name ?? r.member_number ?? '' })}
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
            {/* New / Renew reads as a tag on the row itself rather than
                occupying a column of its own. Transferred sessions have
                no kind, so nothing is shown for them. */}
            {r.membership_kind && (
              <Badge
                variant={KIND_VARIANT[r.membership_kind]}
                size="sm"
                className="uppercase tracking-wider flex-shrink-0"
                title={r.membership_kind === 'renew' ? t('kindHint.renew') : t('kindHint.new')}
              >
                {KIND_LABEL[r.membership_kind]}
              </Badge>
            )}
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
      key: 'price',
      header: t('col.price'),
      align: 'right',
      hideOnMobile: true,
      cell: (r) => (
        r.final_price != null && Number(r.final_price) > 0
          ? <span className="text-fg-muted tabular-nums whitespace-nowrap">{fmtMoney(Number(r.final_price))}</span>
          : <span className="text-fg-faint">—</span>
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
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge
            variant={STATUS_VARIANT[r.display_status]}
            title={r.display_status === 'frozen' && r.frozen_until
              ? t('frozenUntil', { date: fmtDate(r.frozen_until) })
              : undefined}
          >
            {STATUS_LABEL[r.display_status]}
          </Badge>
          {/* No auto-unfreeze job exists, so a lapsed freeze sits untouched
              until a human acts. Surface it rather than burying it in the
              Frozen count. */}
          {r.freeze_overdue && (
            <span
              className="text-[10px] text-warning font-medium whitespace-nowrap"
              title={r.frozen_until ? t('freezeOverdueHint', { date: fmtDate(r.frozen_until) }) : undefined}
            >
              {t('freezeOverdue')}
            </span>
          )}
        </div>
      ),
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
      cell: (r) => (
        <Sessions
          row={r}
          leftLabel={t('leftLabel')}
          usedLabel={(used: number, total: number) => t('usedLabel', { used, total })}
          tooltip={(remaining: number, used: number, total: number) => t('sessionsTooltip', { remaining, used, total })}
        />
      ),
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

      {/* ── Summary metrics ──
          Row 1 is volume by state; row 2 is the money and the retention KPI.
          Expiring shows the revenue at risk under its count, which is the
          number that actually drives renewal effort — a count of 40 expiring
          memberships means nothing without knowing whether it's 4k or 40k. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          sub={summary.expiring_revenue > 0 ? fmtMoney(summary.expiring_revenue) : undefined}
          tone="warning"
          onClick={() => setStatus('expiring_soon')}
        />
        <SummaryTile
          icon={<Snowflake className="w-5 h-5" />}
          label={t('frozenLabel')}
          value={summary.frozen}
          tone="brand"
          onClick={() => setStatus('frozen')}
        />
        <SummaryTile
          icon={<CreditCard className="w-5 h-5" />}
          label={t('pendingLabel')}
          value={summary.pending}
          sub={summary.pending_revenue > 0 ? fmtMoney(summary.pending_revenue) : undefined}
          tone="warning"
          onClick={() => setStatus('pending')}
        />
        <SummaryTile
          icon={<Clock className="w-5 h-5" />}
          label={t('expiredLabel')}
          value={summary.expired}
          tone="danger"
          onClick={() => setStatus('expired')}
        />
        <SummaryTile
          icon={<TrendingUp className="w-5 h-5" />}
          label={t('newRenewLabel')}
          value={`${summary.new} / ${summary.renew}`}
          sub={t('newRenewHint', { new: summary.new, renew: summary.renew })}
          tone="neutral"
          onClick={() => setMembershipKind(membershipKind === 'renew' ? 'all' : 'renew')}
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
        <FilterDropdown label={t('col.membershipKind')} value={membershipKind} onChange={setMembershipKind} options={KIND_FILTERS} />

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
          disabled={exporting}
          leftIcon={<Download className="w-3.5 h-3.5" />}
        >
          {selected.size > 0 ? t('exportSelected', { count: selected.size }) : t('export')}
        </Button>
      </div>

      {/* Date range filters (collapsible) */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-surface-2/40 border border-line rounded-xl">
          <Field label={t('startDateFrom')}>
            <Input type="date" value={startFrom} onChange={e => setStartFrom(e.target.value)} />
          </Field>
          <Field label={t('startDateTo')}>
            <Input type="date" value={startTo} onChange={e => setStartTo(e.target.value)} />
          </Field>
          <Field label={t('endDateFrom')}>
            <Input type="date" value={endFrom} onChange={e => setEndFrom(e.target.value)} />
          </Field>
          <Field label={t('endDateTo')}>
            <Input type="date" value={endTo} onChange={e => setEndTo(e.target.value)} />
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
          rowClassName={(r) =>
            r.display_status === 'expiring_soon' || r.freeze_overdue
              ? 'bg-warning/[0.06]'
              : undefined}
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
  // Frozen, cancelled and unpaid rows aren't counting down toward anything —
  // showing a countdown next to them implies an entitlement that isn't live.
  if (status === 'frozen' || status === 'cancelled' || status === 'pending') {
    return <span className="text-fg-faint">—</span>;
  }
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
  tooltip,
}: {
  row: MembershipRow;
  leftLabel: string;
  usedLabel: (used: number, total: number) => string;
  tooltip: (remaining: number, used: number, total: number) => string;
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
      title={tooltip(remaining, used, total)}
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
  icon, label, value, sub, tone, onClick,
}: {
  icon: React.ReactNode; label: string;
  /** number for counts; string for composite values like "3 / 7". */
  value: number | string;
  /** Secondary line — revenue under a count, or a KPI breakdown. */
  sub?: string;
  tone: 'success' | 'warning' | 'danger' | 'brand' | 'neutral';
  onClick?: () => void;
}) {
  const tones = {
    success: { bg: 'bg-success-soft', text: 'text-success', border: 'border-success/20' },
    warning: { bg: 'bg-warning-soft', text: 'text-warning', border: 'border-warning/20' },
    danger:  { bg: 'bg-danger-soft',  text: 'text-danger',  border: 'border-danger/20' },
    brand:   { bg: 'bg-brand/15',     text: 'text-brand',   border: 'border-brand/20' },
    neutral: { bg: 'bg-surface-3',    text: 'text-fg-muted', border: 'border-line' },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      title={sub}
      className={`flex items-center gap-3 p-4 bg-surface-2 border ${tones.border} rounded-xl hover:bg-surface-3 transition-colors text-start`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tones.bg} ${tones.text}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-fg-muted uppercase tracking-wide font-medium truncate">{label}</p>
        <p className="text-2xl font-bold text-fg tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-fg-faint tabular-nums truncate">{sub}</p>}
      </div>
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function escapeCsv(v: string | number): string {
  let s = String(v);
  // Neutralise spreadsheet formula injection. These exports are opened in
  // Excel/Sheets, where a cell starting with = + - @ (or tab/CR, which some
  // parsers strip back to those) is evaluated as a formula — a member name
  // like "=HYPERLINK(...)" would execute on open. Prefixing with a single
  // quote makes it literal text in both Excel and Sheets.
  // A leading "-" is only dangerous when it isn't just a negative number —
  // guarding it unconditionally turned every negative value (e.g. an expired
  // row's days-remaining) into text like '-12 in the spreadsheet.
  const isNumeric = /^-?\d+(\.\d+)?$/.test(s);
  if (!isNumeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
