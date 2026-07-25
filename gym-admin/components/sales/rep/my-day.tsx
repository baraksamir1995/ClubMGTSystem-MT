'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2, ClipboardList, PhoneMissed, Inbox, CalendarDays,
  Hand, Check, X, Loader2,
} from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  salesApi, SalesApiError, labelize, fmtTime, fmtDateTime,
  type SalesContext, type TeamMember,
} from './lib';
import { ScoreChip, ContactLinks, FlagBadges } from './chips';
import LeadDetail from './lead-detail';

interface Props {
  context: SalesContext;
  team: TeamMember[];
}

/**
 * "My Day" — the rep's floor view: today's tasks, uncontacted new
 * leads, the unassigned claim queue, and today's appointments.
 */
export default function MyDay({ context, team }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [uncontacted, setUncontacted] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
    const userId = context?.user_id ?? '';

    const [tasksRes, newLeadsRes, unassignedRes, apptsRes] = await Promise.allSettled([
      salesApi<{ data: any[] }>('tasks'),
      salesApi<{ data: any[] }>(`leads?stage=new&assigned_to=${encodeURIComponent(userId)}&per_page=100`),
      salesApi<{ data: any[] }>('leads?unassigned=1&per_page=100'),
      salesApi<{ data: any[] }>(`appointments?from=${encodeURIComponent(dayStart.toISOString())}&to=${encodeURIComponent(dayEnd.toISOString())}`),
    ]);

    if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data ?? []);
    if (newLeadsRes.status === 'fulfilled') {
      setUncontacted((newLeadsRes.value.data ?? []).filter((l: any) => l.flags?.uncontacted));
    }
    if (unassignedRes.status === 'fulfilled') {
      setUnassigned((unassignedRes.value.data ?? []).filter(
        (l: any) => l.stage !== 'converted' && l.stage !== 'lost',
      ));
    }
    if (apptsRes.status === 'fulfilled') setAppointments(apptsRes.value.data ?? []);
    setLoading(false);
  }, [context?.user_id]);

  useEffect(() => { load(); }, [load]);

  const completeTask = async (id: string) => {
    setBusyId(id);
    try {
      await salesApi(`tasks/${id}`, { method: 'PATCH', body: { status: 'done' } });
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success('Task done');
    } catch (e) {
      toast.error(e instanceof SalesApiError ? e.message : 'Network error');
    } finally {
      setBusyId(null);
    }
  };

  const claim = async (id: string) => {
    setBusyId(id);
    try {
      await salesApi(`leads/${id}/claim`, { method: 'POST' });
      toast.success('Lead claimed — it’s yours');
      load();
    } catch (e) {
      toast.error(e instanceof SalesApiError ? e.message : 'Network error');
      load(); // someone else may have claimed it
    } finally {
      setBusyId(null);
    }
  };

  const markAppointment = async (id: string, status: 'showed' | 'no_show') => {
    setBusyId(id);
    try {
      await salesApi(`appointments/${id}/status`, { method: 'PATCH', body: { status } });
      toast.success(status === 'showed' ? 'Marked as showed' : 'Marked as no-show');
      load();
    } catch (e) {
      toast.error(e instanceof SalesApiError ? e.message : 'Network error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-fg-muted inline" /></div>;
  }

  const now = Date.now();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Today's tasks ── */}
      <Section icon={ClipboardList} title="Today's tasks" count={tasks.length}>
        {tasks.length === 0 ? (
          <EmptyState size="sm" icon={CheckCircle2} title="All caught up"
            description="No open tasks due today." />
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((t) => {
              const overdue = new Date(t.due_at).getTime() < now;
              return (
                <li key={t.id}
                  className={cn('flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-3 transition-colors',
                    overdue && 'bg-danger-soft/40')}
                  onClick={() => t.lead_id && setOpenLeadId(t.lead_id)}>
                  <button
                    aria-label="Mark done"
                    disabled={busyId === t.id}
                    onClick={(e) => { e.stopPropagation(); completeTask(t.id); }}
                    className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full border border-line-strong text-fg-faint hover:text-success hover:border-success transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-fg truncate">{t.title}</div>
                    <div className="text-xs text-fg-muted mt-0.5">
                      {t.lead?.name && <span>{t.lead.name} · </span>}
                      <span className={overdue ? 'text-danger font-medium' : ''}>
                        {overdue ? 'Overdue — ' : 'Due '}{fmtDateTime(t.due_at)}
                      </span>
                    </div>
                  </div>
                  {t.lead?.phone && <ContactLinks phone={t.lead.phone} compact />}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* ── Uncontacted new leads ── */}
      <Section icon={PhoneMissed} title="Uncontacted new leads" count={uncontacted.length}>
        {uncontacted.length === 0 ? (
          <EmptyState size="sm" icon={CheckCircle2} title="Nothing waiting"
            description="Every new lead of yours has been contacted." />
        ) : (
          <ul className="divide-y divide-line">
            {uncontacted.map((l) => (
              <li key={l.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-3 transition-colors"
                onClick={() => setOpenLeadId(l.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg truncate">{l.name}</span>
                    <ScoreChip score={l.score} />
                  </div>
                  <div className="text-xs text-fg-muted mt-0.5" dir="ltr">{l.phone}</div>
                  <FlagBadges flags={l.flags} className="mt-1" />
                </div>
                <ContactLinks phone={l.phone} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Unassigned queue ── */}
      <Section icon={Inbox} title="Unassigned queue" count={unassigned.length}>
        {unassigned.length === 0 ? (
          <EmptyState size="sm" icon={CheckCircle2} title="Queue is clear"
            description="No leads waiting to be claimed." />
        ) : (
          <ul className="divide-y divide-line">
            {unassigned.map((l) => (
              <li key={l.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-3 transition-colors"
                onClick={() => setOpenLeadId(l.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-fg truncate">{l.name}</span>
                    <ScoreChip score={l.score} />
                  </div>
                  <div className="text-xs text-fg-muted mt-0.5">
                    {l.source?.name ?? 'Unknown source'}
                  </div>
                  <FlagBadges flags={l.flags} className="mt-1" />
                </div>
                <Button size="sm" variant="primary" isLoading={busyId === l.id}
                  leftIcon={<Hand className="w-3.5 h-3.5" />}
                  onClick={(e) => { e.stopPropagation(); claim(l.id); }}>
                  Claim
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Today's appointments ── */}
      <Section icon={CalendarDays} title="Today's appointments" count={appointments.length}>
        {appointments.length === 0 ? (
          <EmptyState size="sm" icon={CalendarDays} title="No visits today"
            description="Booked tours and trials for today show up here." />
        ) : (
          <ul className="divide-y divide-line">
            {appointments.map((a) => {
              const past = new Date(a.scheduled_at).getTime() <= now;
              const pending = a.status === 'scheduled';
              return (
                <li key={a.id}
                  className="px-4 py-3 cursor-pointer hover:bg-surface-3 transition-colors"
                  onClick={() => a.lead_id && setOpenLeadId(a.lead_id)}>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-fg w-12 shrink-0">{fmtTime(a.scheduled_at)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-fg truncate">{a.lead?.name ?? 'Lead'}</div>
                      <div className="text-xs text-fg-muted">{labelize(a.type)}{!pending && ` · ${labelize(a.status)}`}</div>
                    </div>
                    {a.lead?.phone && <ContactLinks phone={a.lead.phone} compact />}
                  </div>
                  {pending && past && (
                    <div className="flex gap-2 mt-2 ps-[3.75rem]" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="secondary" disabled={busyId === a.id}
                        leftIcon={<Check className="w-3.5 h-3.5 text-success" />}
                        onClick={() => markAppointment(a.id, 'showed')}>
                        Showed
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busyId === a.id}
                        leftIcon={<X className="w-3.5 h-3.5 text-danger" />}
                        onClick={() => markAppointment(a.id, 'no_show')}>
                        No-show
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {openLeadId && (
        <LeadDetail leadId={openLeadId} context={context} team={team}
          onClose={() => setOpenLeadId(null)} onChanged={load} />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, count, children }: {
  icon: typeof ClipboardList;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-2 border border-line rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <Icon className="w-4 h-4 text-fg-muted" />
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <span className="text-[11px] bg-surface-4 text-fg-muted px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      {children}
    </section>
  );
}
