'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  X, Loader2, ArrowRight, CalendarPlus, Tag, Trophy, RotateCcw,
  Hand, UserX2, History, Info, Phone as PhoneIcon, CalendarDays,
} from 'lucide-react';
import { Button, Tabs, Badge, Field, Input, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  salesApi, errMsg, ACTIVE_STAGES, STAGE_LABELS, nextStage,
  FITNESS_GOALS, INTEREST_LEVELS, LOCATION_FITS, JOIN_TIMEFRAMES, JOIN_TIMEFRAME_LABELS,
  labelize, fmtDate, fmtDateTime, teamMemberName,
  type SalesContext, type TeamMember,
} from './lib';
import { ScoreChip, StageChip, ContactLinks, FlagBadges } from './chips';
import DetailActivities from './detail-activities';
import DetailAppointments from './detail-appointments';
import DetailOffers from './detail-offers';
import LostDialog from './lost-dialog';
import ConvertDialog from './convert-dialog';

interface Props {
  leadId: string;
  context: SalesContext;
  team: TeamMember[];
  onClose: () => void;
  /** Fires after any successful mutation so list/board callers can refresh. */
  onChanged: () => void;
}

type TabId = 'overview' | 'activities' | 'appointments' | 'offers' | 'history';

/** Slide-over drawer with the full lead workspace. */
export default function LeadDetail({ leadId, context, team, onClose, onChanged }: Props) {
  const [mounted, setMounted] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('overview');
  const [showLost, setShowLost] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await salesApi<{ data: any }>(`leads/${leadId}`);
      setLead(res.data);
    } catch (e) {
      toast.error(errMsg(e));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [leadId, onClose]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { load(); }, [load]);

  // ESC closes, background scroll locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const changed = useCallback(() => { load(); onChanged(); }, [load, onChanged]);

  const act = async (label: string, path: string, body?: unknown) => {
    setActing(true);
    try {
      await salesApi(`leads/${leadId}/${path}`, { method: 'POST', body });
      toast.success(label);
      changed();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setActing(false);
    }
  };

  if (!mounted) return null;

  const stage: string = lead?.stage ?? 'new';
  const isConverted = stage === 'converted';
  const isLost = stage === 'lost';
  const readOnly = isConverted || isLost;
  const unassigned = lead && lead.assigned_to == null;
  const next = nextStage(stage);

  const body = (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Lead detail">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 end-0 w-full sm:max-w-xl bg-surface border-s border-line shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 sm:px-6 py-4 border-b border-line">
          <div className="flex-1 min-w-0">
            {loading || !lead ? (
              <div className="h-6 flex items-center"><Loader2 className="w-4 h-4 animate-spin text-fg-muted" /></div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-fg truncate">{lead.name}</h2>
                  <ScoreChip score={lead.score} />
                  <StageChip stage={stage} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-fg-muted">
                  <span dir="ltr">{lead.phone}</span>
                  {lead.email && <span className="truncate">{lead.email}</span>}
                  {lead.source?.name && <span>via {lead.source.name}</span>}
                  <FlagBadges flags={lead.flags} />
                </div>
              </>
            )}
          </div>
          {lead && <ContactLinks phone={lead.phone} />}
          <button onClick={onClose} aria-label="Close"
            className="w-11 h-11 -me-2 inline-flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banners */}
        {lead && isConverted && (
          <div className="px-4 sm:px-6 py-2.5 bg-success-soft border-b border-line text-sm text-success flex items-center gap-2">
            <Trophy className="w-4 h-4 shrink-0" />
            Converted on {fmtDate(lead.converted_at)} — this lead is read-only.
          </div>
        )}
        {lead && isLost && (
          <div className="px-4 sm:px-6 py-2.5 bg-danger-soft border-b border-line text-sm text-fg flex flex-wrap items-center gap-2">
            <UserX2 className="w-4 h-4 shrink-0 text-danger" />
            <span className="flex-1">
              Lost{lead.lost_reason ? ` — ${labelize(lead.lost_reason)}` : ''}
              {lead.reengage_at ? ` · re-engage ${fmtDate(lead.reengage_at)}` : ''}
            </span>
            <Button size="sm" variant="secondary" isLoading={acting}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => act('Lead reopened', 'reopen')}>
              Reopen
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="px-4 sm:px-6 pt-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <Tabs.List className="w-full overflow-x-auto flex-nowrap">
              <Tabs.Trigger value="overview" icon={Info}>Overview</Tabs.Trigger>
              <Tabs.Trigger value="activities" icon={PhoneIcon}>Activities</Tabs.Trigger>
              <Tabs.Trigger value="appointments" icon={CalendarDays}>Appts</Tabs.Trigger>
              <Tabs.Trigger value="offers" icon={Tag}>Offers</Tabs.Trigger>
              <Tabs.Trigger value="history" icon={History}>History</Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {loading || !lead ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-fg-muted inline" /></div>
          ) : (
            <>
              {tab === 'overview' && (
                <Overview
                  lead={lead}
                  team={team}
                  readOnly={readOnly}
                  unassigned={unassigned}
                  acting={acting}
                  onClaim={() => act('Lead claimed', 'claim')}
                  onAdvance={() => {
                    if (next === 'converted') setShowConvert(true);
                    else if (next) act(`Moved to ${STAGE_LABELS[next]}`, 'transition', { to: next });
                  }}
                  onBook={() => setTab('appointments')}
                  onOffer={() => setTab('offers')}
                  onLost={() => setShowLost(true)}
                  onChanged={changed}
                />
              )}
              {tab === 'activities' && (
                <DetailActivities lead={lead} team={team} readOnly={readOnly}
                  onLogged={changed} onPromptLost={() => setShowLost(true)} />
              )}
              {tab === 'appointments' && (
                <DetailAppointments lead={lead} context={context} readOnly={readOnly} onChanged={changed} />
              )}
              {tab === 'offers' && (
                <DetailOffers lead={lead} readOnly={readOnly} onChanged={changed} />
              )}
              {tab === 'history' && <StageHistory lead={lead} team={team} />}
            </>
          )}
        </div>
      </div>

      {showLost && lead && (
        <LostDialog leadId={lead.id} leadName={lead.name}
          onClose={() => setShowLost(false)}
          onLost={() => { setShowLost(false); changed(); }} />
      )}
      {showConvert && lead && (
        <ConvertDialog leadId={lead.id} leadName={lead.name} offers={lead.offers ?? []}
          onClose={() => setShowConvert(false)}
          onConverted={() => { setShowConvert(false); changed(); }} />
      )}
    </div>
  );

  return createPortal(body, document.body);
}

/* ── Overview tab ───────────────────────────────────────────────── */

function Overview({ lead, team, readOnly, unassigned, acting, onClaim, onAdvance, onBook, onOffer, onLost, onChanged }: {
  lead: any;
  team: any[];
  readOnly: boolean;
  unassigned: boolean;
  acting: boolean;
  onClaim: () => void;
  onAdvance: () => void;
  onBook: () => void;
  onOffer: () => void;
  onLost: () => void;
  onChanged: () => void;
}) {
  const stage: string = lead.stage;
  const next = nextStage(stage);
  const assignedName = teamMemberName(team, lead.assigned_to);

  return (
    <div className="space-y-5">
      {/* Stage stepper */}
      <StageStepper stage={stage} />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {unassigned && !readOnly && (
          <Button variant="primary" isLoading={acting} leftIcon={<Hand className="w-4 h-4" />} onClick={onClaim}>
            Claim lead
          </Button>
        )}
        {!readOnly && next && (
          <Button variant="primary" isLoading={acting} rightIcon={<ArrowRight className="w-4 h-4" />} onClick={onAdvance}>
            {next === 'converted' ? 'Convert' : `Advance to ${STAGE_LABELS[next]}`}
          </Button>
        )}
        {!readOnly && (
          <>
            <Button variant="secondary" leftIcon={<CalendarPlus className="w-4 h-4" />} onClick={onBook}>
              Book appointment
            </Button>
            <Button variant="secondary" leftIcon={<Tag className="w-4 h-4" />} onClick={onOffer}>
              New offer
            </Button>
            <Button variant="ghost" leftIcon={<UserX2 className="w-4 h-4" />} onClick={onLost}>
              Mark lost
            </Button>
          </>
        )}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm p-4 bg-surface-2 border border-line rounded-xl">
        <MetaRow label="Assigned to" value={assignedName ?? (unassigned ? 'Unassigned' : '—')} />
        <MetaRow label="Source" value={lead.source?.name ?? '—'} />
        <MetaRow label="Branch" value={lead.branch?.name ?? '—'} />
        <MetaRow label="Created" value={fmtDateTime(lead.created_at)} />
        <MetaRow label="First contact" value={lead.first_contacted_at ? fmtDateTime(lead.first_contacted_at) : 'Not yet'} />
        <MetaRow label="Contact attempts" value={String(lead.contact_attempts ?? 0)} />
        {lead.interest && <MetaRow label="Interest" value={lead.interest} />}
        {lead.converted_member_id && <MetaRow label="Member" value="Linked" />}
      </div>

      {/* Conversion summary for converted leads */}
      {stage === 'converted' && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm p-4 bg-surface-2 border border-line rounded-xl">
          <MetaRow label="Final price" value={lead.final_price != null ? String(lead.final_price) : '—'} />
          <MetaRow label="Payment" value={labelize(lead.payment_method)} />
          <MetaRow label="Starts" value={fmtDate(lead.membership_start_date)} />
          <MetaRow label="Agreement" value={lead.agreement_ref ?? '—'} />
        </div>
      )}

      <QualificationForm lead={lead} readOnly={readOnly} onChanged={onChanged} />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-fg-faint">{label}</div>
      <div className="text-fg truncate">{value}</div>
    </div>
  );
}

function StageStepper({ stage }: { stage: string }) {
  const activeIdx = (ACTIVE_STAGES as readonly string[]).indexOf(stage);
  const steps = [...ACTIVE_STAGES, 'converted'];
  const currentIdx = stage === 'converted' ? steps.length - 1 : activeIdx;
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Pipeline position">
      {steps.map((s, i) => {
        const done = currentIdx > i || stage === 'converted';
        const current = currentIdx === i && stage !== 'converted';
        return (
          <li key={s} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className={cn('w-4 h-px', done || current ? 'bg-brand' : 'bg-line-strong')} />}
            <span className={cn(
              'px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap',
              current ? 'bg-brand text-brand-ink'
              : done  ? 'bg-brand/15 text-brand'
              :         'bg-surface-3 text-fg-faint',
            )}>
              {STAGE_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Qualification checklist (PATCH leads/{id}) ─────────────────── */

function QualificationForm({ lead, readOnly, onChanged }: { lead: any; readOnly: boolean; onChanged: () => void }) {
  const [form, setForm] = useState(() => ({
    name: lead.name ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    notes: lead.notes ?? '',
    score: lead.score ?? '',
    interest_level: lead.interest_level ?? '',
    location_fit: lead.location_fit ?? '',
    fitness_goal: lead.fitness_goal ?? '',
    budget_range: lead.budget_range ?? '',
    join_timeframe: lead.join_timeframe ?? '',
  }));
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('Name and phone are required.'); return; }
    setSaving(true);
    try {
      await salesApi(`leads/${lead.id}`, {
        method: 'PATCH',
        body: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          notes: form.notes.trim() || null,
          ...(form.score ? { score: form.score } : {}),
          interest_level: form.interest_level || null,
          location_fit: form.location_fit || null,
          fitness_goal: form.fitness_goal || null,
          budget_range: form.budget_range.trim() || null,
          join_timeframe: form.join_timeframe || null,
        },
      });
      toast.success('Lead updated');
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-surface-2 border border-line rounded-xl space-y-4">
      <h3 className="text-sm font-semibold text-fg">Contact & qualification</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} disabled={readOnly} />
        </Field>
        <Field label="Phone" required>
          <Input inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={readOnly} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={readOnly} />
        </Field>
        <Field label="Budget range">
          <Input value={form.budget_range} onChange={(e) => set('budget_range', e.target.value)}
            placeholder="e.g. 1000–1500 / month" disabled={readOnly} maxLength={50} />
        </Field>
      </div>

      {/* Score selector */}
      <div>
        <div className="text-sm font-medium text-fg mb-1.5">Score</div>
        <div className="flex gap-2" role="radiogroup" aria-label="Lead score">
          {(['hot', 'warm', 'cold'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={form.score === s}
              disabled={readOnly}
              onClick={() => set('score', s)}
              className={cn(
                'px-4 min-h-11 rounded-lg text-sm font-medium capitalize border transition-colors',
                form.score === s
                  ? s === 'hot' ? 'bg-danger-soft text-danger border-danger/40'
                  : s === 'warm' ? 'bg-warning-soft text-warning border-warning/40'
                  : 'bg-sky-500/15 text-sky-500 border-sky-500/40'
                  : 'bg-surface-3 text-fg-muted border-line hover:text-fg',
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Interest level">
          <Select value={form.interest_level} onChange={(e) => set('interest_level', e.target.value)} disabled={readOnly}>
            <option value="">—</option>
            {INTEREST_LEVELS.map((v) => <option key={v} value={v}>{labelize(v)}</option>)}
          </Select>
        </Field>
        <Field label="Location fit">
          <Select value={form.location_fit} onChange={(e) => set('location_fit', e.target.value)} disabled={readOnly}>
            <option value="">—</option>
            {LOCATION_FITS.map((v) => <option key={v} value={v}>{labelize(v)}</option>)}
          </Select>
        </Field>
        <Field label="Fitness goal">
          <Select value={form.fitness_goal} onChange={(e) => set('fitness_goal', e.target.value)} disabled={readOnly}>
            <option value="">—</option>
            {FITNESS_GOALS.map((v) => <option key={v} value={v}>{v === 'pt' ? 'PT' : labelize(v)}</option>)}
          </Select>
        </Field>
        <Field label="Join timeframe">
          <Select value={form.join_timeframe} onChange={(e) => set('join_timeframe', e.target.value)} disabled={readOnly}>
            <option value="">—</option>
            {JOIN_TIMEFRAMES.map((v) => <option key={v} value={v}>{JOIN_TIMEFRAME_LABELS[v]}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Notes">
        <Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={readOnly} />
      </Field>

      {!readOnly && (
        <Button variant="primary" onClick={save} isLoading={saving} className="w-full sm:w-auto">
          Save changes
        </Button>
      )}
    </div>
  );
}

/* ── History tab ────────────────────────────────────────────────── */

function StageHistory({ lead, team }: { lead: any; team: any[] }) {
  const entries: any[] = [...(lead.stage_history ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (entries.length === 0) {
    return <p className="text-sm text-fg-muted py-8 text-center">No stage changes recorded.</p>;
  }
  return (
    <ol className="space-y-3">
      {entries.map((h) => (
        <li key={h.id} className="flex gap-3">
          <div className="w-2 h-2 rounded-full bg-brand mt-2 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {h.from_stage ? (
                <>
                  <Badge size="sm" variant="neutral">{STAGE_LABELS[h.from_stage] ?? labelize(h.from_stage)}</Badge>
                  <ArrowRight className="w-3 h-3 text-fg-faint rtl:rotate-180" />
                </>
              ) : null}
              <Badge size="sm" variant={h.to_stage === 'converted' ? 'success' : h.to_stage === 'lost' ? 'danger' : 'brand'}>
                {STAGE_LABELS[h.to_stage] ?? labelize(h.to_stage)}
              </Badge>
              <span className="text-xs text-fg-faint ms-auto">{fmtDateTime(h.created_at)}</span>
            </div>
            <p className="text-xs text-fg-muted mt-0.5">
              {h.reason && <span>{h.reason}</span>}
              {teamMemberName(team, h.changed_by) && <span> — {teamMemberName(team, h.changed_by)}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
