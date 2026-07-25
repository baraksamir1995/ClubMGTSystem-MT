'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, CalendarDays, Dumbbell, Pencil, XCircle, Search, X, ChevronLeft, ChevronRight, Users, MapPin, Clock, CalendarRange, Layers, Star, Tag } from 'lucide-react';
import { fmt12 } from '@/lib/time';
import { useRefresh } from '@/lib/use-refresh';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import ClassModal from './class-modal';
import SessionModal from './session-modal';
import CancelSessionModal from './cancel-session-modal';
import SessionBookingsModal from './session-bookings-modal';
import ScheduleTab from './schedule-tab';
import SessionsTracker, { type SessionsMember } from '@/components/sessions/sessions-tracker';
import ReviewsTab from './reviews-tab';
import ClassTypesManager from './class-types-manager';
import type { GymClass, ClassSession, GymBranch, GymStudio } from '@/app/dashboard/classes/page';
import type { PageMeta, TrackerStats } from '@/lib/sessions-tracker';
import { can, type Permission } from '@/lib/get-permissions';
import { Badge, Button, Tabs } from '@/components/ui';

const PAGE_SIZE = 10;

interface Props {
  initialClasses: GymClass[];
  initialSessions: ClassSession[];
  initialSessionsMembers: SessionsMember[];
  initialSessionsMeta: PageMeta;
  initialSessionsStats: TrackerStats;
  initialClassTypes: { id: string; name: string }[];
  initialBranches: GymBranch[];
  initialStudios: GymStudio[];
  gymId: string;
  gym: { name: string; logo_url: string | null };
  permissions: Permission[] | null;
}

const TYPE_COLORS: Record<string, string> = {
  yoga:'bg-brand/10 text-brand', pilates:'bg-accent/15 text-accent',
  spinning:'bg-accent/15 text-accent', boxing:'bg-danger-soft text-danger',
  hiit:'bg-danger-soft text-danger', strength:'bg-info-soft text-info',
  cardio:'bg-success-soft text-success', dance:'bg-accent/15 text-accent',
  swimming:'bg-info-soft text-info', general:'bg-surface-3 text-fg-muted',
};

export default function ClassesPageClient({ initialClasses, initialSessions, initialSessionsMembers, initialSessionsMeta, initialSessionsStats, initialClassTypes, initialBranches, initialStudios, gymId, gym, permissions }: Props) {
  const refresh = useRefresh();
  const t = useTranslations('classes');
  const tc = useTranslations('common');
  const [classes, setClasses]       = useState<GymClass[]>(initialClasses);
  const [sessions, setSessions]     = useState<ClassSession[]>(initialSessions);
  const [classTypes, setClassTypes] = useState<{ id: string; name: string }[]>(initialClassTypes);
  const [activeTab, setActiveTab] = useState<'sessions' | 'schedule' | 'classes' | 'tracker' | 'reviews' | 'class-types'>('sessions');


  // Modals
  const [classModal, setClassModal]         = useState<{ open: boolean; existing?: GymClass }>({ open: false });
  const [sessionModal, setSessionModal]     = useState<{ open: boolean; existing?: ClassSession; defaultClassId?: string; defaultDate?: string; defaultBranchId?: string }>({ open: false });
  const [cancelModal, setCancelModal]     = useState<ClassSession | null>(null);
  const [bookingsSession, setBookingsSession] = useState<ClassSession | null>(null);

  // Filters
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('upcoming');
  const [page, setPage]             = useState(1);

  // Classes tab filters
  const [classSearch, setClassSearch] = useState('');
  const [typeFilter, setTypeFilter]   = useState('all');
  const [classPage, setClassPage]     = useState(1);
  const CLASS_PAGE_SIZE = 9;

  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const monthStart = today.slice(0, 7) + '-01'; // YYYY-MM-01
  const nextMonthStart = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
    return d.toLocaleDateString('en-CA');
  })();

  const filteredSessions = useMemo(() => {
    let list = [...sessions];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.class_name.toLowerCase().includes(q) || s.instructor?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q));
    }
    if (statusFilter === 'upcoming') list = list.filter(s => s.session_date >= monthStart && s.session_date < nextMonthStart && s.status === 'scheduled');
    else if (statusFilter === 'past') list = list.filter(s => s.session_date < today || s.status === 'completed');
    else if (statusFilter === 'cancelled') list = list.filter(s => s.status === 'cancelled');
    list.sort((a, b) => {
      const d = statusFilter === 'past' ? -1 : 1;
      return d * (a.session_date === b.session_date ? a.start_time.localeCompare(b.start_time) : a.session_date.localeCompare(b.session_date));
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, search, statusFilter, today]);

  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE);
  const paginatedSessions = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filteredClasses = useMemo(() => {
    let list = [...classes];
    if (classSearch.trim()) list = list.filter(c => c.name.toLowerCase().includes(classSearch.toLowerCase()));
    if (typeFilter !== 'all') list = list.filter(c => c.class_type === typeFilter);
    return list;
  }, [classes, classSearch, typeFilter]);

  const classTotalPages = Math.ceil(filteredClasses.length / CLASS_PAGE_SIZE);
  const paginatedClasses = filteredClasses.slice((classPage - 1) * CLASS_PAGE_SIZE, classPage * CLASS_PAGE_SIZE);

  // Reset class page on filter change
  useEffect(() => { setClassPage(1); }, [classSearch, typeFilter]);

  const toggleClass = async (cls: GymClass) => {
    try {
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cls.is_active }),
      });
      if (!res.ok) { toast.error(t('classes.failedUpdate')); return; }
      setClasses(prev => prev.map(c => c.id === cls.id ? { ...c, is_active: !c.is_active } : c));
      toast.success(cls.is_active ? t('classes.deactivated') : t('classes.activated'));
    } catch { toast.error(tc('networkError')); }
  };

  const selectCls = 'bg-surface-3 border border-line text-sm text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors';

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">{t('pageTitle')}</h1>
            <p className="text-sm text-fg-muted mt-0.5">{t('pageSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'classes' && can(permissions, 'classes', 'create') && (
              <Button variant="primary" onClick={() => setClassModal({ open: true })} leftIcon={<Plus className="w-4 h-4" />}>
                {t('classes.newClass')}
              </Button>
            )}
            {activeTab === 'sessions' && can(permissions, 'classes', 'create') && (
              <Button variant="primary" onClick={() => setSessionModal({ open: true })}
                disabled={classes.filter(c => c.is_active).length === 0}
                title={classes.filter(c => c.is_active).length === 0 ? t('sessionModal.titleNew') : ''}
                leftIcon={<Plus className="w-4 h-4" />}>
                {t('sessionModal.titleNew')}
              </Button>
            )}
            {activeTab === 'schedule' && (
              <div className="text-xs text-fg-faint py-2">{t('schedule.weeklyTemplate')}</div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <Tabs.List>
            {([
              ['sessions',    CalendarDays,  t('tabs.sessions'),    sessions.filter(s => s.status === 'scheduled' && s.session_date >= monthStart && s.session_date < nextMonthStart).length],
              ['schedule',    CalendarRange, t('tabs.schedule'),    null],
              ['classes',     Dumbbell,      t('tabs.classes'),     classes.filter(c => c.is_active).length],
              ['tracker',     Layers,        t('tabs.tracker'),     initialSessionsStats.members],
              ['reviews',     Star,          t('tabs.reviews'),     null],
              ['class-types', Tag,           t('tabs.classTypes'),  null],
            ] as const).map(([tab, Icon, label, count]) => (
              <Tabs.Trigger key={tab} value={tab} icon={Icon}>
                {label}
                {count !== null && (
                  <Badge variant="neutral" size="sm" className="ms-1">{count}</Badge>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>

        {/* ── Sessions Tab ── */}
        {activeTab === 'sessions' && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t('sessions.thisMonth'), value: sessions.filter(s => s.session_date >= monthStart && s.session_date < nextMonthStart && s.status === 'scheduled').length, color: 'text-brand', filter: 'upcoming' },
                { label: t('sessions.past'),      value: sessions.filter(s => s.session_date < today).length,                              color: 'text-fg-muted',   filter: 'past' },
                { label: t('sessions.cancelled'), value: sessions.filter(s => s.status === 'cancelled').length,                            color: 'text-danger',    filter: 'cancelled' },
              ].map(s => (
                <button key={s.filter} onClick={() => { setStatusFilter(s.filter); setPage(1); }}
                  className={`bg-surface-2 border rounded-xl p-4 text-start transition-colors ${statusFilter === s.filter ? "border-brand" : "border-line hover:border-line-strong"}`}>
                  <p className="text-xs text-fg-muted mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </button>
              ))}
            </div>

            {/* Search + Filter */}
            <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder={t('sessions.searchPlaceholder')}
                  className="w-full ps-9 pe-9 py-2 bg-surface border border-line rounded-lg text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand" />
                {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute end-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg"><X aria-hidden className="w-4 h-4" /></button>}
              </div>
              <div className="flex gap-3 items-center">
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
                  <option value="upcoming">{t('sessions.upcoming')}</option>
                  <option value="past">{t('sessions.past')}</option>
                  <option value="cancelled">{t('sessions.cancelled')}</option>
                  <option value="all">{t('sessions.allSessions')}</option>
                </select>
                <span className="ms-auto text-xs text-fg-faint">{t('sessions.count', { count: filteredSessions.length })}</span>
              </div>
            </div>

            {/* Sessions table / cancellation history */}
            {statusFilter === 'cancelled' ? (
              /* ── Cancellation History ── */
              paginatedSessions.length === 0 ? (
                <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
                  <XCircle className="w-10 h-10 text-fg-faint mx-auto mb-3" />
                  <p className="text-fg-muted text-sm">{t('sessions.noCancelled')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedSessions.map(session => (
                    <div key={session.id} className="bg-surface-2 border border-line rounded-xl p-5">
                      <div className="flex items-start justify-between gap-4">
                        {/* Start: class info */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: session.color }} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-fg font-semibold">{session.class_name}</p>
                              <Badge variant="danger" size="sm">{t('sessions.cancelled')}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-fg-muted">
                              <span>
                                {new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock aria-hidden className="w-3 h-3" />
                                {fmt12(session.start_time)} – {fmt12(session.end_time)}
                              </span>
                              {session.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin aria-hidden className="w-3 h-3" />{session.location}
                                </span>
                              )}
                              {session.instructor && (
                                <span className="flex items-center gap-1">
                                  <Users aria-hidden className="w-3 h-3" />{session.instructor}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* End: members + cancelled at */}
                        <div className="flex-shrink-0 text-end">
                          <div className="flex items-center gap-1 text-xs text-fg-muted justify-end">
                            <Users aria-hidden className="w-3 h-3" />
                            <span>
                              {session.booked_count !== 1
                                ? t('sessions.bookedCountPlural', { count: session.booked_count })
                                : t('sessions.bookedCount', { count: session.booked_count })}
                            </span>
                          </div>
                          {session.cancelled_at && (
                            <p className="text-xs text-fg-faint mt-1">
                              {new Date(session.cancelled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' '}{t('sessions.cancelledAt')}{' '}
                              {new Date(session.cancelled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Reason */}
                      {session.cancel_reason && (
                        <div className="mt-3 pt-3 border-t border-line">
                          <p className="text-xs text-fg-faint mb-1 font-medium uppercase tracking-wide">{t('sessions.reasonForCancellation')}</p>
                          <p className="text-sm text-fg-muted">{session.cancel_reason}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-1 py-2">
                      <p className="text-xs text-fg-faint">{tc('showingResults', { from: (page-1)*PAGE_SIZE+1, to: Math.min(page*PAGE_SIZE, filteredSessions.length), total: filteredSessions.length })}</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} aria-label="Previous page" className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 transition-colors"><ChevronLeft aria-hidden className="w-4 h-4" /></button>
                        {Array.from({ length: totalPages }, (_, i) => i+1).map(n => (
                          <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 text-xs rounded-lg transition-colors ${n===page ? "bg-brand text-brand-ink" : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>{n}</button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} aria-label="Next page" className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 transition-colors"><ChevronRight aria-hidden className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* ── Regular sessions table ── */
              <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
                {paginatedSessions.length === 0 ? (
                  <div className="p-12 text-center">
                    <CalendarDays className="w-10 h-10 text-fg-faint mx-auto mb-3" />
                    <p className="text-fg-muted text-sm">{sessions.length === 0 ? t('sessions.noScheduled') : t('sessions.noMatch')}</p>
                    {sessions.length === 0 && classes.filter(c => c.is_active).length > 0 && can(permissions, 'classes', 'create') && (
                      <Button variant="primary" className="mt-4" onClick={() => setSessionModal({ open: true })} leftIcon={<Plus className="w-4 h-4" />}>
                        {t('sessions.scheduleFirst')}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                            <th scope="col" className="text-start px-5 py-3">{t('sessions.colClass')}</th>
                            <th scope="col" className="text-start px-5 py-3">{t('sessions.colDate')}</th>
                            <th scope="col" className="text-start px-5 py-3">{t('sessions.colTime')}</th>
                            <th scope="col" className="text-start px-5 py-3">{t('sessions.colLocation')}</th>
                            <th scope="col" className="text-start px-5 py-3">{t('sessions.colCapacity')}</th>
                            <th scope="col" className="text-start px-5 py-3">{t('sessions.colStatus')}</th>
                            <th scope="col" className="text-end px-5 py-3">{t('sessions.colActions')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {paginatedSessions.map(session => (
                            <tr key={session.id} className="hover:bg-surface-3/30 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: session.color }} />
                                  <div>
                                    <p className="text-fg font-medium">{session.class_name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <p className="text-xs text-fg-faint capitalize">{session.class_type}</p>
                                      {session.session_type === 'popup' && (
                                        <Badge variant="warning" size="sm">{t('sessions.popup')}</Badge>
                                      )}
                                      {session.session_type === 'recurring' && (
                                        <Badge variant="brand" size="sm">{t('sessions.recurring')}</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-fg-muted">
                                {new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1 text-fg-muted text-xs">
                                  <Clock aria-hidden className="w-3 h-3" />
                                  {fmt12(session.start_time)} – {fmt12(session.end_time)}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-fg-muted text-xs">
                                {session.location ? <span className="flex items-center gap-1"><MapPin aria-hidden className="w-3 h-3" />{session.location}</span> : '—'}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1 text-xs text-fg-muted">
                                  <Users aria-hidden className="w-3 h-3" />
                                  {session.booked_count}{session.capacity ? `/${session.capacity}` : ''}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                {session.status === 'scheduled' && (
                                  <Badge variant="success">{t('sessions.statusScheduled')}</Badge>
                                )}
                                {session.status === 'completed' && (
                                  <Badge variant="neutral">{t('sessions.statusCompleted')}</Badge>
                                )}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setBookingsSession(session)}
                                    title={t('sessions.titleViewBookings')}
                                    className="p-1.5 rounded-lg text-fg-faint hover:text-info hover:bg-info-soft transition-colors">
                                    <Users className="w-4 h-4" />
                                  </button>
                                  {session.status === 'scheduled' && can(permissions, 'classes', 'edit') && (
                                    <button onClick={() => setSessionModal({ open: true, existing: session })}
                                      title={t('sessions.titleEditSession')}
                                      className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors">
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                  )}
                                  {session.status === 'scheduled' && can(permissions, 'classes', 'delete') && (
                                    <button onClick={() => setCancelModal(session)}
                                      title={t('sessions.titleCancelSession')}
                                      className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors">
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-line">
                        <p className="text-xs text-fg-faint">{tc('showingResults', { from: (page-1)*PAGE_SIZE+1, to: Math.min(page*PAGE_SIZE, filteredSessions.length), total: filteredSessions.length })}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} aria-label="Previous page" className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 transition-colors"><ChevronLeft aria-hidden className="w-4 h-4" /></button>
                          {Array.from({ length: totalPages }, (_, i) => i+1).map(n => (
                            <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 text-xs rounded-lg transition-colors ${n===page ? "bg-brand text-brand-ink" : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>{n}</button>
                          ))}
                          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} aria-label="Next page" className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 transition-colors"><ChevronRight aria-hidden className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Schedule Tab ── */}
        {activeTab === 'schedule' && (
          <ScheduleTab
            sessions={sessions}
            classes={classes}
            branches={initialBranches}
            permissions={permissions}
            onCreateSession={(date, branchId) => setSessionModal({ open: true, defaultDate: date, defaultBranchId: branchId })}
            onEditSession={s => setSessionModal({ open: true, existing: s })}
            onCancelSession={s => setCancelModal(s)}
            onViewBookings={s => setBookingsSession(s)}

            onPublished={() => setSessions(prev => prev.map(s => ({ ...s, is_published: true })))}
            onStopRecurring={async (templateId) => {
              if (!window.confirm(t('schedule.stopRecurringConfirm'))) return;
              try {
                const res = await fetch(`/api/sessions/recurring/${templateId}/stop`, { method: 'POST' });
                if (!res.ok) { toast.error(t('schedule.failedToStopRecurring')); return; }
                setSessions(prev => prev.map(s =>
                  s.recurring_template_id === templateId && s.session_date > today
                    ? { ...s, status: 'cancelled' }
                    : s
                ));
                toast.success(t('schedule.stopRecurringSuccess'));
              } catch { toast.error(tc('networkError')); }
            }}
          />
        )}

        {/* ── Classes Tab ── */}
        {activeTab === 'classes' && (
          <>
            {/* Search */}
            <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
                <input value={classSearch} onChange={e => setClassSearch(e.target.value)}
                  placeholder={t('classes.searchPlaceholder')}
                  className="w-full ps-9 pe-9 py-2 bg-surface border border-line rounded-lg text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand" />
                {classSearch && <button onClick={() => setClassSearch('')} aria-label="Clear search" className="absolute end-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg"><X aria-hidden className="w-4 h-4" /></button>}
              </div>
              <div className="flex gap-3 items-center">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
                  <option value="all">{t('classes.allTypes')}</option>
                  {classTypes.map(tp => (
                    <option key={tp.id} value={tp.name} className="capitalize">{tp.name.charAt(0).toUpperCase()+tp.name.slice(1)}</option>
                  ))}
                </select>
                <span className="ms-auto text-xs text-fg-faint">{t('classes.count', { count: filteredClasses.length })}</span>
              </div>
            </div>

            {/* Classes grid */}
            {filteredClasses.length === 0 ? (
              <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
                <Dumbbell className="w-10 h-10 text-fg-faint mx-auto mb-3" />
                <p className="text-fg-muted text-sm">{classes.length === 0 ? t('classes.noClassesYet') : t('classes.noMatch')}</p>
                {classes.length === 0 && can(permissions, 'classes', 'create') && (
                  <Button variant="primary" className="mt-4" onClick={() => setClassModal({ open: true })} leftIcon={<Plus className="w-4 h-4" />}>
                    {t('classes.createFirst')}
                  </Button>
                )}
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedClasses.map(cls => {
                  const sessionCount = sessions.filter(s => s.class_id === cls.id && s.session_date >= today && s.status === 'scheduled').length;
                  const typeCls = TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.general;
                  return (
                    <div key={cls.id} className={`bg-surface-2 border rounded-xl p-5 transition-colors ${cls.is_active ? "border-line" : "border-line opacity-60"}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
                          <div>
                            <p className="text-fg font-semibold leading-tight">{cls.name}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize mt-1 inline-block ${typeCls}`}>{cls.class_type}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {can(permissions, 'classes', 'edit') && (
                            <button onClick={() => setClassModal({ open: true, existing: cls })}
                              aria-label={`Edit ${cls.name}`}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors">
                              <Pencil aria-hidden className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        {cls.location && <p className="text-xs text-fg-muted">📍 {cls.location}</p>}
                        {cls.description && <p className="text-xs text-fg-faint line-clamp-2">{cls.description}</p>}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-line">
                        <span className="text-xs text-fg-muted">
                          {sessionCount !== 1 ? t('classes.upcomingSessionsPlural', { count: sessionCount }) : t('classes.upcomingSessions', { count: sessionCount })}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {can(permissions, 'classes', 'create') && (
                            <button onClick={() => setSessionModal({ open: true, defaultClassId: cls.id })}
                              disabled={!cls.is_active}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand/15 hover:bg-brand/25 text-brand text-xs font-medium transition-colors disabled:opacity-40">
                              <Plus className="w-3 h-3" /> {t('classes.addSession')}
                            </button>
                          )}
                          {can(permissions, 'classes', 'edit') && (
                            <button onClick={() => toggleClass(cls)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${cls.is_active ? 'bg-surface-3 hover:bg-surface-4 text-fg-muted' : 'bg-success-soft hover:bg-success/25 text-success'}`}>
                              {cls.is_active ? t('classes.deactivate') : t('classes.activate')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {classTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-fg-faint">
                    {tc('showingResults', { from: (classPage - 1) * CLASS_PAGE_SIZE + 1, to: Math.min(classPage * CLASS_PAGE_SIZE, filteredClasses.length), total: filteredClasses.length })}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setClassPage(p => Math.max(1, p - 1))} disabled={classPage === 1}
                      aria-label="Previous page"
                      className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft aria-hidden className="w-4 h-4" />
                    </button>
                    {Array.from({ length: classTotalPages }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setClassPage(n)}
                        className={`w-8 h-8 text-xs rounded-lg transition-colors ${n === classPage ? 'bg-brand text-brand-ink font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>
                        {n}
                      </button>
                    ))}
                    <button onClick={() => setClassPage(p => Math.min(classTotalPages, p + 1))} disabled={classPage === classTotalPages}
                      aria-label="Next page"
                      className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight aria-hidden className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </>
        )}

        {/* ── Sessions Tracker Tab ── */}
        {activeTab === 'tracker' && (
          <SessionsTracker
            initialMembers={initialSessionsMembers}
            initialMeta={initialSessionsMeta}
            initialStats={initialSessionsStats}
          />
        )}

        {/* ── Reviews Tab ── */}
        {activeTab === 'reviews' && (
          <ReviewsTab gymId={gymId} classes={classes} />
        )}

        {activeTab === 'class-types' && (
          <ClassTypesManager initial={classTypes} onChanged={updated => setClassTypes(updated)} />
        )}
      </div>

      {/* Modals */}
      {classModal.open && (
        <ClassModal
          existing={classModal.existing}
          branches={initialBranches}
          defaultBranchId={classModal.existing?.branch_id ?? undefined}
          onClose={() => setClassModal({ open: false })}
          onSaved={c => {
            setClasses(prev => classModal.existing ? prev.map(x => x.id === c.id ? c : x) : [c, ...prev]);
            fetch('/api/class-types').then(r => r.json()).then(data => { if (Array.isArray(data)) setClassTypes(data); }).catch(() => {});
            refresh();
          }}
        />
      )}
      {sessionModal.open && (
        <SessionModal
          classes={classes}
          branches={initialBranches}
          studios={initialStudios}
          existing={sessionModal.existing}
          defaultClassId={sessionModal.defaultClassId}
          defaultDate={sessionModal.defaultDate}
          defaultBranchId={sessionModal.defaultBranchId}
          onClose={() => setSessionModal({ open: false })}
          onSaved={s => { setSessions(prev => sessionModal.existing ? prev.map(x => x.id === s.id ? s : x) : [s, ...prev]); refresh(); }}
          onSavedMultiple={newSessions => { setSessions(prev => [...prev, ...newSessions]); refresh(); }}
          onSeriesUpdated={({ templateId, excludeId, fromDate, deltaDays, fields }) => {
            setSessions(prev => prev.map(s => {
              if (s.recurring_template_id !== templateId) return s;
              if (s.id === excludeId) return s;
              if (s.status !== 'scheduled') return s;
              if (s.session_date < fromDate) return s;
              const next: ClassSession = { ...s, ...fields };
              if (deltaDays !== 0) {
                // Stay in UTC end-to-end so admins east of UTC (e.g. Cairo)
                // don't see siblings rendered one day off until SSR refresh.
                const shifted = new Date(s.session_date + 'T00:00:00Z');
                shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
                next.session_date = shifted.toISOString().slice(0, 10);
              }
              return next;
            }));
          }}
        />
      )}
      {cancelModal && (
        <CancelSessionModal
          session={cancelModal}
          gym={gym}
          onClose={() => setCancelModal(null)}
          onCancelled={id => setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' } : s))}
        />
      )}
      {bookingsSession && (
        <SessionBookingsModal
          session={bookingsSession}
          onClose={() => setBookingsSession(null)}
          onBookingCountChange={(sessionId, count) =>
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, booked_count: count } : s))
          }
        />
      )}

    </>
  );
}
