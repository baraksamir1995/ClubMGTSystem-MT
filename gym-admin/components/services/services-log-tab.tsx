'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, RefreshCw, Download, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Avatar,
  Button,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterDropdown,
  Pagination,
  SearchInput,
} from '@/components/ui';
import type { TrainerProfile } from '@/components/trainers/trainer-modal';
import type { GymBranch } from '@/app/dashboard/branches/page';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface ServiceLogRow {
  log_id: string;
  delivered_at: string;
  note: string | null;
  member: {
    id: string;
    name: string | null;
    email: string | null;
    member_number: number | null;
  };
  specialist: {
    id: string;
    name: string | null;
    trainer_type: string | null;
    branch_id: string | null;
  };
  package: {
    assignment_id: string;
    name: string | null;
    sessions_total: number;
    price: number | null;
    currency: string | null;
    price_per_session: number | null;
  };
}

interface ApiPayload {
  data: ServiceLogRow[];
  total: number;
  limit: number;
  offset: number;
}

interface Props {
  trainers: TrainerProfile[];
  branches: GymBranch[];
}

const PAGE_SIZE = 10;

export default function ServicesLogTab({ trainers, branches }: Props) {
  const t = useTranslations('services');
  const tc = useTranslations('common');
  const [rows,       setRows]       = useState<ServiceLogRow[]>([]);
  const [total,      setTotal]      = useState(0);
  const [offset,     setOffset]     = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [q,          setQ]          = useState('');
  const [trainerId,  setTrainerId]  = useState<string>('');
  const [branchId,   setBranchId]   = useState<string>('');

  // ── Data fetch ────────────────────────────────────────────────────
  const fetchRows = useCallback(async (nextOffset: number, query = q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (trainerId)    params.set('trainer_id', trainerId);
      if (branchId)     params.set('branch_id',  branchId);
      params.set('limit',  String(PAGE_SIZE));
      params.set('offset', String(nextOffset));
      const res = await fetch(`/api/service-logs?${params}`, { cache: 'no-store' });
      const json = (await res.json()) as ApiPayload;
      if (!res.ok) {
        toast.error((json as unknown as { error?: string }).error ?? tc('somethingWrong'));
        return;
      }
      setRows(json.data);
      setTotal(json.total);
      setOffset(json.offset);
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setLoading(false);
    }
  }, [q, trainerId, branchId, tc]);

  // Refetch when the non-search filters change.
  useEffect(() => { fetchRows(0); /* on filter change */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId, branchId]);

  // First load.
  useEffect(() => { fetchRows(0); /* on mount */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filter options + export URL ────────────────────────────────────
  const trainerOptions = useMemo(() => [
    { value: '', label: t('servicesLog.filterAllSpecialists') },
    ...[...trainers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(tr => ({
        value: tr.id,
        label: `${tr.name}${tr.trainer_type ? ' · ' + trainerTypeLabel(tr.trainer_type, t) : ''}`,
      })),
  ], [trainers, t]);

  const branchOptions = useMemo(() => [
    { value: '', label: t('servicesLog.filterAllBranches') },
    ...branches.map(b => ({ value: b.id, label: b.name })),
  ], [branches, t]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim())  params.set('q', q.trim());
    if (trainerId) params.set('trainer_id', trainerId);
    if (branchId)  params.set('branch_id',  branchId);
    return `/api/service-logs/export${params.toString() ? `?${params}` : ''}`;
  }, [q, trainerId, branchId]);

  const hasFilters = Boolean(q.trim() || trainerId || branchId);
  const clearFilters = () => {
    setQ('');
    setTrainerId('');
    setBranchId('');
    fetchRows(0, '');
  };

  // ── Table columns ─────────────────────────────────────────────────
  const columns: DataTableColumn<ServiceLogRow>[] = useMemo(() => [
    {
      key: 'date',
      header: t('servicesLog.colDateTime'),
      cell: (r) => (
        <div>
          <div className="text-fg">{fmtDate(r.delivered_at)}</div>
          <div className="text-[11px] text-fg-muted">{fmtTime(r.delivered_at)}</div>
        </div>
      ),
    },
    {
      key: 'member',
      header: t('servicesLog.colMember'),
      cell: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={r.member.name ?? '?'} size={32} />
          <div className="min-w-0">
            <div className="text-fg truncate">{r.member.name ?? '—'}</div>
            <div className="text-[11px] text-fg-muted truncate">
              {r.member.email ?? '—'}
              {r.member.member_number !== null && <> · #{r.member.member_number}</>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'specialist',
      header: t('servicesLog.colSpecialist'),
      cell: (r) => (
        <div>
          <div className="text-fg">{r.specialist.name ?? '—'}</div>
          <div className="text-[11px] text-fg-muted">
            {r.specialist.trainer_type ? trainerTypeLabel(r.specialist.trainer_type, t) : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'package',
      header: t('servicesLog.colPackage'),
      cell: (r) => (
        <div>
          <div className="text-fg">{r.package.name ?? '—'}</div>
          <div className="text-[11px] text-fg-muted">{t('packages.sessionsTotal', { count: r.package.sessions_total })}</div>
        </div>
      ),
    },
    {
      key: 'price',
      header: t('servicesLog.colPricePerSession'),
      align: 'right',
      cell: (r) => (
        <div className="text-end">
          <div className="text-fg">{fmtMoney(r.package.price_per_session, r.package.currency)}</div>
          {r.package.price !== null && (
            <div className="text-[11px] text-fg-muted">
              {t('packages.packTotal', { amount: fmtMoney(r.package.price, r.package.currency) })}
            </div>
          )}
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 bg-surface-2/50 border border-line rounded-xl p-3">
        <SearchInput
          className="flex-1 min-w-[220px]"
          value={q}
          onValueChange={setQ}
          onSearch={(next) => fetchRows(0, next)}
          placeholder={t('servicesLog.searchPlaceholder')}
        />

        <FilterDropdown
          label={t('servicesLog.filterSpecialist')}
          value={trainerId}
          onChange={setTrainerId}
          options={trainerOptions}
          icon={Filter}
        />

        <FilterDropdown
          label={t('servicesLog.filterBranch')}
          value={branchId}
          onChange={setBranchId}
          options={branchOptions}
          icon={Filter}
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {tc('clear')}
          </Button>
        )}

        <div className="ms-auto flex items-center gap-2">
          <a
            href={exportUrl}
            download
            aria-disabled={total === 0}
            className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium select-none whitespace-nowrap h-8 px-3 text-xs transition-colors bg-brand text-brand-ink hover:bg-brand-dim ${total === 0 ? 'pointer-events-none opacity-40' : ''}`}
          >
            <Download className="w-3.5 h-3.5" /> {t('servicesLog.exportCsvBtn')}
          </a>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchRows(offset)}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            {t('servicesLog.refreshBtn')}
          </Button>
        </div>
      </div>

      {/* Result summary */}
      <div className="text-xs text-fg-muted px-1">
        {loading && rows.length === 0
          ? tc('loading')
          : total === 0
            ? t('servicesLog.noSessionsYet')
            : tc('showingResults', { from: offset + 1, to: Math.min(offset + rows.length, total), total })}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.log_id}
        loading={loading}
        empty={
          <EmptyState
            icon={Calendar}
            title={t('servicesLog.emptyTitle')}
            description={t('servicesLog.emptyDescription')}
          />
        }
      />

      {/* Pagination */}
      <Pagination
        total={total}
        limit={PAGE_SIZE}
        offset={offset}
        onChange={(o) => fetchRows(o)}
        loading={loading}
      />
    </div>
  );
}

/* ─── formatters ────────────────────────────────────────────────────── */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(n: number | null, currency: string | null): string {
  if (n === null) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency || ''} ${n}`.trim();
  }
}
function trainerTypeLabel(type: string, t: ReturnType<typeof useTranslations<'services'>>): string {
  switch (type) {
    case 'personal_trainer': return t('servicesLog.typePT');
    case 'physiotherapist':  return t('servicesLog.typePhysio');
    case 'nutritionist':     return t('servicesLog.typeNutritionist');
    default: return type;
  }
}
