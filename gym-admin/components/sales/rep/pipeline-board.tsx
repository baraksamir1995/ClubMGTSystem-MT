'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, MoreVertical, UserX } from 'lucide-react';
import { FilterDropdown, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  salesApi, errMsg, ALL_STAGES, STAGE_LABELS,
  daysSince, teamMemberName,
  type SalesContext, type TeamMember,
} from './lib';
import { ScoreChip, FlagBadges } from './chips';
import LeadDetail from './lead-detail';
import LostDialog from './lost-dialog';

interface Props {
  context: SalesContext;
  team: TeamMember[];
  /** 'own' = only my leads; 'team' = everything visible + rep filter. */
  scope: 'own' | 'team';
}

/**
 * Kanban over the 5 active stages + Converted + Lost. Native HTML5
 * drag-and-drop; a drop POSTs a transition (server enforces
 * one-step-forward — a 422 shows the message and the card snaps back).
 * Dropping on Lost opens the lost-reason dialog instead.
 */
export default function PipelineBoard({ context, team, scope }: Props) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [repFilter, setRepFilter] = useState('');
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [lostLead, setLostLead] = useState<any>(null);
  const [menuLeadId, setMenuLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const dragLeadId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ per_page: '100' });
      if (scope === 'own') p.set('assigned_to', context?.user_id ?? '');
      else if (repFilter) p.set('assigned_to', repFilter);
      const res = await salesApi<{ data: any[] }>(`leads?${p.toString()}`);
      setLeads(res.data ?? []);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [scope, repFilter, context?.user_id]);

  useEffect(() => { load(); }, [load]);

  // Close the card menu on any outside click.
  useEffect(() => {
    if (!menuLeadId) return;
    const close = () => setMenuLeadId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuLeadId]);

  const moveLead = async (leadId: string, to: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === to) return;

    if (to === 'lost') { setLostLead(lead); return; }

    const prevStage = lead.stage;
    // Optimistic move; snap back on a 422 from the pipeline guard.
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: to } : l)));
    try {
      await salesApi(`leads/${leadId}/transition`, { method: 'POST', body: { to } });
      toast.success(`Moved to ${STAGE_LABELS[to]}`);
      load();
    } catch (e) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: prevStage } : l)));
      toast.error(errMsg(e));
    }
  };

  const reassign = async (leadId: string, userId: string) => {
    setMenuLeadId(null);
    try {
      await salesApi(`leads/${leadId}/assign`, { method: 'POST', body: { assigned_to: userId } });
      toast.success('Lead reassigned');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const columns = ALL_STAGES.map((stage) => ({
    stage,
    leads: leads.filter((l) => l.stage === stage),
  }));

  return (
    <div className="space-y-4">
      {scope === 'team' && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            label="Rep"
            value={repFilter}
            onChange={setRepFilter}
            options={[
              { value: '', label: 'All reps' },
              ...team.map((m: any) => ({ value: m.user_id, label: m.full_name })),
            ]}
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-fg-muted" />}
        </div>
      )}

      {loading && leads.length === 0 ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-fg-muted inline" /></div>
      ) : leads.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl">
          <EmptyState icon={UserX} title="No leads in the pipeline"
            description={scope === 'own' ? 'Claim leads from the queue or add a new one.' : 'No leads match this filter.'} />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
          {columns.map(({ stage, leads: colLeads }) => (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stage); }}
              onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                const id = e.dataTransfer.getData('text/plain') || dragLeadId.current;
                if (id) moveLead(id, stage);
              }}
              className={cn(
                'w-[272px] shrink-0 rounded-xl border bg-surface-2 flex flex-col max-h-[70vh]',
                dragOverStage === stage ? 'border-brand/60 bg-surface-3' : 'border-line',
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line">
                <span className={cn(
                  'text-xs font-semibold uppercase tracking-wide',
                  stage === 'converted' ? 'text-success' : stage === 'lost' ? 'text-danger' : 'text-fg-muted',
                )}>
                  {STAGE_LABELS[stage]}
                </span>
                <span className="text-[11px] bg-surface-4 text-fg-muted px-1.5 py-0.5 rounded-full">{colLeads.length}</span>
              </div>

              <div className="p-2 space-y-2 overflow-y-auto">
                {colLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    team={team}
                    canReassign={scope === 'team' && Boolean(context?.is_manager)}
                    menuOpen={menuLeadId === lead.id}
                    onToggleMenu={() => setMenuLeadId((id) => (id === lead.id ? null : lead.id))}
                    onReassign={(userId) => reassign(lead.id, userId)}
                    onOpen={() => setOpenLeadId(lead.id)}
                    onDragStart={(e) => {
                      dragLeadId.current = lead.id;
                      e.dataTransfer.setData('text/plain', lead.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => { dragLeadId.current = null; setDragOverStage(null); }}
                  />
                ))}
                {colLeads.length === 0 && (
                  <p className="text-xs text-fg-faint text-center py-6">Drop a lead here</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lostLead && (
        <LostDialog leadId={lostLead.id} leadName={lostLead.name}
          onClose={() => setLostLead(null)}
          onLost={() => { setLostLead(null); load(); }} />
      )}

      {openLeadId && (
        <LeadDetail leadId={openLeadId} context={context} team={team}
          onClose={() => setOpenLeadId(null)} onChanged={load} />
      )}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────────────── */

function LeadCard({ lead, team, canReassign, menuOpen, onToggleMenu, onReassign, onOpen, onDragStart, onDragEnd }: {
  lead: any;
  team: any[];
  canReassign: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onReassign: (userId: string) => void;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const isTerminal = lead.stage === 'converted' || lead.stage === 'lost';
  // Best available proxy for time-in-stage on the list payload.
  const days = daysSince(lead.updated_at ?? lead.created_at);
  const assignedName = teamMemberName(team, lead.assigned_to);

  return (
    <div
      draggable={!isTerminal}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className={cn(
        'relative p-3 rounded-lg bg-surface border border-line hover:border-line-strong transition-colors',
        !isTerminal && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-fg truncate">{lead.name}</div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <ScoreChip score={lead.score} />
            {lead.source?.name && (
              <span className="text-[11px] text-fg-muted truncate">{lead.source.name}</span>
            )}
          </div>
        </div>
        {canReassign && (
          <button
            aria-label="Card actions"
            onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
            className="w-8 h-8 -mt-1 -me-1 inline-flex items-center justify-center rounded-lg text-fg-faint hover:text-fg hover:bg-surface-3">
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>

      <FlagBadges flags={lead.flags} className="mt-1.5" />

      <div className="flex items-center justify-between mt-2 text-[11px] text-fg-faint">
        <span>{assignedName ?? (lead.assigned_to ? 'Staff' : 'Unassigned')}</span>
        <span>{days === 0 ? 'today' : `${days}d in stage`}</span>
      </div>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-9 end-2 z-20 w-48 max-h-56 overflow-y-auto bg-surface-2 border border-line rounded-xl shadow-xl p-1">
          <div className="px-2.5 py-1.5 text-[11px] uppercase tracking-wide text-fg-faint">Reassign to</div>
          {team.map((m: any) => (
            <button key={m.user_id}
              onClick={() => onReassign(m.user_id)}
              className="w-full text-start px-2.5 py-2 rounded-lg text-sm text-fg hover:bg-surface-3 transition-colors">
              {m.full_name}
            </button>
          ))}
          {team.length === 0 && <p className="px-2.5 py-2 text-xs text-fg-muted">No sales team members.</p>}
        </div>
      )}
    </div>
  );
}
