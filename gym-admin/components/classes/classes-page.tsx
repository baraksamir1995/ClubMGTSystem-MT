'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, CalendarDays, Dumbbell, Pencil, XCircle, Search, X, ChevronLeft, ChevronRight, Users, MapPin, Clock, CalendarRange, Layers, Star, Tag } from 'lucide-react';
import { fmt12 } from '@/lib/time';
import { useRefresh } from '@/lib/use-refresh';
import toast from 'react-hot-toast';
import ClassModal from './class-modal';
import SessionModal from './session-modal';
import CancelSessionModal from './cancel-session-modal';
import SessionBookingsModal from './session-bookings-modal';
import ScheduleTab from './schedule-tab';
import SessionsTracker, { type SessionsMember } from '@/components/sessions/sessions-tracker';
import ReviewsTab from './reviews-tab';
import ClassTypesManager from './class-types-manager';
import type { GymClass, ClassSession, GymBranch, GymStudio } from '@/app/dashboard/classes/page';
import { can, type Permission } from '@/lib/get-permissions';

const PAGE_SIZE = 10;

interface Props {
  initialClasses: GymClass[];
  initialSessions: ClassSession[];
  initialSessionsMembers: SessionsMember[];
  initialClassTypes: { id: string; name: string }[];
  initialBranches: GymBranch[];
  initialStudios: GymStudio[];
  gymId: string;
  gym: { name: string; logo_url: string | null };
  permissions: Permission[] | null;
}

const TYPE_COLORS: Record<string, string> = {
  yoga:'bg-purple-400/10 text-purple-400', pilates:'bg-pink-400/10 text-pink-400',
  spinning:'bg-orange-400/10 text-orange-400', boxing:'bg-red-400/10 text-red-400',
  hiit:'bg-red-400/10 text-red-400', strength:'bg-blue-400/10 text-blue-400',
  cardio:'bg-green-400/10 text-green-400', dance:'bg-pink-400/10 text-pink-400',
  swimming:'bg-cyan-400/10 text-cyan-400', general:'bg-gray-400/10 text-gray-400',
};

export default function ClassesPageClient({ initialClasses, initialSessions, initialSessionsMembers, initialClassTypes, initialBranches, initialStudios, gymId, gym, permissions }: Props) {
  const refresh = useRefresh();
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
      if (!res.ok) { toast.error('Failed to update'); return; }
      setClasses(prev => prev.map(c => c.id === cls.id ? { ...c, is_active: !c.is_active } : c));
      toast.success(cls.is_active ? 'Class deactivated' : 'Class activated');
    } catch { toast.error('Network error'); }
  };

  const selectCls = 'bg-gray-700 border border-gray-600 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 transition-colors';

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Classes & Schedule</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage class templates and scheduled sessions</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'classes' && can(permissions, 'classes', 'create') && (
              <button onClick={() => setClassModal({ open: true })}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> New Class
              </button>
            )}
            {activeTab === 'sessions' && can(permissions, 'classes', 'create') && (
              <button onClick={() => setSessionModal({ open: true })}
                disabled={classes.filter(c => c.is_active).length === 0}
                title={classes.filter(c => c.is_active).length === 0 ? 'Create a class first' : ''}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                <Plus className="w-4 h-4" /> Schedule Session
              </button>
            )}
            {activeTab === 'schedule' && (
              <div className="text-xs text-gray-500 py-2">Weekly recurring template</div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-fit">
          {([
            ['sessions',    CalendarDays,  'Sessions',       sessions.filter(s => s.status === 'scheduled' && s.session_date >= monthStart && s.session_date < nextMonthStart).length],
            ['schedule',    CalendarRange, 'Schedule',       null],
            ['classes',     Dumbbell,      'Classes',        classes.filter(c => c.is_active).length],
            ['tracker',     Layers,        'Sessions Tracker', initialSessionsMembers.length],
            ['reviews',     Star,          'Reviews',          null],
            ['class-types', Tag,           'Class Types',      null],
          ] as const).map(([tab, Icon, label, count]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
              <Icon className="w-4 h-4" />
              {label}
              {count !== null && (
                <span className="text-xs bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full">{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Sessions Tab ── */}
        {activeTab === 'sessions' && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'This Month', value: sessions.filter(s => s.session_date >= monthStart && s.session_date < nextMonthStart && s.status === 'scheduled').length, color: 'text-purple-400', filter: 'upcoming' },
                { label: 'Past',     value: sessions.filter(s => s.session_date < today).length,                              color: 'text-gray-400',   filter: 'past' },
                { label: 'Cancelled',value: sessions.filter(s => s.status === 'cancelled').length,                            color: 'text-red-400',    filter: 'cancelled' },
              ].map(s => (
                <button key={s.filter} onClick={() => { setStatusFilter(s.filter); setPage(1); }}
                  className={`bg-gray-800 border rounded-xl p-4 text-left transition-colors ${statusFilter === s.filter ? 'border-purple-500' : 'border-gray-700 hover:border-gray-600'}`}>
                  <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </button>
              ))}
            </div>

            {/* Search + Filter */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by class name, instructor, location…"
                  className="w-full pl-9 pr-9 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>}
              </div>
              <div className="flex gap-3 items-center">
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="all">All Sessions</option>
                </select>
                <span className="ml-auto text-xs text-gray-500">{filteredSessions.length} sessions</span>
              </div>
            </div>

            {/* Sessions table / cancellation history */}
            {statusFilter === 'cancelled' ? (
              /* ── Cancellation History ── */
              paginatedSessions.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
                  <XCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No cancelled sessions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedSessions.map(session => (
                    <div key={session.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: class info */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: session.color }} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-semibold">{session.class_name}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 font-medium">Cancelled</span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
                              <span>
                                {new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {fmt12(session.start_time)} – {fmt12(session.end_time)}
                              </span>
                              {session.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />{session.location}
                                </span>
                              )}
                              {session.instructor && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />{session.instructor}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: members + cancelled at */}
                        <div className="flex-shrink-0 text-right">
                          <div className="flex items-center gap-1 text-xs text-gray-400 justify-end">
                            <Users className="w-3 h-3" />
                            <span>{session.booked_count} member{session.booked_count !== 1 ? 's' : ''} booked</span>
                          </div>
                          {session.cancelled_at && (
                            <p className="text-xs text-gray-600 mt-1">
                              {new Date(session.cancelled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' '}at{' '}
                              {new Date(session.cancelled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Reason */}
                      {session.cancel_reason && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Reason for cancellation</p>
                          <p className="text-sm text-gray-300">{session.cancel_reason}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-1 py-2">
                      <p className="text-xs text-gray-500">Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filteredSessions.length)} of {filteredSessions.length}</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        {Array.from({ length: totalPages }, (_, i) => i+1).map(n => (
                          <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 text-xs rounded-lg transition-colors ${n===page ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>{n}</button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              /* ── Regular sessions table ── */
              <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                {paginatedSessions.length === 0 ? (
                  <div className="p-12 text-center">
                    <CalendarDays className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">{sessions.length === 0 ? 'No sessions scheduled yet' : 'No sessions match your filters'}</p>
                    {sessions.length === 0 && classes.filter(c => c.is_active).length > 0 && can(permissions, 'classes', 'create') && (
                      <button onClick={() => setSessionModal({ open: true })}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                        <Plus className="w-4 h-4" /> Schedule first session
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                            <th className="text-left px-5 py-3">Class</th>
                            <th className="text-left px-5 py-3">Date</th>
                            <th className="text-left px-5 py-3">Time</th>
                            <th className="text-left px-5 py-3">Location</th>
                            <th className="text-left px-5 py-3">Capacity</th>
                            <th className="text-left px-5 py-3">Status</th>
                            <th className="text-right px-5 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {paginatedSessions.map(session => (
                            <tr key={session.id} className="hover:bg-gray-700/30 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: session.color }} />
                                  <div>
                                    <p className="text-white font-medium">{session.class_name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <p className="text-xs text-gray-500 capitalize">{session.class_type}</p>
                                      {session.session_type === 'popup' && (
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-medium">Pop-up</span>
                                      )}
                                      {session.session_type === 'recurring' && (
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-400/10 text-purple-400 font-medium">Recurring</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-gray-300">
                                {new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1 text-gray-400 text-xs">
                                  <Clock className="w-3 h-3" />
                                  {fmt12(session.start_time)} – {fmt12(session.end_time)}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-gray-400 text-xs">
                                {session.location ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.location}</span> : '—'}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  <Users className="w-3 h-3" />
                                  {session.booked_count}{session.capacity ? `/${session.capacity}` : ''}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                {session.status === 'scheduled' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400">Scheduled</span>
                                )}
                                {session.status === 'completed' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-400/10 text-gray-400">Completed</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setBookingsSession(session)}
                                    title="View bookings"
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
                                    <Users className="w-4 h-4" />
                                  </button>
                                  {session.status === 'scheduled' && can(permissions, 'classes', 'edit') && (
                                    <button onClick={() => setSessionModal({ open: true, existing: session })}
                                      title="Edit session"
                                      className="p-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors">
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                  )}
                                  {session.status === 'scheduled' && can(permissions, 'classes', 'delete') && (
                                    <button onClick={() => setCancelModal(session)}
                                      title="Cancel session"
                                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
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
                      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700">
                        <p className="text-xs text-gray-500">Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filteredSessions.length)} of {filteredSessions.length}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                          {Array.from({ length: totalPages }, (_, i) => i+1).map(n => (
                            <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 text-xs rounded-lg transition-colors ${n===page ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>{n}</button>
                          ))}
                          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
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
              if (!window.confirm('Stop this recurring series? All future sessions will be cancelled.')) return;
              try {
                const res = await fetch(`/api/sessions/recurring/${templateId}/stop`, { method: 'POST' });
                if (!res.ok) { toast.error('Failed to stop recurring series'); return; }
                setSessions(prev => prev.map(s =>
                  s.recurring_template_id === templateId && s.session_date > today
                    ? { ...s, status: 'cancelled' }
                    : s
                ));
                toast.success('Recurring series stopped — future sessions cancelled');
              } catch { toast.error('Network error'); }
            }}
          />
        )}

        {/* ── Classes Tab ── */}
        {activeTab === 'classes' && (
          <>
            {/* Search */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={classSearch} onChange={e => setClassSearch(e.target.value)}
                  placeholder="Search classes…"
                  className="w-full pl-9 pr-9 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                {classSearch && <button onClick={() => setClassSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>}
              </div>
              <div className="flex gap-3 items-center">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
                  <option value="all">All Types</option>
                  {classTypes.map(t => (
                    <option key={t.id} value={t.name} className="capitalize">{t.name.charAt(0).toUpperCase()+t.name.slice(1)}</option>
                  ))}
                </select>
                <span className="ml-auto text-xs text-gray-500">{filteredClasses.length} classes</span>
              </div>
            </div>

            {/* Classes grid */}
            {filteredClasses.length === 0 ? (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
                <Dumbbell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{classes.length === 0 ? 'No classes created yet' : 'No classes match your search'}</p>
                {classes.length === 0 && can(permissions, 'classes', 'create') && (
                  <button onClick={() => setClassModal({ open: true })}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus className="w-4 h-4" /> Create first class
                  </button>
                )}
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedClasses.map(cls => {
                  const sessionCount = sessions.filter(s => s.class_id === cls.id && s.session_date >= today && s.status === 'scheduled').length;
                  const typeCls = TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.general;
                  return (
                    <div key={cls.id} className={`bg-gray-800 border rounded-xl p-5 transition-colors ${cls.is_active ? 'border-gray-700' : 'border-gray-700 opacity-60'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
                          <div>
                            <p className="text-white font-semibold leading-tight">{cls.name}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize mt-1 inline-block ${typeCls}`}>{cls.class_type}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {can(permissions, 'classes', 'edit') && (
                            <button onClick={() => setClassModal({ open: true, existing: cls })}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        {cls.location && <p className="text-xs text-gray-400">📍 {cls.location}</p>}
                        {cls.description && <p className="text-xs text-gray-500 line-clamp-2">{cls.description}</p>}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                        <span className="text-xs text-gray-400">
                          <span className="text-white font-medium">{sessionCount}</span> upcoming session{sessionCount !== 1 ? 's' : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {can(permissions, 'classes', 'create') && (
                            <button onClick={() => setSessionModal({ open: true, defaultClassId: cls.id })}
                              disabled={!cls.is_active}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs font-medium transition-colors disabled:opacity-40">
                              <Plus className="w-3 h-3" /> Session
                            </button>
                          )}
                          {can(permissions, 'classes', 'edit') && (
                            <button onClick={() => toggleClass(cls)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${cls.is_active ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400'}`}>
                              {cls.is_active ? 'Deactivate' : 'Activate'}
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
                  <p className="text-xs text-gray-500">
                    Showing {(classPage - 1) * CLASS_PAGE_SIZE + 1}–{Math.min(classPage * CLASS_PAGE_SIZE, filteredClasses.length)} of {filteredClasses.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setClassPage(p => Math.max(1, p - 1))} disabled={classPage === 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: classTotalPages }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setClassPage(n)}
                        className={`w-8 h-8 text-xs rounded-lg transition-colors ${n === classPage ? 'bg-purple-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                        {n}
                      </button>
                    ))}
                    <button onClick={() => setClassPage(p => Math.min(classTotalPages, p + 1))} disabled={classPage === classTotalPages}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-4 h-4" />
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
          <SessionsTracker initialMembers={initialSessionsMembers} />
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
