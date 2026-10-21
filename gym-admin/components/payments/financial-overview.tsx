'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, Download, Eye, Info,
  Pencil, Plus, Receipt, Trash2, TrendingUp, Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
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
} from '@/components/ui';
import ExpenseModal, { EXPENSE_CATEGORIES, expenseMethodLabel, type Expense, type ExpenseModalMode } from './expense-modal';

const PAGE_SIZE = 25;

interface Summary {
  from: string;
  to: string;
  is_current_month: boolean;
  currency: string;
  /** Other currencies collected in the period, left out of the totals. */
  excluded_currencies: string[];
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

// Filter state is persisted in sessionStorage (same convention as the
// memberships table) so a reload keeps the period being reviewed.
const STORAGE_KEY = 'financial-overview-filters-v1';

interface PersistedFilters {
  /** Applied range; empty strings = current calendar month (server default). */
  from: string;
  to: string;
  search: string;
  category: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
}

const DEFAULT_FILTERS: PersistedFilters = {
  from: '', to: '', search: '', category: 'all', sort: 'expense_date', dir: 'desc',
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
  const tm = useTranslations('payments.method');
  const tc = useTranslations('common');

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
  const [sort, setSort] = useState<SortKey>(initial.current.sort);
  const [dir, setDir] = useState<'asc' | 'desc'>(initial.current.dir);

  const [rows, setRows] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [modal, setModal] = useState<{ mode: ExpenseModalMode; expense: Expense | null } | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    try {
      const snapshot: PersistedFilters = { from, to, search, category, sort, dir };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {/* sessionStorage may be unavailable in private mode */}
  }, [from, to, search, category, sort, dir]);

  const currency = summary?.currency ?? 'EGP';
  const fmtMoney = useCallback(
    (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n),
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
  }, [rangeParams, debouncedSearch, category, sort, dir, tc]);

  useEffect(() => { fetchRows(1); }, [fetchRows]);
  // Totals depend on the period only — not on page, sort or table filters.
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

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
        [h('id'), h('title'), h('category'), h('amount'), h('date'), h('method'), h('vendor'), h('description'), h('created'), h('updated')],
        ...list.map(e => [
          e.id, e.title, categoryLabel(e.category), Number(e.amount).toFixed(2), e.expense_date.slice(0, 10),
          methodLabel(e.payment_method), e.vendor ?? '', e.description ?? '',
          isoish(e.created_at), isoish(e.updated_at),
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

  const today = useMemo(gymToday, []);
  const isCustom = summary ? !summary.is_current_month : !!(from || to);
  const hasTableFilters = !!debouncedSearch || category !== 'all';

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
      key: 'amount',
      header: sortHeader('amount', t('col.amount')),
      align: 'right',
      cell: (e) => <span className="text-fg tabular-nums whitespace-nowrap">{fmtMoney(Number(e.amount))}</span>,
    },
    {
      key: 'date',
      header: sortHeader('expense_date', t('col.date')),
      cell: (e) => <span className="text-fg-muted whitespace-nowrap">{fmtDay(e.expense_date)}</span>,
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
            <IconAction label={tc('edit')} onClick={() => setModal({ mode: 'edit', expense: e })}><Pencil className="w-3.5 h-3.5" /></IconAction>
          )}
          {canDelete && (
            <IconAction label={tc('delete')} danger onClick={() => setToDelete(e)}><Trash2 className="w-3.5 h-3.5" /></IconAction>
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
            <Button variant="primary" onClick={() => setModal({ mode: 'create', expense: null })} leftIcon={<Plus className="w-4 h-4" />}>
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

      {/* Expenses table */}
      <div className="space-y-3">
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
          {hasTableFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setDebouncedSearch(''); setCategory('all'); }}>
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
                  ? <Button onClick={() => setModal({ mode: 'create', expense: null })} leftIcon={<Plus className="w-4 h-4" />}>{t('addExpense')}</Button>
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
        open={modal !== null}
        mode={modal?.mode ?? 'create'}
        expense={modal?.expense ?? null}
        today={today}
        canEdit={canEdit}
        fmtMoney={fmtMoney}
        fmtDay={fmtDay}
        onClose={() => setModal(null)}
        onModeChange={(mode) => setModal(m => (m ? { ...m, mode } : m))}
        onSaved={() => { setModal(null); fetchRows(page); fetchSummary(); }}
      />

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
