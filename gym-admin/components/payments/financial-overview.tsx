'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, CalendarRange, Download, Eye, Info,
  ListOrdered, Pencil, Plus, Receipt, Repeat, Trash2, TrendingUp, Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocale, useTranslations } from 'next-intl';
import { getGymTimezone } from '@/lib/time';
import { can, type Permission } from '@/lib/get-permissions';
import { escapeCsv } from '@/lib/csv';
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  FilterDropdown,
  Input,
  Modal,
  Pagination,
  SearchInput,
  Tabs,
} from '@/components/ui';
import { apiErrorMessage } from '@/lib/api-error';
import {
  TYPE_FILTERS, scheduleLabel,
  type RecurringSchedule, type ScheduleDetail, type ScheduleStatus, type TypeFilter, type UpcomingItem,
} from '@/lib/recurring-expenses';
import ExpenseModal, { EXPENSE_CATEGORIES, expenseMethodLabel, statusVariant, type Expense, type ExpenseModalTarget } from './expense-modal';
import RecurringScheduleModal from './recurring-schedule-modal';

const PAGE_SIZE = 25;

interface Summary {
  from: string;
  to: string;
  is_current_month: boolean;
  currency: string;
  /** Other currencies collected in the period, left out of the totals. */
  excluded_currencies: string[];
  /** Expenses recorded in other currencies, likewise left out. */
  excluded_expense_currencies?: string[];
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  expense_count: number;
}

interface PaginationMeta { page: number; limit: number; total: number; pages: number }

interface ListResponse {
  data?: Expense[];
  pagination?: PaginationMeta;
  error?: string;
}

type SortKey = 'expense_date' | 'amount';
type Section = 'expenses' | 'schedules' | 'upcoming';
const UPCOMING_DAYS = 30;

// Filter state is persisted in sessionStorage (same convention as the
// memberships table) so a reload keeps the period being reviewed.
const STORAGE_KEY = 'financial-overview-filters-v1';

interface PersistedFilters {
  /** Applied range; empty strings = current calendar month (server default). */
  from: string;
  to: string;
  search: string;
  category: string;
  type: TypeFilter;
  sort: SortKey;
  dir: 'asc' | 'desc';
  section: Section;
}

const DEFAULT_FILTERS: PersistedFilters = {
  from: '', to: '', search: '', category: 'all', type: 'all', sort: 'expense_date', dir: 'desc', section: 'expenses',
};

function loadPersistedFilters(): PersistedFilters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

/** Today in the gym's timezone as Y-m-d. */
function gymToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getGymTimezone(), year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Format a Y-m-d business date. It has no time component, so it is
 *  rendered as-is (UTC) rather than shifted into any timezone. */
function fmtDay(ymd: string): string {
  if (!ymd) return '';
  return new Date(`${ymd.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export default function FinancialOverview({ permissions }: { permissions: Permission[] | null }) {
  const t = useTranslations('payments.financial');
  const tr = useTranslations('payments.financial.recurring');
  const tm = useTranslations('payments.method');
  const tc = useTranslations('common');
  const tErr = useTranslations('common.errors');
  const locale = useLocale();

  const canCreate = can(permissions, 'payments', 'create');
  const canEdit = can(permissions, 'payments', 'edit');
  const canDelete = can(permissions, 'payments', 'delete');

  const initial = useRef<PersistedFilters>(loadPersistedFilters());

  // Applied range drives every query. The draft inputs only take effect on
  // "Apply", so a half-typed range never fires a request.
  const [from, setFrom] = useState(initial.current.from);
  const [to, setTo] = useState(initial.current.to);
  const [draftFrom, setDraftFrom] = useState(initial.current.from);
  const [draftTo, setDraftTo] = useState(initial.current.to);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [search, setSearch] = useState(initial.current.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initial.current.search);
  const [category, setCategory] = useState(initial.current.category);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    TYPE_FILTERS.includes(initial.current.type) ? initial.current.type : 'all',
  );
  const [section, setSection] = useState<Section>(initial.current.section ?? 'expenses');
  const [sort, setSort] = useState<SortKey>(initial.current.sort);
  const [dir, setDir] = useState<'asc' | 'desc'>(initial.current.dir);

  const [rows, setRows] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [modal, setModal] = useState<ExpenseModalTarget | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Recurring: which schedule's details are open; edit/delete choice for an occurrence row.
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleReload, setScheduleReload] = useState(0);
  const [editChoice, setEditChoice] = useState<Expense | null>(null);
  const [deleteChoice, setDeleteChoice] = useState<Expense | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Expense | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<Expense | null>(null);
  const [choiceBusy, setChoiceBusy] = useState(false);

  // Recurring schedules + upcoming sections.
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<'all' | ScheduleStatus>('all');
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [upcoming, setUpcoming] = useState<{ data: UpcomingItem[]; totals: Record<string, number> } | null>(null);
  const [upcomingLoading, setUpcomingLoading] = useState(false);

  useEffect(() => {
    try {
      const snapshot: PersistedFilters = { from, to, search, category, type: typeFilter, sort, dir, section };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {/* sessionStorage may be unavailable in private mode */}
  }, [from, to, search, category, typeFilter, sort, dir, section]);

  const currency = summary?.currency ?? 'EGP';
  // Amounts carry their own currency where known (occurrences of a
  // schedule keep the currency it was created in); never assume the gym's.
  const fmtMoney = useCallback(
    (n: number, cur?: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n),
    [currency],
  );

  const methodLabel = (m: string | null) => expenseMethodLabel(tm, m);
  const categoryLabel = (c: string) => t(`categories.${c}` as any);

  const rangeParams = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p;
  }, [from, to]);

  // Only the latest request may write state: a slow response for an older
  // search / category / range must not overwrite a newer one.
  const rowsSeq = useRef(0);
  const summarySeq = useRef(0);

  const fetchSummary = useCallback(async () => {
    const seq = ++summarySeq.current;
    try {
      const res = await fetch(`/api/expenses/summary?${rangeParams()}`);
      const data = await res.json();
      if (seq !== summarySeq.current) return;
      if (res.ok) setSummary(data as Summary);
      else setError(data.error ?? tc('somethingWrong'));
    } catch {
      if (seq === summarySeq.current) setError(tc('networkError'));
    }
  }, [rangeParams, tc]);

  const fetchRows = useCallback(async (p = 1) => {
    const seq = ++rowsSeq.current;
    setLoading(true);
    setError(null);
    const params = rangeParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (category !== 'all') params.set('category', category);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    params.set('sort', sort);
    params.set('dir', dir);
    params.set('page', String(p));
    params.set('limit', String(PAGE_SIZE));
    try {
      const res = await fetch(`/api/expenses?${params}`);
      const data: ListResponse = await res.json();
      if (seq !== rowsSeq.current) return;
      if (!res.ok) { setError(data.error ?? tc('somethingWrong')); return; }
      setRows(data.data ?? []);
      if (data.pagination) { setPage(data.pagination.page); setTotal(data.pagination.total); }
    } catch {
      if (seq === rowsSeq.current) setError(tc('networkError'));
    } finally {
      if (seq === rowsSeq.current) setLoading(false);
    }
  }, [rangeParams, debouncedSearch, category, typeFilter, sort, dir, tc]);

  useEffect(() => { fetchRows(1); }, [fetchRows]);
  // Totals depend on the period only — not on page, sort or table filters.
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const fetchSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    try {
      const qs = scheduleStatus !== 'all' ? `?status=${scheduleStatus}` : '';
      const res = await fetch(`/api/expenses/recurring${qs}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setSchedules(json.data ?? []);
      else toast.error(apiErrorMessage(json, res.status, tErr));
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setSchedulesLoading(false);
    }
  }, [scheduleStatus, tErr, tc]);

  const fetchUpcoming = useCallback(async () => {
    setUpcomingLoading(true);
    try {
      const res = await fetch(`/api/expenses/upcoming?days=${UPCOMING_DAYS}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setUpcoming({ data: json.data ?? [], totals: json.totals ?? {} });
      else toast.error(apiErrorMessage(json, res.status, tErr));
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setUpcomingLoading(false);
    }
  }, [tErr, tc]);

  useEffect(() => { if (section === 'schedules') fetchSchedules(); }, [section, fetchSchedules]);
  useEffect(() => { fetchUpcoming(); }, [fetchUpcoming]);

  /** After any write: refresh every view that could have changed. */
  const refreshAll = useCallback(() => {
    fetchRows(page);
    fetchSummary();
    fetchUpcoming();
    if (section === 'schedules') fetchSchedules();
  }, [fetchRows, page, fetchSummary, fetchUpcoming, section, fetchSchedules]);

  const applyRange = () => {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setRangeError(t('filters.invalidRange'));
      return;
    }
    setRangeError(null);
    setFrom(draftFrom);
    setTo(draftTo);
  };

  const resetRange = () => {
    setRangeError(null);
    setDraftFrom(''); setDraftTo('');
    setFrom(''); setTo('');
  };

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setDir('desc'); }
  };

  // ── Export ── Rows come from the backend's unpaginated export endpoint
  // for the whole reporting period. Search / category are deliberately not
  // applied: the file pairs the expense list with the period's totals, and
  // the rows should add up to "Total expenses" in the same file.
  const exportCsv = async () => {
    setExporting(true);
    const toastId = toast.loading(t('exporting'));
    try {
      const res = await fetch(`/api/expenses/export?${rangeParams()}`);
      const data: { data?: Expense[]; summary?: Summary; error?: string } = await res.json();
      if (!res.ok || !data.summary) throw new Error(data.error ?? 'failed');
      const s = data.summary;
      const list = data.data ?? [];
      const h = (k: string) => t(`csv.${k}` as any);

      const lines: (string | number)[][] = [
        [h('summaryHeader')],
        [h('period'), `${s.from} – ${s.to}`],
        [h('currency'), s.currency],
        [h('totalRevenue'), s.total_revenue.toFixed(2)],
        [h('totalExpenses'), s.total_expenses.toFixed(2)],
        [h('netProfit'), s.net_profit.toFixed(2)],
        [h('netNote')],
        [],
        [h('expensesHeader')],
        // Existing columns unchanged; Type appended last.
        [h('id'), h('title'), h('category'), h('amount'), h('date'), h('method'), h('vendor'), h('description'), h('created'), h('updated'), h('type')],
        ...list.map(e => [
          e.id, e.title, categoryLabel(e.category), Number(e.amount).toFixed(2), e.expense_date.slice(0, 10),
          methodLabel(e.payment_method), e.vendor ?? '', e.description ?? '',
          isoish(e.created_at), isoish(e.updated_at), typeLabel(e),
        ]),
      ];
      const csv = lines.map(r => r.map(escapeCsv).join(',')).join('\n');
      // BOM so Excel opens UTF-8 (Arabic titles) correctly.
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-overview_${s.from}_${s.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('exported', { count: list.length }), { id: toastId });
    } catch {
      toast.error(t('exportFailed'), { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? t('toast.deleteFailed'));
        return;
      }
      toast.success(t('toast.deleted'));
      setToDelete(null);
      // Step back a page if that was the last row on it.
      fetchRows(rows.length === 1 && page > 1 ? page - 1 : page);
      fetchSummary();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setDeleting(false);
    }
  };

  /** Cancel one recorded occurrence (kept in history, excluded from totals). */
  const cancelOccurrence = async (e: Expense) => {
    setChoiceBusy(true);
    try {
      const res = await fetch(`/api/expenses/${e.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      toast.success(tr('toast.cancelled'));
      setConfirmCancel(null);
      fetchRows(rows.length === 1 && page > 1 ? page - 1 : page);
      fetchSummary();
      fetchUpcoming();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setChoiceBusy(false);
    }
  };

  const endSchedule = async (e: Expense) => {
    if (!e.recurring_expense_id) return;
    setChoiceBusy(true);
    try {
      const res = await fetch(`/api/expenses/recurring/${e.recurring_expense_id}/end`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      toast.success(tr('toast.ended'));
      setConfirmEnd(null);
      refreshAll();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setChoiceBusy(false);
    }
  };

  /** "This and future": load the schedule, then open the schedule form from the right date. */
  const editFuture = async (e: Expense) => {
    if (!e.recurring_expense_id) return;
    setChoiceBusy(true);
    try {
      const res = await fetch(`/api/expenses/recurring/${e.recurring_expense_id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      const s = json as ScheduleDetail;
      setEditChoice(null);
      // Recorded history is never rewritten, so changes apply from the
      // next not-yet-recorded date (or today), not from a past occurrence.
      const from = s.next_occurrence && s.next_occurrence > today ? s.next_occurrence : today;
      setModal({ mode: 'editSchedule', schedule: s, from });
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setChoiceBusy(false);
    }
  };

  const typeLabel = (e: Expense) => e.recurring
    ? tr('typeLabel', { frequency: t(`frequency.${e.recurring.frequency}` as any) })
    : t('kind.oneOff');

  const today = useMemo(gymToday, []);
  const isCustom = summary ? !summary.is_current_month : !!(from || to);
  const hasTableFilters = !!debouncedSearch || category !== 'all' || typeFilter !== 'all';

  const sortHeader = (key: SortKey, label: string) => {
    const Icon = sort !== key ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 hover:text-fg transition-colors ${sort === key ? 'text-fg' : ''}`}
        aria-label={t('sortBy', { column: label })}
      >
        {label}
        <Icon className="w-3 h-3" aria-hidden />
      </button>
    );
  };

  const columns: DataTableColumn<Expense>[] = [
    {
      key: 'title',
      header: t('col.title'),
      cell: (e) => <p className="text-fg font-medium truncate max-w-[260px]" title={e.title}>{e.title}</p>,
    },
    {
      key: 'category',
      header: t('col.category'),
      cell: (e) => <Badge variant="neutral" size="sm">{categoryLabel(e.category)}</Badge>,
    },
    {
      key: 'type',
      header: t('col.type'),
      cell: (e) => e.recurring
        ? <span className="inline-flex items-center gap-1 text-fg-muted whitespace-nowrap"><Repeat className="w-3.5 h-3.5" aria-hidden />{typeLabel(e)}</span>
        : <span className="text-fg-muted whitespace-nowrap">{typeLabel(e)}</span>,
    },
    {
      key: 'amount',
      header: sortHeader('amount', t('col.amount')),
      align: 'right',
      cell: (e) => <span className="text-fg tabular-nums whitespace-nowrap">{fmtMoney(Number(e.amount), e.currency)}</span>,
    },
    {
      key: 'date',
      header: sortHeader('expense_date', t('col.dateSchedule')),
      cell: (e) => (
        <div className="min-w-0">
          <span className="text-fg-muted whitespace-nowrap">{fmtDay(e.expense_date)}</span>
          {e.recurring && (
            <p className="text-[11px] text-fg-faint whitespace-nowrap" title={scheduleLabel(e.recurring, tr as any, locale)}>
              {e.recurring.next_occurrence ? tr('next', { date: fmtDay(e.recurring.next_occurrence) }) : tr('noNext')}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('col.status'),
      hideOnMobile: true,
      cell: (e) => e.recurring
        ? <Badge size="sm" variant={statusVariant(e.recurring.status)}>{t(`scheduleStatus.${e.recurring.status}` as any)}</Badge>
        : <Badge size="sm" variant="neutral">{t('occurrenceStatus.recorded')}</Badge>,
    },
    {
      key: 'vendor',
      header: t('col.vendor'),
      hideOnMobile: true,
      cell: (e) => e.vendor
        ? <span className="text-fg-muted truncate block max-w-[200px]" title={e.vendor}>{e.vendor}</span>
        : <span className="text-fg-faint">—</span>,
    },
    {
      key: 'method',
      header: t('col.method'),
      hideOnMobile: true,
      cell: (e) => e.payment_method
        ? <span className="text-fg-muted whitespace-nowrap">{methodLabel(e.payment_method)}</span>
        : <span className="text-fg-faint">—</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">{t('col.actions')}</span>,
      align: 'right',
      cell: (e) => (
        // Row click opens the details view; keep the buttons from also
        // triggering it.
        <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
          <IconAction label={tc('view')} onClick={() => setModal({ mode: 'view', expense: e })}><Eye className="w-3.5 h-3.5" /></IconAction>
          {canEdit && (
            <IconAction label={tc('edit')} onClick={() => (e.recurring ? setEditChoice(e) : setModal({ mode: 'edit', expense: e }))}><Pencil className="w-3.5 h-3.5" /></IconAction>
          )}
          {canDelete && (
            <IconAction label={tc('delete')} danger onClick={() => (e.recurring ? setDeleteChoice(e) : setToDelete(e))}><Trash2 className="w-3.5 h-3.5" /></IconAction>
          )}
        </div>
      ),
    },
  ];

  const net = summary?.net_profit ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
          <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={exporting || !summary} leftIcon={<Download className="w-4 h-4" />}>
            {t('export')}
          </Button>
          {canCreate && (
            <Button variant="primary" onClick={() => setModal({ mode: 'create' })} leftIcon={<Plus className="w-4 h-4" />}>
              {t('addExpense')}
            </Button>
          )}
        </div>
      </div>

      {/* Reporting period + date filters */}
      <div className="p-4 bg-surface-2 border border-line rounded-xl space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CalendarRange className="w-4 h-4 text-fg-muted" aria-hidden />
          <span className="text-fg">
            {summary ? t('period', { from: fmtDay(summary.from), to: fmtDay(summary.to) }) : '…'}
          </span>
          <Badge variant={isCustom ? 'brand' : 'neutral'} size="sm">
            {isCustom ? t('customRange') : t('thisMonth')}
          </Badge>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); applyRange(); }}
          noValidate
        >
          <Field label={t('filters.startDate')} className="w-full sm:w-44">
            <Input type="date" value={draftFrom} max={draftTo || undefined} onChange={e => { setDraftFrom(e.target.value); setRangeError(null); }} />
          </Field>
          <Field label={t('filters.endDate')} className="w-full sm:w-44">
            <Input type="date" value={draftTo} min={draftFrom || undefined} onChange={e => { setDraftTo(e.target.value); setRangeError(null); }} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="md">{t('filters.apply')}</Button>
            <Button type="button" variant="ghost" size="md" onClick={resetRange} disabled={!from && !to && !draftFrom && !draftTo}>
              {t('filters.reset')}
            </Button>
          </div>
        </form>
        {rangeError && <p role="alert" className="text-sm text-danger">{rangeError}</p>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          tone="success"
          label={isCustom ? t('cards.revenueRange') : t('cards.revenueMonth')}
          value={summary ? fmtMoney(summary.total_revenue) : '—'}
          hint={t('cards.revenueHint')}
        />
        <SummaryCard
          icon={<Receipt className="w-5 h-5" />}
          tone="warning"
          label={isCustom ? t('cards.expensesRange') : t('cards.expensesMonth')}
          value={summary ? fmtMoney(summary.total_expenses) : '—'}
          hint={t('cards.expensesHint', { count: summary?.expense_count ?? 0 })}
        />
        <SummaryCard
          icon={<Wallet className="w-5 h-5" />}
          tone={net < 0 ? 'danger' : 'brand'}
          label={isCustom ? t('cards.netRange') : t('cards.netMonth')}
          value={summary ? fmtMoney(net) : '—'}
          valueClass={net < 0 ? 'text-danger' : undefined}
          hint={t('cards.netHint')}
          info={t('cards.netDisclaimer')}
        />
      </div>
      {summary && summary.excluded_currencies.length > 0 && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-warning">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden />
          {t('cards.excludedCurrencies', { currency: summary.currency, others: summary.excluded_currencies.join(', ') })}
        </p>
      )}
      {summary && (summary.excluded_expense_currencies?.length ?? 0) > 0 && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-warning">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden />
          {t('cards.excludedExpenseCurrencies', { currency: summary.currency, others: summary.excluded_expense_currencies!.join(', ') })}
        </p>
      )}

      <UpcomingStrip
        items={upcoming?.data ?? []}
        totals={upcoming?.totals ?? {}}
        loading={upcomingLoading && !upcoming}
        fmtMoney={fmtMoney}
        fmtDay={fmtDay}
        onOpen={(id) => setScheduleId(id)}
        onSeeAll={() => setSection('upcoming')}
      />

      <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
        <Tabs.List>
          <Tabs.Trigger value="expenses" icon={Receipt}>{t('tabs.expenses')}</Tabs.Trigger>
          <Tabs.Trigger value="schedules" icon={Repeat}>{t('tabs.schedules')}</Tabs.Trigger>
          <Tabs.Trigger value="upcoming" icon={CalendarClock}>{t('tabs.upcoming')}</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {section === 'schedules' && (
        <SchedulesSection
          schedules={schedules}
          loading={schedulesLoading}
          status={scheduleStatus}
          onStatus={setScheduleStatus}
          canCreate={canCreate}
          onCreate={() => setModal({ mode: 'create' })}
          onOpen={(id) => setScheduleId(id)}
          fmtMoney={fmtMoney}
          fmtDay={fmtDay}
        />
      )}

      {section === 'upcoming' && (
        <UpcomingSection
          items={upcoming?.data ?? []}
          totals={upcoming?.totals ?? {}}
          loading={upcomingLoading}
          fmtMoney={fmtMoney}
          fmtDay={fmtDay}
          onOpen={(id) => setScheduleId(id)}
        />
      )}

      {/* Expenses table */}
      <div className={section === 'expenses' ? 'space-y-3' : 'hidden'}>
        <h2 className="text-lg font-semibold text-fg">{t('expensesTitle')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            className="flex-1 min-w-[200px] max-w-md"
            value={search}
            onValueChange={setSearch}
            onSearch={setDebouncedSearch}
            placeholder={t('filters.searchPlaceholder')}
          />
          <FilterDropdown
            label={t('filters.category')}
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: t('filters.allCategories') },
              ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: categoryLabel(c) })),
            ]}
          />
          <FilterDropdown
            label={t('filters.type')}
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
            icon={ListOrdered}
            options={[
              { value: 'all', label: t('filters.allTypes') },
              { value: 'one_off', label: t('filters.oneOff') },
              { value: 'recurring', label: t('filters.recurring') },
              { value: 'active', label: t('filters.active') },
              { value: 'paused', label: t('filters.paused') },
              { value: 'ended', label: t('filters.ended') },
            ]}
          />
          {hasTableFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDebouncedSearch(''); setCategory('all'); setTypeFilter('all'); }}>
              {tc('clear')}
            </Button>
          )}
        </div>

        {error ? (
          <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
            <p className="text-sm text-danger mb-3">{error}</p>
            <Button variant="primary" size="sm" onClick={() => { fetchRows(page); fetchSummary(); }}>{tc('tryAgain')}</Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            loading={loading}
            onRowClick={(e) => setModal({ mode: 'view', expense: e })}
            empty={
              <EmptyState
                icon={Receipt}
                title={hasTableFilters ? t('emptyFiltered') : t('empty')}
                description={hasTableFilters ? undefined : t('emptyHint')}
                action={!hasTableFilters && canCreate
                  ? <Button onClick={() => setModal({ mode: 'create' })} leftIcon={<Plus className="w-4 h-4" />}>{t('addExpense')}</Button>
                  : undefined}
              />
            }
          />
        )}

        <Pagination
          total={total}
          limit={PAGE_SIZE}
          offset={(page - 1) * PAGE_SIZE}
          onChange={(o) => fetchRows(Math.floor(o / PAGE_SIZE) + 1)}
          loading={loading}
          summary={t('showingRange', {
            from: (page - 1) * PAGE_SIZE + 1,
            to: Math.min(page * PAGE_SIZE, total),
            total,
          })}
        />
      </div>

      <ExpenseModal
        target={modal}
        today={today}
        canEdit={canEdit}
        fmtMoney={fmtMoney}
        fmtDay={fmtDay}
        onClose={() => setModal(null)}
        onTargetChange={(next) => (next.mode === 'edit' && next.expense.recurring ? (setModal(null), setEditChoice(next.expense)) : setModal(next))}
        onOpenSchedule={(id) => { setModal(null); setScheduleId(id); }}
        onSaved={() => { setModal(null); refreshAll(); setScheduleReload(k => k + 1); }}
      />

      <RecurringScheduleModal
        scheduleId={modal ? null : scheduleId}
        reloadKey={scheduleReload}
        today={today}
        canEdit={canEdit}
        canDelete={canDelete}
        fmtMoney={fmtMoney}
        fmtDay={fmtDay}
        onClose={() => setScheduleId(null)}
        onOpenSchedule={setScheduleId}
        onEditSchedule={(s, fromDate) => setModal({ mode: 'editSchedule', schedule: s, from: fromDate })}
        onEditUpcoming={(s, date) => setModal({ mode: 'editUpcoming', schedule: s, date })}
        onChanged={refreshAll}
      />

      {/* Recurring row → which edit? */}
      <Modal open={editChoice !== null} onClose={() => !choiceBusy && setEditChoice(null)} size="sm">
        <Modal.Header>{tr('editChoice.title')}</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-fg-muted mb-3">{tr('editChoice.body')}</p>
          <div className="space-y-2">
            <ChoiceButton
              title={tr('editChoice.this')}
              hint={tr('editChoice.thisHint')}
              onClick={() => { const e = editChoice!; setEditChoice(null); setModal({ mode: 'edit', expense: e }); }}
            />
            <ChoiceButton
              title={tr('editChoice.future')}
              hint={tr('editChoice.futureHint')}
              disabled={choiceBusy || editChoice?.recurring?.status === 'ended'}
              onClick={() => editFuture(editChoice!)}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setEditChoice(null)} disabled={choiceBusy}>{tc('cancel')}</Button>
        </Modal.Footer>
      </Modal>

      {/* Recurring row → cancel this one, or end the schedule? */}
      <Modal open={deleteChoice !== null} onClose={() => setDeleteChoice(null)} size="sm">
        <Modal.Header>{tr('deleteChoice.title')}</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-fg-muted mb-3">
            {deleteChoice && tr('deleteChoice.body', { title: deleteChoice.title, amount: fmtMoney(Number(deleteChoice.amount), deleteChoice.currency) })}
          </p>
          <div className="space-y-2">
            <ChoiceButton
              title={tr('deleteChoice.this')}
              hint={tr('deleteChoice.thisHint')}
              onClick={() => { setConfirmCancel(deleteChoice); setDeleteChoice(null); }}
            />
            <ChoiceButton
              title={tr('deleteChoice.end')}
              hint={tr('deleteChoice.endHint')}
              danger
              disabled={deleteChoice?.recurring?.status === 'ended'}
              onClick={() => { setConfirmEnd(deleteChoice); setDeleteChoice(null); }}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setDeleteChoice(null)}>{tc('cancel')}</Button>
        </Modal.Footer>
      </Modal>

      <Modal open={confirmCancel !== null} onClose={() => !choiceBusy && setConfirmCancel(null)} size="sm" closeOnBackdrop={false}>
        <Modal.Header>{tr('confirm.cancelTitle')}</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-fg-muted">
            {confirmCancel && tr('confirm.cancelBody', {
              title: confirmCancel.title, date: fmtDay(confirmCancel.expense_date),
              amount: fmtMoney(Number(confirmCancel.amount), confirmCancel.currency),
            })}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setConfirmCancel(null)} disabled={choiceBusy}>{tc('cancel')}</Button>
          <Button variant="danger" fullWidth isLoading={choiceBusy} onClick={() => cancelOccurrence(confirmCancel!)}>{tr('confirm.cancelConfirm')}</Button>
        </Modal.Footer>
      </Modal>

      <Modal open={confirmEnd !== null} onClose={() => !choiceBusy && setConfirmEnd(null)} size="sm" closeOnBackdrop={false}>
        <Modal.Header>{tr('confirm.endTitle')}</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-fg-muted">{confirmEnd && tr('confirm.endBody', { title: confirmEnd.title })}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setConfirmEnd(null)} disabled={choiceBusy}>{tc('cancel')}</Button>
          <Button variant="danger" fullWidth isLoading={choiceBusy} onClick={() => endSchedule(confirmEnd!)}>{tr('confirm.endConfirm')}</Button>
        </Modal.Footer>
      </Modal>

      <Modal open={toDelete !== null} onClose={() => !deleting && setToDelete(null)} size="sm" closeOnBackdrop={false}>
        <Modal.Header>{t('delete.title')}</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-fg-muted">
            {toDelete && t('delete.body', { title: toDelete.title, amount: fmtMoney(Number(toDelete.amount)) })}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setToDelete(null)} disabled={deleting}>{tc('cancel')}</Button>
          <Button variant="danger" fullWidth onClick={confirmDelete} isLoading={deleting}>{t('delete.confirm')}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────
function ChoiceButton({
  title, hint, onClick, danger, disabled,
}: { title: string; hint: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-start rounded-xl border border-line bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <span className={`block text-sm font-medium ${danger ? 'text-danger' : 'text-fg'}`}>{title}</span>
      <span className="block text-xs text-fg-muted">{hint}</span>
    </button>
  );
}

type Money = (n: number, currency?: string) => string;

/** Compact "coming up" list under the KPI cards. Never part of the totals. */
function UpcomingStrip({
  items, totals, loading, fmtMoney, fmtDay, onOpen, onSeeAll,
}: {
  items: UpcomingItem[]; totals: Record<string, number>; loading: boolean;
  fmtMoney: Money; fmtDay: (d: string) => string; onOpen: (id: string) => void; onSeeAll: () => void;
}) {
  const t = useTranslations('payments.financial');
  const tr = useTranslations('payments.financial.recurring');
  if (loading || items.length === 0) return null;
  const shown = items.slice(0, 4);
  return (
    <div className="p-4 bg-surface-2 border border-line rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-fg">
          <CalendarClock className="w-4 h-4 text-fg-muted" aria-hidden />
          {t('tabs.upcoming')} · <span className="font-normal text-fg-muted">{tr('upcomingWindow', { days: UPCOMING_DAYS })}</span>
        </p>
        <span className="text-xs text-fg-muted">
          {tr('upcomingTotal', { total: Object.entries(totals).map(([c, v]) => fmtMoney(v, c)).join(' + ') })}
        </span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {shown.map(i => (
          <li key={`${i.recurring_expense_id}-${i.scheduled_date}`}>
            <button
              type="button"
              onClick={() => onOpen(i.recurring_expense_id)}
              className="w-full text-start rounded-lg border border-line bg-surface px-3 py-2 hover:bg-surface-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="block text-sm text-fg truncate" title={i.title}>{i.title}</span>
              <span className="flex items-center justify-between gap-2 text-xs text-fg-muted">
                <span className="whitespace-nowrap">{fmtDay(i.scheduled_date)}</span>
                <span className="tabular-nums whitespace-nowrap">{fmtMoney(i.amount, i.currency)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
        <p className="text-[11px] text-fg-faint">{tr('upcomingNotCounted')}</p>
        {items.length > shown.length && (
          <Button variant="ghost" size="sm" onClick={onSeeAll}>{t('tabs.upcoming')} ({items.length})</Button>
        )}
      </div>
    </div>
  );
}

function UpcomingSection({
  items, totals, loading, fmtMoney, fmtDay, onOpen,
}: {
  items: UpcomingItem[]; totals: Record<string, number>; loading: boolean;
  fmtMoney: Money; fmtDay: (d: string) => string; onOpen: (id: string) => void;
}) {
  const t = useTranslations('payments.financial');
  const tr = useTranslations('payments.financial.recurring');
  const columns: DataTableColumn<UpcomingItem>[] = [
    { key: 'title', header: t('col.title'), cell: (i) => (
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className="text-fg font-medium truncate max-w-[240px]" title={i.title}>{i.title}</span>
        {i.modified && <Badge size="sm" variant="warning">{tr('edited')}</Badge>}
      </span>
    ) },
    { key: 'amount', header: t('col.amount'), align: 'right', cell: (i) => <span className="text-fg tabular-nums whitespace-nowrap">{fmtMoney(i.amount, i.currency)}</span> },
    { key: 'currency', header: tr('currency'), hideOnMobile: true, cell: (i) => <span className="text-fg-muted">{i.currency}</span> },
    { key: 'date', header: tr('historyCol.scheduled'), cell: (i) => <span className="text-fg-muted whitespace-nowrap">{fmtDay(i.scheduled_date)}</span> },
    { key: 'frequency', header: tr('frequency'), cell: (i) => <span className="text-fg-muted whitespace-nowrap">{t(`frequency.${i.frequency}` as any)}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-fg">{t('tabs.upcoming')} <span className="text-sm font-normal text-fg-muted">· {tr('upcomingWindow', { days: UPCOMING_DAYS })}</span></h2>
        {Object.keys(totals).length > 0 && (
          <span className="text-sm text-fg-muted">{tr('upcomingTotal', { total: Object.entries(totals).map(([c, v]) => fmtMoney(v, c)).join(' + ') })}</span>
        )}
      </div>
      <p className="text-xs text-fg-faint">{tr('upcomingNotCounted')}</p>
      <DataTable
        columns={columns}
        rows={items}
        rowKey={(i) => `${i.recurring_expense_id}-${i.scheduled_date}`}
        loading={loading}
        onRowClick={(i) => onOpen(i.recurring_expense_id)}
        empty={<EmptyState icon={CalendarClock} title={tr('upcomingEmpty')} />}
      />
    </div>
  );
}

function SchedulesSection({
  schedules, loading, status, onStatus, canCreate, onCreate, onOpen, fmtMoney, fmtDay,
}: {
  schedules: RecurringSchedule[]; loading: boolean;
  status: 'all' | ScheduleStatus; onStatus: (s: 'all' | ScheduleStatus) => void;
  canCreate: boolean; onCreate: () => void; onOpen: (id: string) => void;
  fmtMoney: Money; fmtDay: (d: string) => string;
}) {
  const t = useTranslations('payments.financial');
  const tr = useTranslations('payments.financial.recurring');
  const locale = useLocale();
  const columns: DataTableColumn<RecurringSchedule>[] = [
    { key: 'title', header: t('col.title'), cell: (s) => (
      <div className="min-w-0">
        <p className="text-fg font-medium truncate max-w-[240px]" title={s.title}>{s.title}</p>
        <p className="text-[11px] text-fg-faint">{t(`categories.${s.category}` as any)}</p>
      </div>
    ) },
    { key: 'amount', header: t('col.amount'), align: 'right', cell: (s) => <span className="text-fg tabular-nums whitespace-nowrap">{fmtMoney(s.amount, s.currency)}</span> },
    { key: 'schedule', header: tr('scheduleSection'), cell: (s) => (
      <div className="min-w-0">
        <p className="text-fg-muted">{scheduleLabel(s, tr as any, locale)}</p>
        <p className="text-[11px] text-fg-faint whitespace-nowrap">
          {fmtDay(s.start_date)} – {s.end_date ? fmtDay(s.end_date) : tr('ongoing')}
        </p>
      </div>
    ) },
    { key: 'next', header: tr('nextOccurrence'), cell: (s) => <span className="text-fg-muted whitespace-nowrap">{s.next_occurrence ? fmtDay(s.next_occurrence) : '—'}</span> },
    { key: 'status', header: t('col.status'), cell: (s) => <Badge size="sm" variant={statusVariant(s.status)}>{t(`scheduleStatus.${s.status}` as any)}</Badge> },
    { key: 'recorded', header: tr('historyTitle'), hideOnMobile: true, cell: (s) => (
      <span className="text-fg-muted text-xs whitespace-nowrap">
        {tr('recordedSoFar', { count: s.recorded_count ?? 0, total: fmtMoney(s.recorded_total ?? 0, s.currency) })}
      </span>
    ) },
    { key: 'vendor', header: t('col.vendor'), hideOnMobile: true, cell: (s) => s.vendor
      ? <span className="text-fg-muted truncate block max-w-[180px]" title={s.vendor}>{s.vendor}</span>
      : <span className="text-fg-faint">—</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-fg">{t('tabs.schedules')}</h2>
        <FilterDropdown
          label={tr('statusFilter')}
          value={status}
          onChange={(v) => onStatus(v as 'all' | ScheduleStatus)}
          options={[
            { value: 'all', label: tr('allStatuses') },
            { value: 'active', label: t('scheduleStatus.active') },
            { value: 'paused', label: t('scheduleStatus.paused') },
            { value: 'ended', label: t('scheduleStatus.ended') },
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={schedules}
        rowKey={(s) => s.id}
        loading={loading}
        onRowClick={(s) => onOpen(s.id)}
        empty={
          <EmptyState
            icon={Repeat}
            title={tr('schedulesEmpty')}
            description={tr('schedulesEmptyHint')}
            action={canCreate ? <Button onClick={onCreate} leftIcon={<Plus className="w-4 h-4" />}>{t('addExpense')}</Button> : undefined}
          />
        }
      />
    </div>
  );
}

function SummaryCard({
  icon, tone, label, value, valueClass, hint, info,
}: {
  icon: React.ReactNode;
  tone: 'success' | 'warning' | 'danger' | 'brand';
  label: string;
  value: string;
  valueClass?: string;
  hint: string;
  /** Longer caveat shown under the hint. */
  info?: string;
}) {
  const tones = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger:  'bg-danger-soft text-danger',
    brand:   'bg-brand/15 text-brand',
  }[tone];
  return (
    <div className="p-4 bg-surface-2 border border-line rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tones}`}>{icon}</div>
        <p className="text-xs text-fg-muted uppercase tracking-wide font-medium">{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${valueClass ?? 'text-fg'}`}>{value}</p>
      <p className="mt-1 text-xs text-fg-faint">{hint}</p>
      {info && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-fg-faint leading-snug">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" aria-hidden />
          {info}
        </p>
      )}
    </div>
  );
}

function IconAction({
  label, onClick, danger, children,
}: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-1.5 rounded-md transition-colors hover:bg-surface-3 ${danger ? 'text-fg-muted hover:text-danger' : 'text-fg-muted hover:text-fg'}`}
    >
      {children}
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
/** Postgres "2026-10-21 15:45:52+03" or ISO → "2026-10-21 15:45:52". */
function isoish(ts: string): string {
  return ts ? ts.replace('T', ' ').slice(0, 19) : '';
}
