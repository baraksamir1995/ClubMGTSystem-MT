'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Users, Target, Flame, Megaphone, Sprout, UserX } from 'lucide-react';
import {
  DataTable, Pagination, SearchInput, FilterDropdown, EmptyState, Button, type DataTableColumn,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  salesApi, ALL_STAGES, STAGE_LABELS, fmtDate, teamMemberName,
  type SalesContext, type TeamMember, type SalesListMeta,
} from './lib';
import { ScoreChip, StageChip, FlagBadges, ContactLinks } from './chips';
import LeadDetail from './lead-detail';
import NewLeadModal from './new-lead-modal';

const PER_PAGE = 25;

interface Props {
  context: SalesContext;
  team: TeamMember[];
}

/** Filterable, paginated leads table with the create-lead flow. */
export default function LeadsList({ context, team }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<SalesListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [stage, setStage] = useState('');
  const [score, setScore] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [nurture, setNurture] = useState(false);
  const [query, setQuery] = useState('');

  const [sources, setSources] = useState<any[]>([]);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    salesApi<{ data: any[] }>('sources')
      .then((res) => setSources(res.data ?? []))
      .catch(() => { /* filter simply stays empty */ });
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('per_page', String(PER_PAGE));
    if (stage) p.set('stage', stage);
    if (score) p.set('score', score);
    if (sourceId) p.set('source_id', sourceId);
    if (unassignedOnly) p.set('unassigned', '1');
    if (nurture) p.set('nurture', '1');
    if (query.trim()) p.set('q', query.trim());
    return p.toString();
  }, [page, stage, score, sourceId, unassignedOnly, nurture, query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesApi<{ data: any[]; meta: any }>(`leads?${params}`);
      setRows(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch {
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const resetToFirstPage = () => setPage(1);

  const columns: DataTableColumn<any>[] = [
    {
      key: 'lead',
      header: 'Lead',
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-fg truncate">{r.name}</span>
            <ScoreChip score={r.score} />
          </div>
          <div className="text-xs text-fg-muted mt-0.5" dir="ltr">{r.phone}</div>
          <FlagBadges flags={r.flags} className="mt-1" />
        </div>
      ),
    },
    {
      key: 'contact',
      header: '',
      width: 110,
      cell: (r) => <ContactLinks phone={r.phone} compact />,
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (r) => <StageChip stage={r.stage} />,
    },
    {
      key: 'source',
      header: 'Source',
      hideOnMobile: true,
      cell: (r) => <span className="text-fg-muted">{r.source?.name ?? '—'}</span>,
    },
    {
      key: 'assigned',
      header: 'Assigned to',
      hideOnMobile: true,
      cell: (r) => r.assigned_to
        ? <span className="text-fg-muted">{teamMemberName(team, r.assigned_to) ?? 'Staff'}</span>
        : <span className="inline-flex items-center gap-1 text-warning text-xs"><UserX className="w-3 h-3" />Unassigned</span>,
    },
    {
      key: 'created',
      header: 'Added',
      hideOnMobile: true,
      cell: (r) => <span className="text-fg-muted text-xs">{fmtDate(r.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          defaultValue=""
          onSearch={(q) => { setQuery(q); resetToFirstPage(); }}
          placeholder="Search name, phone, email…"
          className="w-full sm:w-64"
        />
        <FilterDropdown
          label="Stage"
          value={stage}
          onChange={(v) => { setStage(v); resetToFirstPage(); }}
          options={[
            { value: '', label: 'All stages' },
            ...ALL_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] })),
          ]}
        />
        <FilterDropdown
          label="Score"
          icon={Flame}
          value={score}
          onChange={(v) => { setScore(v); resetToFirstPage(); }}
          options={[
            { value: '', label: 'All scores' },
            { value: 'hot', label: 'Hot' },
            { value: 'warm', label: 'Warm' },
            { value: 'cold', label: 'Cold' },
          ]}
        />
        <FilterDropdown
          label="Source"
          icon={Megaphone}
          value={sourceId}
          onChange={(v) => { setSourceId(v); resetToFirstPage(); }}
          options={[
            { value: '', label: 'All sources' },
            ...sources.map((s: any) => ({ value: s.id, label: s.name })),
          ]}
        />
        <ToggleChip icon={Target} active={unassignedOnly}
          onClick={() => { setUnassignedOnly((v) => !v); resetToFirstPage(); }}>
          Unassigned
        </ToggleChip>
        <ToggleChip icon={Sprout} active={nurture}
          onClick={() => { setNurture((v) => !v); resetToFirstPage(); }}>
          Nurture pool
        </ToggleChip>

        <Button variant="primary" className="ms-auto" leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowCreate(true)}>
          New lead
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={(r) => setOpenLeadId(r.id)}
        empty={
          <EmptyState icon={Users} title="No leads found"
            description="Adjust the filters or add your first lead."
            action={<Button variant="primary" onClick={() => setShowCreate(true)} leftIcon={<Plus className="w-4 h-4" />}>New lead</Button>} />
        }
      />

      {meta && (
        <Pagination
          total={meta.total}
          limit={PER_PAGE}
          offset={(page - 1) * PER_PAGE}
          onChange={(offset) => setPage(Math.floor(offset / PER_PAGE) + 1)}
          loading={loading}
        />
      )}

      {showCreate && (
        <NewLeadModal
          context={context}
          sources={sources}
          onClose={() => setShowCreate(false)}
          onCreated={(lead) => { setShowCreate(false); setOpenLeadId(lead?.id ?? null); load(); }}
          onViewExisting={(id) => { setShowCreate(false); setOpenLeadId(id); }}
        />
      )}

      {openLeadId && (
        <LeadDetail
          leadId={openLeadId}
          context={context}
          team={team}
          onClose={() => setOpenLeadId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function ToggleChip({ icon: Icon, active, onClick, children }: {
  icon: typeof Target;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 min-h-11 rounded-xl border text-sm font-medium transition-colors',
        active
          ? 'bg-brand/15 text-brand border-brand/40'
          : 'bg-surface-2 text-fg-muted border-line hover:text-fg',
      )}>
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}
