'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, RefreshCw, Filter, Undo2, HeartPulse, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { fmtDateGym as fmtDate, fmtTime12 as fmtTime } from '@/lib/time';
import {
  Avatar, Badge, type BadgeProps, Button, DataTable, type DataTableColumn,
  EmptyState, Field, FilterDropdown, Input, Modal, Pagination, SearchInput,
  Select, Textarea,
} from '@/components/ui';

const PAGE_SIZE = 25;

export type ServiceAttendanceStatus = 'attended' | 'absent' | 'cancelled';

export interface ServiceAttendanceRow {
  id: string;
  status: ServiceAttendanceStatus;
  attended_at: string;
  note: string | null;
  /** Set only for 'attended' — the paired Services → Service Logs row. */
  service_log_id: string | null;
  reversed_at: string | null;
  member: {
    id: string;
    name: string | null;
    email: string | null;
    member_number: number | null;
    photo_url: string | null;
  };
  service: { type: string | null };
  package: {
    assignment_id: string | null;
    name: string | null;
    sessions_total: number;
    sessions_used: number;
    sessions_remaining: number;
    status: string | null;
  };
  specialist: { id: string; name: string | null; trainer_type: string | null } | null;
  recorded_by_name: string | null;
}

interface AssignmentOption {
  assignment_id: string;
  package_name: string | null;
  service_type: string | null;
  sessions_total: number;
  sessions_used: number;
  sessions_remaining: number;
  member: { id: string; name: string | null; member_number: number | null };
  trainer: { id: string; name: string | null; trainer_type: string | null } | null;
}

interface MemberOption {
  id: string;
  name: string | null;
  email: string | null;
  member_number: number | null;
  photo_url: string | null;
  package_count: number;
}

interface SpecialistOption {
  id: string;
  name: string | null;
  trainer_type: string | null;
  /** True for the specialist already attached to the chosen package. */
  is_package_trainer: boolean;
}

interface Summary { attended: number; absent: number; cancelled: number; reversed: number }

const STATUS_VARIANT: Record<ServiceAttendanceStatus, BadgeProps['variant']> = {
  attended:  'success',
  absent:    'warning',
  cancelled: 'danger',
};

/**
 * Human label for a service type. Falls back to a de-slugged version of
 * whatever the backend reports, so a newly configured service renders
 * sensibly with no code change (mirrors trainerTypeLabel in the Services
 * Log tab).
 */
function serviceLabel(type: string | null, t: ReturnType<typeof useTranslations<'attendance'>>): string {
  if (!type) return '—';
  switch (type) {
    case 'personal_trainer': return t('servicesAttendance.svcPT');
    case 'physiotherapist':  return t('servicesAttendance.svcPhysio');
    case 'nutritionist':     return t('servicesAttendance.svcNutrition');
    default:
      return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

interface Props {
  /** Gates the record + reverse actions. */
  canEdit: boolean;
}

export default function ServicesAttendanceTab({ canEdit }: Props) {
  const t  = useTranslations('attendance');
  const tc = useTranslations('common');

  const [rows,    setRows]    = useState<ServiceAttendanceRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ attended: 0, absent: 0, cancelled: 0, reversed: 0 });
  const [total,   setTotal]   = useState(0);
  const [offset,  setOffset]  = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [search, setSearch]                 = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus]                 = useState('all');
  const [serviceType, setServiceType]       = useState('all');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [showFilters, setShowFilters]       = useState(false);

  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [showRecord,   setShowRecord]   = useState(false);

  const STATUS_LABEL: Record<ServiceAttendanceStatus, string> = useMemo(() => ({
    attended:  t('servicesAttendance.status.attended'),
    absent:    t('servicesAttendance.status.absent'),
    cancelled: t('servicesAttendance.status.cancelled'),
  }), [t]);

  const STATUS_FILTERS = useMemo(() => ([
    { value: 'all',       label: t('servicesAttendance.statusFilter.all') },
    { value: 'attended',  label: STATUS_LABEL.attended },
    { value: 'absent',    label: STATUS_LABEL.absent },
    { value: 'cancelled', label: STATUS_LABEL.cancelled },
  ]), [t, STATUS_LABEL]);

  const SERVICE_FILTERS = useMemo(() => ([
    { value: 'all', label: t('servicesAttendance.serviceFilter.all') },
    ...serviceTypes.map((s) => ({ value: s, label: serviceLabel(s, t) })),
  ]), [serviceTypes, t]);

  // Service types are gym config, not per-request state — fetch once.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/service-attendance/service-types');
        if (!res.ok) return;
        const json = await res.json();
        setServiceTypes(json.data ?? []);
      } catch {/* filter just falls back to "All services" */}
    })();
  }, []);

  const fetchRows = useCallback(async (off = 0) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(off));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status !== 'all') params.set('status', status);
    if (serviceType !== 'all') params.set('service_type', serviceType);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);

    try {
      const res = await fetch(`/api/service-attendance?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? tc('somethingWrong'));
        return;
      }
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
      setOffset(off);
      if (json.summary) setSummary(json.summary);
    } catch {
      setError(tc('networkError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, serviceType, dateFrom, dateTo, tc]);

  useEffect(() => { fetchRows(0); }, [fetchRows]);

  const hasFilters = !!debouncedSearch || status !== 'all' || serviceType !== 'all' || !!dateFrom || !!dateTo;
  const clearFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setStatus('all'); setServiceType('all');
    setDateFrom(''); setDateTo('');
  };

  const reverse = async (row: ServiceAttendanceRow) => {
    if (!window.confirm(t('servicesAttendance.confirmReverse'))) return;
    try {
      const res = await fetch(`/api/service-attendance/${row.id}/reverse`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? tc('somethingWrong'));
        return;
      }
      toast.success(t('servicesAttendance.toast.reversed'));
      fetchRows(offset);
    } catch {
      toast.error(tc('networkError'));
    }
  };

  const columns: DataTableColumn<ServiceAttendanceRow>[] = [
    {
      key: 'member',
      header: t('servicesAttendance.col.member'),
      cell: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={r.member.name ?? '?'} src={r.member.photo_url} size={36} />
          <div className="min-w-0">
            <p className="text-fg font-medium truncate">{r.member.name ?? '—'}</p>
            <p className="text-xs text-fg-faint truncate">
              {r.member.member_number !== null ? `#${r.member.member_number}` : (r.member.email ?? '—')}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'service',
      header: t('servicesAttendance.col.service'),
      cell: (r) => <span className="text-fg">{serviceLabel(r.service.type, t)}</span>,
    },
    {
      key: 'package',
      header: t('servicesAttendance.col.package'),
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-fg truncate max-w-[200px]">{r.package.name ?? '—'}</p>
          {r.specialist?.name && (
            <p className="text-xs text-fg-faint truncate">{r.specialist.name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: t('servicesAttendance.col.date'),
      cell: (r) => (
        <div>
          <div className="text-fg-muted whitespace-nowrap">{fmtDate(r.attended_at)}</div>
          <div className="text-[11px] text-fg-faint">{fmtTime(r.attended_at)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('servicesAttendance.col.status'),
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          {r.reversed_at && (
            <Badge variant="neutral" size="sm" title={t('servicesAttendance.reversedHint')}>
              {t('servicesAttendance.reversed')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'remaining',
      header: t('servicesAttendance.col.sessionsRemaining'),
      align: 'right',
      cell: (r) => (
        <span className="text-fg-muted">
          {r.package.sessions_remaining}
          <span className="text-fg-faint"> / {r.package.sessions_total}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/dashboard/members/${r.member.id}`}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-brand hover:text-fg hover:bg-surface-3 transition-colors"
            title={t('servicesAttendance.viewMember')}
          >
            <Eye className="w-3.5 h-3.5" aria-hidden />
          </Link>
          {canEdit && r.status === 'attended' && !r.reversed_at && (
            <button
              onClick={() => reverse(r)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-fg-muted hover:text-danger hover:bg-surface-3 transition-colors"
              title={t('servicesAttendance.reverseAction')}
            >
              <Undo2 className="w-3.5 h-3.5" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label={STATUS_LABEL.attended}  value={summary.attended}  tone="success"  onClick={() => setStatus('attended')} />
        <Tile label={STATUS_LABEL.absent}    value={summary.absent}    tone="warning"  onClick={() => setStatus('absent')} />
        <Tile label={STATUS_LABEL.cancelled} value={summary.cancelled} tone="danger"   onClick={() => setStatus('cancelled')} />
        <Tile label={t('servicesAttendance.reversed')} value={summary.reversed} tone="muted" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          className="flex-1 min-w-[200px] max-w-md"
          value={search}
          onValueChange={setSearch}
          onSearch={setDebouncedSearch}
          placeholder={t('servicesAttendance.searchPlaceholder')}
        />
        <FilterDropdown label={tc('status')} value={status} onChange={setStatus} options={STATUS_FILTERS} />
        <FilterDropdown
          label={t('servicesAttendance.col.service')}
          value={serviceType}
          onChange={setServiceType}
          options={SERVICE_FILTERS}
        />
        <Button
          variant={showFilters ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
          leftIcon={<Filter className="w-3.5 h-3.5" />}
        >
          {t('servicesAttendance.dateFilters')}
        </Button>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>{tc('clear')}</Button>}

        <div className="flex-1" />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchRows(offset)}
          disabled={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          {t('servicesAttendance.refresh')}
        </Button>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={() => setShowRecord(true)} leftIcon={<Plus className="w-4 h-4" />}>
            {t('servicesAttendance.record')}
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-surface-2/40 border border-line rounded-xl">
          <Field label={t('servicesAttendance.dateFrom')}>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label={t('servicesAttendance.dateTo')}>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
        </div>
      )}

      {/* Table */}
      {error ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <p className="text-sm text-danger mb-3">{error}</p>
          <Button variant="primary" size="sm" onClick={() => fetchRows(offset)}>{tc('tryAgain')}</Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          empty={
            <EmptyState
              icon={HeartPulse}
              title={hasFilters ? t('servicesAttendance.emptyFiltered') : t('servicesAttendance.empty')}
            />
          }
        />
      )}

      <Pagination
        total={total}
        limit={PAGE_SIZE}
        offset={offset}
        onChange={(o) => fetchRows(o)}
        loading={loading}
      />

      {showRecord && (
        <RecordModal
          open={showRecord}
          onClose={() => setShowRecord(false)}
          onSaved={() => { setShowRecord(false); fetchRows(0); }}
        />
      )}
    </div>
  );
}

// ─── Summary tile ────────────────────────────────────────────────────────────
function Tile({ label, value, tone, onClick }: {
  label: string; value: number; tone: 'success' | 'warning' | 'danger' | 'muted'; onClick?: () => void;
}) {
  const toneClass = {
    success: 'text-success',
    warning: 'text-warning',
    danger:  'text-danger',
    muted:   'text-fg-muted',
  }[tone];
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp
      onClick={onClick}
      className={`text-start bg-surface-2 border border-line rounded-xl p-4 ${onClick ? 'hover:border-line-strong transition-colors' : ''}`}
    >
      <p className="text-xs text-fg-muted uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </Cmp>
  );
}
// ─── Record modal ────────────────────────────────────────────────────────────
/**
 * Plain form — every field visible at once.
 *
 * The dependent lookups still happen behind the scenes: choosing a member
 * loads their packages (auto-selected when there's only one), and choosing
 * a package loads the specialists for that package's service type with its
 * own trainer preselected.
 *
 * Attendance-only by design: this form always records 'attended'. The
 * absent/cancelled statuses still exist in the API and the listing filter,
 * but recording them isn't part of the admin's front-desk flow.
 */
function RecordModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const t  = useTranslations('attendance');
  const tc = useTranslations('common');

  const [members, setMembers]     = useState<MemberOption[]>([]);
  const [memberId, setMemberId]   = useState('');
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [packages, setPackages]   = useState<AssignmentOption[]>([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);
  const [trainerId, setTrainerId] = useState('');
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);

  const [when, setWhen] = useState(nowLocalInput);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Members holding at least one package with sessions left.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/service-attendance/members');
        const json = await res.json();
        if (alive) setMembers(res.ok ? (json.data ?? []) : []);
      } catch {
        if (alive) setMembers([]);
      } finally {
        if (alive) setLoadingMembers(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Packages for the chosen member; a lone package is selected for them.
  useEffect(() => {
    if (!memberId) { setPackages([]); setAssignmentId(''); return; }
    let alive = true;
    (async () => {
      setLoadingPackages(true);
      try {
        const res = await fetch(`/api/service-attendance/assignments?gym_member_id=${memberId}`);
        const json = await res.json();
        if (!alive) return;
        const list: AssignmentOption[] = res.ok ? (json.data ?? []) : [];
        setPackages(list);
        setAssignmentId(list.length === 1 ? list[0].assignment_id : '');
      } catch {
        if (alive) { setPackages([]); setAssignmentId(''); }
      } finally {
        if (alive) setLoadingPackages(false);
      }
    })();
    return () => { alive = false; };
  }, [memberId]);

  // Specialists for the chosen package, scoped to its service type.
  useEffect(() => {
    if (!assignmentId) { setSpecialists([]); setTrainerId(''); return; }
    let alive = true;
    (async () => {
      setLoadingSpecialists(true);
      try {
        const res = await fetch(`/api/service-attendance/specialists?assignment_id=${assignmentId}`);
        const json = await res.json();
        if (!alive) return;
        const list: SpecialistOption[] = res.ok ? (json.data ?? []) : [];
        setSpecialists(list);
        const own = list.find((s) => s.is_package_trainer);
        setTrainerId(own?.id ?? (list.length === 1 ? list[0].id : ''));
      } catch {
        if (alive) { setSpecialists([]); setTrainerId(''); }
      } finally {
        if (alive) setLoadingSpecialists(false);
      }
    })();
    return () => { alive = false; };
  }, [assignmentId]);

  const selected = packages.find((p) => p.assignment_id === assignmentId) ?? null;
  const blocked  = !!selected && selected.sessions_remaining <= 0;

  const submit = async () => {
    if (!assignmentId) { toast.error(t('servicesAttendance.pickPackage')); return; }
    if (!trainerId)    { toast.error(t('servicesAttendance.pickSpecialist')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/service-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          status: 'attended',
          trainer_id: trainerId,
          // Absolute instant, so the stored time matches what was picked
          // regardless of server timezone.
          attended_at: new Date(when).toISOString(),
          note: note || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? tc('somethingWrong')); return; }
      toast.success(json.duplicate
        ? t('servicesAttendance.toast.alreadyRecorded')
        : t('servicesAttendance.toast.recorded'));
      onSaved();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-fg">{t('servicesAttendance.recordTitle')}</h2>
          <p className="text-sm text-fg-muted mt-0.5">{t('servicesAttendance.recordSubtitle')}</p>
        </div>

        <Field label={t('servicesAttendance.stepMember')}>
          <Select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            disabled={loadingMembers}
          >
            <option value="">
              {loadingMembers
                ? tc('loading')
                : members.length === 0
                  ? t('servicesAttendance.noMembersWithPackages')
                  : t('servicesAttendance.pickMember')}
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.member_number !== null ? ` · #${m.member_number}` : ''}
                {` · ${t('servicesAttendance.nPackages', { count: m.package_count })}`}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('servicesAttendance.stepPackage')}>
            <Select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              disabled={!memberId || loadingPackages}
            >
              <option value="">
                {!memberId
                  ? t('servicesAttendance.pickMemberFirst')
                  : loadingPackages
                    ? tc('loading')
                    : packages.length === 0
                      ? t('servicesAttendance.noPackages')
                      : t('servicesAttendance.pickPackage')}
              </option>
              {packages.map((p) => (
                <option key={p.assignment_id} value={p.assignment_id}>
                  {p.package_name} · {serviceLabel(p.service_type, t)} · {p.sessions_remaining}/{p.sessions_total}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('servicesAttendance.stepSpecialist')}>
            <Select
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              disabled={!assignmentId || loadingSpecialists}
            >
              <option value="">
                {!assignmentId
                  ? t('servicesAttendance.pickPackageFirst')
                  : loadingSpecialists
                    ? tc('loading')
                    : specialists.length === 0
                      ? t('servicesAttendance.noSpecialists')
                      : t('servicesAttendance.pickSpecialist')}
              </option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.trainer_type ? ` · ${serviceLabel(s.trainer_type, t)}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {selected && (
          <p className="text-xs text-fg-muted bg-surface-2/60 border border-line rounded-lg px-3 py-2">
            {t('servicesAttendance.willDeduct', {
              remaining: selected.sessions_remaining,
              after: Math.max(0, selected.sessions_remaining - 1),
            })}
          </p>
        )}

        {/* Defaults to now; the admin can change it. */}
        <Field label={t('servicesAttendance.stepWhen')}>
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>

        <Field label={t('servicesAttendance.noteLabel')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} />
        </Field>

        {blocked && <p className="text-sm text-danger">{t('servicesAttendance.zeroBalance')}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{tc('cancel')}</Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={saving || !assignmentId || !trainerId || blocked}
          >
            {saving ? tc('saving') : t('servicesAttendance.deductSession')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** `datetime-local` wants a local "YYYY-MM-DDTHH:mm" with no timezone. */
function nowLocalInput(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
