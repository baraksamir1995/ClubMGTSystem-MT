'use client';

import { useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Users, CalendarDays, MapPin, Tag, ListChecks, Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Badge, Button, EmptyState, Modal, Tabs } from '@/components/ui';
import { can, type Permission } from '@/lib/get-permissions';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import { fmtDateTimeGym, parsePgTimestamp } from '@/lib/time';
import { fmtEventPrice, normalizeEvents, type BranchOption, type GymEvent, type PlanOption } from '@/lib/types/store-events';
import EventModal from './event-modal';
import RosterModal from './roster-modal';

type View = 'upcoming' | 'past';

/** An event is "past" once it has ended (or started, when it has no end). */
export function isPastEvent(e: GymEvent, now = Date.now()): boolean {
  const end = e.ends_at ?? e.starts_at;
  return parsePgTimestamp(end).getTime() < now;
}


export default function EventsPage({
  initialEvents, plans, branches, permissions,
}: {
  initialEvents: GymEvent[];
  plans: PlanOption[];
  branches: BranchOption[];
  permissions: Permission[] | null;
}) {
  const t    = useTranslations('events');
  const tc   = useTranslations('common');
  const tErr = useTranslations('common.errors');

  const [events, setEvents]     = useState<GymEvent[]>(initialEvents);
  const [view, setView]         = useState<View>('upcoming');
  const [editing, setEditing]   = useState<GymEvent | 'new' | null>(null);
  const [rosterFor, setRosterFor] = useState<GymEvent | null>(null);
  const [deleting, setDeleting] = useState<GymEvent | null>(null);
  const [busy, setBusy]         = useState(false);

  const canCreate = can(permissions, 'events', 'create');
  const canEdit   = can(permissions, 'events', 'edit');
  const canDelete = can(permissions, 'events', 'delete');

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: GymEvent[] = [];
    const pa: GymEvent[] = [];
    for (const e of events) (isPastEvent(e, now) ? pa : up).push(e);
    const ts = (e: GymEvent) => parsePgTimestamp(e.starts_at).getTime();
    up.sort((a, b) => ts(a) - ts(b));   // soonest first
    pa.sort((a, b) => ts(b) - ts(a));   // most recent first
    return { upcoming: up, past: pa };
  }, [events]);

  const list = view === 'upcoming' ? upcoming : past;

  const reload = async () => {
    try {
      const res = await fetch('/api/events');
      const json = await res.json().catch(() => null);
      if (res.ok) setEvents(normalizeEvents(json?.data ?? json ?? []));
    } catch { /* keep current list */ }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${deleting.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.code === 'has_paid_registrations'
          ? t('delete.hasPaid')
          : apiErrorMessage(json, res.status, tErr));
        return;
      }
      setEvents(prev => prev.filter(e => e.id !== deleting.id));
      toast.success(t('delete.done'));
      setDeleting(null);
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
          <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
        </div>
        {canCreate && (
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>{t('newEvent')}</Button>
        )}
      </div>

      <Tabs value={view} onValueChange={v => setView(v as View)}>
        <Tabs.List>
          <Tabs.Trigger value="upcoming">{t('tabs.upcoming', { count: upcoming.length })}</Tabs.Trigger>
          <Tabs.Trigger value="past">{t('tabs.past', { count: past.length })}</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {list.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl">
          <EmptyState
            icon={CalendarDays}
            title={view === 'upcoming' ? t('empty.upcoming') : t('empty.past')}
            description={view === 'upcoming' ? t('empty.description') : undefined}
            action={view === 'upcoming' && canCreate ? (
              <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>{t('newEvent')}</Button>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map(e => (
            <article key={e.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface-2">
              <div className="relative h-32 bg-surface-3">
                {e.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image on external host
                  <img src={e.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-fg-faint">
                    <ImageIcon className="h-6 w-6" aria-hidden />
                  </div>
                )}
                <div className="absolute top-2 start-2 flex gap-1.5">
                  {e.is_published
                    ? <Badge variant="success" size="sm">{t('published')}</Badge>
                    : <Badge variant="neutral" size="sm">{t('draft')}</Badge>}
                  {e.is_paid
                    ? <Badge variant="brand" size="sm">{fmtEventPrice(e)}</Badge>
                    : <Badge variant="neutral" size="sm">{t('free')}</Badge>}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="font-semibold text-fg truncate">{e.title}</h2>
                <p className="flex items-center gap-1.5 text-sm text-fg-muted">
                  <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                  <span className="truncate">
                    {fmtDateTimeGym(e.starts_at)}
                    {e.ends_at ? ` → ${fmtDateTimeGym(e.ends_at)}` : ''}
                  </span>
                </p>
                {e.location && (
                  <p className="flex items-center gap-1.5 text-sm text-fg-muted">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    <span className="truncate">{e.location}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-fg-faint flex-shrink-0" aria-hidden />
                  {e.plan_targets.length === 0
                    ? <span className="text-xs text-fg-faint">{t('allMembers')}</span>
                    : e.plan_targets.map(p => <Badge key={p.id} variant="neutral" size="sm">{p.name}</Badge>)}
                </div>
                {e.configurations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-fg-faint flex-shrink-0" aria-hidden />
                    <span className="text-xs text-fg-muted">{e.configuration_label || t('optionFallback')}:</span>
                    {e.configurations.map(c => <Badge key={c.id} variant="neutral" size="sm">{c.name}</Badge>)}
                  </div>
                )}

                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                  <Stat label={t('stats.registered')} value={e.capacity ? `${e.registrations_count}/${e.capacity}` : e.registrations_count} />
                  <Stat label={t('stats.pending')} value={e.pending_count} tone={e.pending_count > 0 ? 'warning' : undefined} />
                  <Stat label={t('stats.attended')} value={e.attended_count} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Button variant="secondary" size="sm" leftIcon={<Users className="w-4 h-4" />} onClick={() => setRosterFor(e)}>
                    {t('roster.open')}
                  </Button>
                  {canEdit && (
                    <Button variant="ghost" size="sm" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => setEditing(e)}>
                      {tc('edit')}
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 className="w-4 h-4" />} onClick={() => setDeleting(e)}>
                      {tc('delete')}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <EventModal
          event={editing === 'new' ? null : editing}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      {rosterFor && (
        <RosterModal
          event={rosterFor}
          branches={branches}
          canEdit={canEdit}
          canMarkPaid={can(permissions, 'payments', 'create')}
          onClose={(changed) => { setRosterFor(null); if (changed) reload(); }}
        />
      )}

      {deleting && (
        <Modal open onClose={() => setDeleting(null)} size="sm" closeOnBackdrop={false}>
          <Modal.Header>{t('delete.title')}</Modal.Header>
          <Modal.Body>
            <p className="text-sm text-fg-muted">{t('delete.body', { title: deleting.title })}</p>
            {deleting.registrations_count > 0 && (
              <p className="text-sm text-warning">{t('delete.hasRegistrations', { count: deleting.registrations_count })}</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>{tc('cancel')}</Button>
            <Button variant="danger" fullWidth isLoading={busy} onClick={confirmDelete}>{tc('delete')}</Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warning' }) {
  return (
    <div>
      <p className={`text-base font-semibold tabular-nums ${tone === 'warning' ? 'text-warning' : 'text-fg'}`}>{value}</p>
      <p className="text-[11px] text-fg-faint">{label}</p>
    </div>
  );
}
