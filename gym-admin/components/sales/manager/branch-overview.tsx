'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, ArrowRight, CalendarClock, CalendarX2,
  Check, Inbox, ListTodo, Loader2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, EmptyState } from '@/components/ui';
import type {
  SalesContext, TeamMember, Lead, Appointment, AppointmentStatus, SalesTask,
} from '@/lib/sales-types';
import { ageFrom, Card, dayEndIso, errMsg, dayStartIso, fmtTime, memberName, salesGet, salesPatch } from './lib';

interface Props {
  context: SalesContext;
  team: TeamMember[];
}

// `context` is part of the shell's props contract; the overview only
// needs the team roster today.
export default function BranchOverview({ team }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [unassigned, setUnassigned] = useState<{ count: number; oldest: string | null }>({ count: 0, oldest: null });
  const [slaCounts, setSlaCounts] = useState<{ unassigned: number; unqualified: number; uncontacted: number }>({ unassigned: 0, unqualified: 0, uncontacted: 0 });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [noShows, setNoShows] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [updatingAppt, setUpdatingAppt] = useState<string | null>(null);

  const goView = useCallback((view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const todayStart = dayStartIso(0);
      const todayEnd = dayEndIso(0);
      const weekAgoStart = dayStartIso(-7);
      const [unassignedRes, firstPageRes, apptRes, noShowRes, taskRes] = await Promise.all([
        salesGet<Lead[]>('leads?unassigned=1&per_page=100'),
        salesGet<Lead[]>('leads?per_page=100&page=1'),
        salesGet<Appointment[]>(`appointments?from=${todayStart}&to=${todayEnd}`),
        salesGet<Appointment[]>(`appointments?status=no_show&from=${weekAgoStart}&to=${todayEnd}`),
        salesGet<SalesTask[]>('tasks?scope=team&due=all'),
      ]);

      const uLeads = unassignedRes.data ?? [];
      const oldest = uLeads.reduce<string | null>((min, l) => {
        if (!l.created_at) return min;
        return !min || l.created_at < min ? l.created_at : min;
      }, null);
      setUnassigned({
        count: unassignedRes.meta?.total ?? unassignedRes.total ?? uLeads.length,
        oldest,
      });

      // SLA breach counts across the first pages of both lists.
      const seen = new Map<string, Lead>();
      [...uLeads, ...(firstPageRes.data ?? [])].forEach((l) => seen.set(String(l.id), l));
      let breachedUnassigned = 0, breachedUnqualified = 0, uncontacted = 0;
      seen.forEach((l) => {
        if (l.flags?.unassigned_sla_breach) breachedUnassigned += 1;
        if (l.flags?.unqualified_sla_breach) breachedUnqualified += 1;
        if (l.flags?.uncontacted) uncontacted += 1;
      });
      setSlaCounts({ unassigned: breachedUnassigned, unqualified: breachedUnqualified, uncontacted });

      setAppointments(apptRes.data ?? []);
      setNoShows(noShowRes.data ?? []);
      setTasks(taskRes.data ?? []);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setApptStatus = async (appt: Appointment, status: AppointmentStatus) => {
    setUpdatingAppt(appt.id);
    const prev = appointments;
    setAppointments((list) => list.map((a) => (a.id === appt.id ? { ...a, status } : a)));
    try {
      await salesPatch(`appointments/${appt.id}/status`, { status });
      toast.success(status === 'showed' ? 'Marked as showed' : 'Marked as no-show');
    } catch (e) {
      setAppointments(prev);
      toast.error(errMsg(e));
    } finally {
      setUpdatingAppt(null);
    }
  };

  // Open-task load per assignee.
  const taskLoad = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status === 'open');
    const byAssignee = new Map<string, { name: string; count: number; overdue: number }>();
    const now = new Date().toISOString();
    openTasks.forEach((t) => {
      const key = String(t.assigned_to ?? 'unassigned');
      const entry = byAssignee.get(key) ?? { name: memberName(team, t.assigned_to), count: 0, overdue: 0 };
      entry.count += 1;
      if (t.due_at && t.due_at < now) entry.overdue += 1;
      byAssignee.set(key, entry);
    });
    return [...byAssignee.values()].sort((a, b) => b.count - a.count);
  }, [tasks, team]);

  const totalBreaches = slaCounts.unassigned + slaCounts.unqualified + slaCounts.uncontacted;
  const maxTaskCount = Math.max(1, ...taskLoad.map((t) => t.count));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-fg-muted animate-spin" aria-label="Loading overview" />
      </div>
    );
  }

  if (error) {
    return (
      <Card padding="none">
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load the overview"
          description={error}
          action={<Button variant="secondary" onClick={load}>Retry</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Unassigned leads */}
        <Card variant="hoverable" onClick={() => goView('assign')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide">Unassigned leads</p>
              <p className={`text-2xl font-bold mt-1 ${unassigned.count > 0 ? 'text-warning' : 'text-fg'}`}>
                {unassigned.count}
              </p>
              <p className="text-xs text-fg-muted mt-1">
                {unassigned.count > 0 && unassigned.oldest
                  ? `Oldest waiting ${ageFrom(unassigned.oldest)}`
                  : 'Queue is clear'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-surface-3 border border-line flex items-center justify-center shrink-0">
              <Inbox className="w-[18px] h-[18px] text-fg-muted" />
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-brand mt-3">
            Open assignment queue <ArrowRight className="w-3 h-3" />
          </span>
        </Card>

        {/* SLA breaches */}
        <Card variant="hoverable" onClick={() => goView('pipeline')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide">SLA breaches</p>
              <p className={`text-2xl font-bold mt-1 ${totalBreaches > 0 ? 'text-danger' : 'text-fg'}`}>
                {totalBreaches}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {slaCounts.unassigned > 0 && <Badge variant="danger" size="sm">{slaCounts.unassigned} unassigned</Badge>}
                {slaCounts.unqualified > 0 && <Badge variant="warning" size="sm">{slaCounts.unqualified} unqualified</Badge>}
                {slaCounts.uncontacted > 0 && <Badge variant="warning" size="sm">{slaCounts.uncontacted} uncontacted</Badge>}
                {totalBreaches === 0 && <span className="text-xs text-fg-muted">All within SLA</span>}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-surface-3 border border-line flex items-center justify-center shrink-0">
              <AlertTriangle className="w-[18px] h-[18px] text-fg-muted" />
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-brand mt-3">
            View pipeline <ArrowRight className="w-3 h-3" />
          </span>
        </Card>

        {/* No-shows needing rebooking */}
        <Card variant="hoverable" onClick={() => goView('pipeline')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide">No-shows (7 days)</p>
              <p className={`text-2xl font-bold mt-1 ${noShows.length > 0 ? 'text-warning' : 'text-fg'}`}>
                {noShows.length}
              </p>
              <p className="text-xs text-fg-muted mt-1">
                {noShows.length > 0 ? 'Need rebooking' : 'Nothing to rebook'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-surface-3 border border-line flex items-center justify-center shrink-0">
              <CalendarX2 className="w-[18px] h-[18px] text-fg-muted" />
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-brand mt-3">
            Work the pipeline <ArrowRight className="w-3 h-3" />
          </span>
        </Card>

        {/* Team open tasks */}
        <Card variant="hoverable" onClick={() => goView('team')}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-fg-muted uppercase tracking-wide">Team open tasks</p>
              <p className="text-2xl font-bold text-fg mt-1">
                {taskLoad.reduce((s, t) => s + t.count, 0)}
              </p>
              <p className="text-xs text-fg-muted mt-1">
                {taskLoad.length > 0 ? `Across ${taskLoad.length} ${taskLoad.length === 1 ? 'person' : 'people'}` : 'No open tasks'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-surface-3 border border-line flex items-center justify-center shrink-0">
              <ListTodo className="w-[18px] h-[18px] text-fg-muted" />
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-brand mt-3">
            Manage team <ArrowRight className="w-3 h-3" />
          </span>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's appointments */}
        <Card padding="none">
          <Card.Header>
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <CalendarClock className="w-4 h-4 text-fg-muted" />
              <span>Today&apos;s appointments</span>
              <Badge variant="neutral" size="sm">{appointments.length}</Badge>
            </div>
          </Card.Header>
          <Card.Body>
            {appointments.length === 0 ? (
              <EmptyState size="sm" icon={CalendarClock} title="No appointments today" />
            ) : (
              <ul className="divide-y divide-line -my-2">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="text-xs font-mono text-fg-muted w-12 shrink-0">{fmtTime(a.scheduled_at)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg truncate">
                        {a.lead?.name ?? 'Lead'}
                        <span className="text-xs text-fg-faint ms-2 capitalize">{a.type.replace(/_/g, ' ')}</span>
                      </p>
                      <p className="text-xs text-fg-muted truncate">{memberName(team, a.lead?.assigned_to ?? a.host_id)}</p>
                    </div>
                    {a.status === 'scheduled' ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setApptStatus(a, 'showed')}
                          disabled={updatingAppt === a.id}
                          className="p-1.5 rounded-lg text-fg-muted hover:text-success hover:bg-surface-3 transition-colors disabled:opacity-50"
                          title="Mark showed"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setApptStatus(a, 'no_show')}
                          disabled={updatingAppt === a.id}
                          className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-surface-3 transition-colors disabled:opacity-50"
                          title="Mark no-show"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <Badge
                        size="sm"
                        variant={a.status === 'showed' ? 'success' : a.status === 'no_show' ? 'danger' : 'neutral'}
                      >
                        {a.status.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card.Body>
        </Card>

        {/* Task load per assignee */}
        <Card padding="none">
          <Card.Header>
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <ListTodo className="w-4 h-4 text-fg-muted" />
              <span>Open-task load</span>
            </div>
          </Card.Header>
          <Card.Body>
            {taskLoad.length === 0 ? (
              <EmptyState size="sm" icon={ListTodo} title="No open tasks across the team" />
            ) : (
              <ul className="space-y-3">
                {taskLoad.map((t) => (
                  <li key={t.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-fg">{t.name}</span>
                      <span className="text-fg-muted text-xs">
                        {t.count} open{t.overdue > 0 && <span className="text-danger"> · {t.overdue} overdue</span>}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${t.overdue > 0 ? 'bg-warning' : 'bg-brand'}`}
                        style={{ width: `${Math.round((t.count / maxTaskCount) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* No-show detail strip */}
      {noShows.length > 0 && (
        <Card padding="none">
          <Card.Header>
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <CalendarX2 className="w-4 h-4 text-fg-muted" />
              <span>No-shows needing rebooking</span>
              <Badge variant="warning" size="sm">{noShows.length}</Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <ul className="divide-y divide-line -my-2">
              {noShows.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg truncate">{a.lead?.name ?? 'Lead'}</p>
                    <p className="text-xs text-fg-muted">
                      Missed {ageFrom(a.scheduled_at)} ago · {memberName(team, a.lead?.assigned_to ?? a.host_id)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => goView('pipeline')} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Rebook
                  </Button>
                </li>
              ))}
            </ul>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
