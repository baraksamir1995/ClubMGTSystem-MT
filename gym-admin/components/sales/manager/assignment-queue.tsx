'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Inbox, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge, Button, DataTable, EmptyState, Pagination, Select, Tabs,
  type DataTableColumn,
} from '@/components/ui';
import type { Lead, LeadScore, SalesContext, TeamMember } from '@/lib/sales-types';
import { ageFrom, branchName, memberName, salesGet, salesPost, stageLabel } from './lib';

const PAGE_SIZE = 25;

interface Props {
  context: SalesContext;
  team: TeamMember[];
}

/* ------------------------------------------------------------------ */
/* Small shared cells                                                  */
/* ------------------------------------------------------------------ */

function LeadFlagBadges({ lead }: { lead: Lead }) {
  const flags = lead.flags;
  if (!flags || (!flags.unassigned_sla_breach && !flags.uncontacted && !flags.unqualified_sla_breach)) {
    return <span className="text-fg-faint text-xs">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.unassigned_sla_breach && <Badge variant="danger" size="sm">SLA breach</Badge>}
      {flags.unqualified_sla_breach && <Badge variant="warning" size="sm">Qualify SLA</Badge>}
      {flags.uncontacted && <Badge variant="warning" size="sm">Uncontacted</Badge>}
    </div>
  );
}

function ScoreBadge({ score }: { score: LeadScore | null }) {
  if (!score) return <span className="text-fg-faint text-xs">—</span>;
  const variant = score === 'hot' ? 'danger' : score === 'warm' ? 'warning' : 'neutral';
  return <Badge variant={variant} size="sm">{score.charAt(0).toUpperCase() + score.slice(1)}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AssignmentQueue({ context, team }: Props) {
  const [tab, setTab] = useState<'unassigned' | 'reassign'>('unassigned');

  // Assignable people — the whole sales team (reps first).
  const assignees = useMemo(
    () => [...team].sort((a, b) =>
      a.sales_role === b.sales_role
        ? a.full_name.localeCompare(b.full_name)
        : a.sales_role === 'rep' ? -1 : 1),
    [team],
  );

  /* ------------------------- Unassigned tab ------------------------ */

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRep, setBulkRep] = useState('');
  const [assigningIds, setAssigningIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const loadUnassigned = useCallback(async (newOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const page = Math.floor(newOffset / PAGE_SIZE) + 1;
      const res = await salesGet<Lead[]>(`leads?unassigned=1&page=${page}&per_page=${PAGE_SIZE}`);
      setLeads(res.data ?? []);
      setTotal(res.meta?.total ?? res.total ?? (res.data ?? []).length);
      setOffset(newOffset);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load unassigned leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUnassigned(0); }, [loadUnassigned]);

  const assignOne = async (lead: Lead, userId: string) => {
    if (!userId) return;
    const id = String(lead.id);
    setAssigningIds((s) => new Set(s).add(id));
    try {
      await salesPost(`leads/${lead.id}/assign`, { assigned_to: userId });
      toast.success(`Assigned to ${memberName(team, userId)}`);
      setLeads((prev) => prev.filter((l) => String(l.id) !== id));
      setTotal((t) => Math.max(0, t - 1));
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to assign lead');
    } finally {
      setAssigningIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const assignSelected = async () => {
    if (!bulkRep || selected.size === 0) return;
    setBulkBusy(true);
    const ids = [...selected];
    const results = await Promise.allSettled(
      ids.map((id) => salesPost(`leads/${id}/assign`, { assigned_to: bulkRep })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`Assigned ${ok} lead${ok === 1 ? '' : 's'} to ${memberName(team, bulkRep)}`);
    if (failed > 0) toast.error(`${failed} assignment${failed === 1 ? '' : 's'} failed`);
    setBulkBusy(false);
    setBulkRep('');
    loadUnassigned(offset);
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(String(l.id)));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => String(l.id))));

  const checkboxCls = 'w-4 h-4 rounded border-line-strong bg-surface-2 accent-[var(--brand,#B8FF2E)] cursor-pointer';

  const unassignedColumns: DataTableColumn<Lead>[] = [
    {
      key: 'select',
      width: 36,
      header: (
        <input
          type="checkbox"
          aria-label="Select all"
          checked={allSelected}
          onChange={toggleAll}
          className={checkboxCls}
        />
      ),
      cell: (l) => (
        <input
          type="checkbox"
          aria-label={`Select ${l.name}`}
          checked={selected.has(String(l.id))}
          onChange={() => toggleSelect(String(l.id))}
          onClick={(e) => e.stopPropagation()}
          className={checkboxCls}
        />
      ),
    },
    {
      key: 'lead',
      header: 'Lead',
      cell: (l) => (
        <div>
          <p className="text-fg font-medium">{l.name}</p>
          <p className="text-xs text-fg-muted">{l.phone}</p>
        </div>
      ),
    },
    {
      key: 'age',
      header: 'Age',
      cell: (l) => (
        <span className={l.flags?.unassigned_sla_breach ? 'text-danger font-medium' : 'text-fg-muted'}>
          {ageFrom(l.created_at)}
        </span>
      ),
    },
    { key: 'source', header: 'Source', cell: (l) => <span className="text-fg-muted">{l.source?.name ?? '—'}</span>, hideOnMobile: true },
    {
      key: 'branch',
      header: 'Branch',
      cell: (l) => <span className="text-fg-muted">{l.branch?.name ?? branchName(context.branches, l.branch_id)}</span>,
      hideOnMobile: true,
    },
    { key: 'score', header: 'Score', cell: (l) => <ScoreBadge score={l.score} /> },
    { key: 'flags', header: 'Flags', cell: (l) => <LeadFlagBadges lead={l} />, hideOnMobile: true },
    {
      key: 'assign',
      header: 'Assign to',
      align: 'right',
      width: 190,
      cell: (l) => (
        <Select
          value=""
          disabled={assigningIds.has(String(l.id))}
          onChange={(e) => assignOne(l, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Assign ${l.name}`}
        >
          <option value="">Choose rep…</option>
          {assignees.map((m) => (
            <option key={String(m.staff_id)} value={String(m.user_id)}>{m.full_name}</option>
          ))}
        </Select>
      ),
    },
  ];

  /* -------------------------- Reassign tab ------------------------- */

  const [fromRep, setFromRep] = useState('');
  const [repLeads, setRepLeads] = useState<Lead[]>([]);
  const [repLoading, setRepLoading] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);
  const [repSelected, setRepSelected] = useState<Set<string>>(new Set());
  const [toRep, setToRep] = useState('');
  const [reassignBusy, setReassignBusy] = useState(false);

  const loadRepLeads = useCallback(async (userId: string) => {
    if (!userId) { setRepLeads([]); return; }
    setRepLoading(true);
    setRepError(null);
    try {
      const res = await salesGet<Lead[]>(`leads?assigned_to=${encodeURIComponent(userId)}&per_page=100`);
      setRepLeads(res.data ?? []);
      setRepSelected(new Set());
    } catch (e) {
      setRepError(e instanceof Error ? e.message : 'Failed to load leads');
    } finally {
      setRepLoading(false);
    }
  }, []);

  useEffect(() => { loadRepLeads(fromRep); }, [fromRep, loadRepLeads]);

  const reassignSelected = async () => {
    if (!toRep || repSelected.size === 0) return;
    setReassignBusy(true);
    const ids = [...repSelected];
    const results = await Promise.allSettled(
      ids.map((id) => salesPost(`leads/${id}/assign`, { assigned_to: toRep })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok > 0) toast.success(`Moved ${ok} lead${ok === 1 ? '' : 's'} to ${memberName(team, toRep)}`);
    if (failed > 0) toast.error(`${failed} move${failed === 1 ? '' : 's'} failed`);
    setReassignBusy(false);
    loadRepLeads(fromRep);
  };

  const allRepSelected = repLeads.length > 0 && repLeads.every((l) => repSelected.has(String(l.id)));

  const reassignColumns: DataTableColumn<Lead>[] = [
    {
      key: 'select',
      width: 36,
      header: (
        <input
          type="checkbox"
          aria-label="Select all"
          checked={allRepSelected}
          onChange={() =>
            setRepSelected(allRepSelected ? new Set() : new Set(repLeads.map((l) => String(l.id))))}
          className={checkboxCls}
        />
      ),
      cell: (l) => (
        <input
          type="checkbox"
          aria-label={`Select ${l.name}`}
          checked={repSelected.has(String(l.id))}
          onChange={() =>
            setRepSelected((s) => {
              const n = new Set(s);
              const id = String(l.id);
              n.has(id) ? n.delete(id) : n.add(id);
              return n;
            })}
          className={checkboxCls}
        />
      ),
    },
    {
      key: 'lead',
      header: 'Lead',
      cell: (l) => (
        <div>
          <p className="text-fg font-medium">{l.name}</p>
          <p className="text-xs text-fg-muted">{l.phone}</p>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (l) => <Badge variant="neutral" size="sm">{stageLabel(l.stage)}</Badge>,
    },
    { key: 'age', header: 'Age', cell: (l) => <span className="text-fg-muted">{ageFrom(l.created_at)}</span>, hideOnMobile: true },
    { key: 'source', header: 'Source', cell: (l) => <span className="text-fg-muted">{l.source?.name ?? '—'}</span>, hideOnMobile: true },
    { key: 'flags', header: 'Flags', cell: (l) => <LeadFlagBadges lead={l} />, hideOnMobile: true },
  ];

  /* ------------------------------ UI ------------------------------- */

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'unassigned' | 'reassign')}>
        <Tabs.List>
          <Tabs.Trigger value="unassigned" icon={Inbox}>Unassigned</Tabs.Trigger>
          <Tabs.Trigger value="reassign" icon={ArrowLeftRight}>Reassign</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {tab === 'unassigned' && (
        <div className="space-y-3">
          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 flex-wrap bg-surface-2 border border-line rounded-xl px-4 py-2.5">
              <span className="text-sm text-fg">
                <span className="font-semibold">{selected.size}</span> selected
              </span>
              <div className="w-52">
                <Select value={bulkRep} onChange={(e) => setBulkRep(e.target.value)} aria-label="Bulk assign to">
                  <option value="">Choose rep…</option>
                  {assignees.map((m) => (
                    <option key={String(m.staff_id)} value={String(m.user_id)}>{m.full_name}</option>
                  ))}
                </Select>
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={!bulkRep}
                isLoading={bulkBusy}
                onClick={assignSelected}
                leftIcon={<UserCheck className="w-4 h-4" />}
              >
                Assign selected{bulkRep ? ` to ${memberName(team, bulkRep)}` : ''}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          {error ? (
            <div className="bg-surface-2 border border-line rounded-xl">
              <EmptyState
                icon={Inbox}
                title="Couldn't load the queue"
                description={error}
                action={<Button variant="secondary" onClick={() => loadUnassigned(offset)}>Retry</Button>}
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={unassignedColumns}
                rows={leads}
                rowKey={(l) => String(l.id)}
                loading={loading}
                empty={
                  <EmptyState
                    icon={Inbox}
                    title="No unassigned leads"
                    description="Every incoming lead has an owner. New leads land here until they're assigned."
                  />
                }
              />
              <Pagination
                total={total}
                limit={PAGE_SIZE}
                offset={offset}
                onChange={(o) => loadUnassigned(o)}
                loading={loading}
              />
            </>
          )}
        </div>
      )}

      {tab === 'reassign' && (
        <div className="space-y-3">
          <div className="flex items-end gap-3 flex-wrap bg-surface-2 border border-line rounded-xl px-4 py-3">
            <div className="w-56">
              <label className="block text-xs text-fg-muted mb-1">Move leads from</label>
              <Select value={fromRep} onChange={(e) => setFromRep(e.target.value)}>
                <option value="">Choose rep…</option>
                {assignees.map((m) => (
                  <option key={String(m.staff_id)} value={String(m.user_id)}>{m.full_name}</option>
                ))}
              </Select>
            </div>
            <div className="w-56">
              <label className="block text-xs text-fg-muted mb-1">To</label>
              <Select value={toRep} onChange={(e) => setToRep(e.target.value)} disabled={!fromRep}>
                <option value="">Choose rep…</option>
                {assignees
                  .filter((m) => String(m.user_id) !== fromRep)
                  .map((m) => (
                    <option key={String(m.staff_id)} value={String(m.user_id)}>{m.full_name}</option>
                  ))}
              </Select>
            </div>
            <Button
              variant="primary"
              disabled={!toRep || repSelected.size === 0}
              isLoading={reassignBusy}
              onClick={reassignSelected}
              leftIcon={<ArrowLeftRight className="w-4 h-4" />}
            >
              Move {repSelected.size > 0 ? repSelected.size : ''} selected
            </Button>
          </div>
          <p className="text-xs text-fg-muted">
            Use this when a rep leaves or goes on holiday — select their open leads and hand them to a teammate in one go.
          </p>

          {!fromRep ? (
            <div className="bg-surface-2 border border-line rounded-xl">
              <EmptyState
                size="sm"
                icon={ArrowLeftRight}
                title="Pick a rep to see their open leads"
              />
            </div>
          ) : repError ? (
            <div className="bg-surface-2 border border-line rounded-xl">
              <EmptyState
                icon={ArrowLeftRight}
                title="Couldn't load leads"
                description={repError}
                action={<Button variant="secondary" onClick={() => loadRepLeads(fromRep)}>Retry</Button>}
              />
            </div>
          ) : (
            <DataTable
              columns={reassignColumns}
              rows={repLeads}
              rowKey={(l) => String(l.id)}
              loading={repLoading}
              empty={
                <EmptyState
                  icon={ArrowLeftRight}
                  title="No open leads"
                  description={`${memberName(team, fromRep)} has no leads to move.`}
                />
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
