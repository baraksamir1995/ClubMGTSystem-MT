'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, User, Users, Pencil, XCircle, Globe, EyeOff, AlertTriangle, Loader2, StopCircle, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymClass, ClassSession, GymBranch } from '@/app/dashboard/classes/page';
import { can, type Permission } from '@/lib/get-permissions';
import { fmt12 } from '@/lib/time';
import CopyMonthModal from './copy-month-modal';

export interface WeeklySlot {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  instructor: string | null;
  location: string | null;
  capacity: number | null;
  session_type: 'popup' | 'recurring';
}

interface Props {
  sessions: ClassSession[];
  classes: GymClass[];
  branches: GymBranch[];
  permissions: Permission[] | null;
  onCreateSession: (defaultDate: string, defaultBranchId?: string) => void;
  onEditSession: (session: ClassSession) => void;
  onCancelSession: (session: ClassSession) => void;
  onViewBookings: (session: ClassSession) => void;
  onStopRecurring: (templateId: string) => void;
  onPublished?: () => void;
}

interface ScheduleSettings {
  is_published: boolean;
  published_at: string | null;
  last_updated_at: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL   = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function getWeekDates(base: Date): Date[] {
  const day = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatWeekRange(dates: Date[]) {
  if (dates[0].getMonth() === dates[6].getMonth()) {
    return `${dates[0].getDate()}–${dates[6].getDate()} ${dates[6].toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  }
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(dates[0])} – ${fmt(dates[6])} ${dates[6].getFullYear()}`;
}

/** Returns sessions to display for a given day cell — exact date match only (recurring sessions are pre-generated as DB records). */
function getSessionsForDay(sessions: ClassSession[], date: Date): ClassSession[] {
  const dateStr = toDateStr(date);
  return sessions
    .filter(s => s.status !== 'cancelled' && s.session_date === dateStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleTab({
  sessions, classes, branches, permissions,
  onCreateSession, onEditSession, onCancelSession, onViewBookings, onStopRecurring, onPublished,
}: Props) {
  const [weekOffset,    setWeekOffset]    = useState(0);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(
    branches.length > 0 ? branches[0].id : null
  );
  const [settings,    setSettings]    = useState<ScheduleSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [publishing,  setPublishing]  = useState(false);
  const [localChangedAt, setLocalChangedAt] = useState<string | null>(null);
  const initialSessionCount = useRef<number | null>(null);
  const [showCopyMonth, setShowCopyMonth] = useState(false);

  useEffect(() => {
    fetch('/api/schedule')
      .then(r => r.json())
      .then(d => {
        setSettings(d.settings ?? { is_published: false, published_at: null, last_updated_at: new Date().toISOString() });
        // Record sessions count at the time settings were loaded
        initialSessionCount.current = sessions.length;
      })
      .catch(() => toast.error('Failed to load schedule settings'))
      .finally(() => setLoadingSettings(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect newly added sessions after initial load
  useEffect(() => {
    if (initialSessionCount.current === null) return; // settings not loaded yet
    if (sessions.length > initialSessionCount.current) {
      setLocalChangedAt(new Date().toISOString());
    }
  }, [sessions.length]);

  // Show banner only when there are scheduled sessions not yet published.
  // Avoids false positives from last_updated_at being bumped by booking count changes.
  const hasUnpublishedChanges = Boolean(
    settings?.is_published &&
    sessions.some(s => s.status !== 'cancelled' && !s.is_published)
  );
  // Anything to publish at all? Used to disable "Publish Schedule" pre-publish
  // when the gym has no live sessions yet.
  const hasPublishableContent = sessions.some(s => s.status !== 'cancelled');

  const handlePublish = async (publish: boolean) => {
    setPublishing(true);
    try {
      const res = await fetch('/api/schedule/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Failed to publish'); return; }
      const now = new Date().toISOString();
      setSettings(prev => prev ? {
        ...prev,
        is_published: publish,
        published_at: publish ? now : prev.published_at,
        last_updated_at: publish ? now : prev.last_updated_at,
      } : null);
      if (publish) {
        setLocalChangedAt(null);
        initialSessionCount.current = sessions.length;
        onPublished?.();
      }
      toast.success(publish ? 'Schedule published — members can now see it' : 'Schedule unpublished');
    } catch { toast.error('Network error'); }
    finally { setPublishing(false); }
  };

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(baseDate);
  const todayStr  = toDateStr(new Date());
  const isPublished = settings?.is_published ?? false;

  // Filter sessions by active branch (only when multi-branch)
  // Also include sessions with no branch assigned (null)
  const visibleSessions = branches.length > 1 && activeBranchId
    ? sessions.filter(s => !s.branch_id || s.branch_id === activeBranchId)
    : sessions;

  return (
    <div className="space-y-4">
      {/* ── Publish banner ── */}
      {loadingSettings ? (
        <div className="h-16 bg-gray-800 border border-gray-700 rounded-xl animate-pulse" />
      ) : (
        <div className={`flex items-center justify-between px-5 py-4 rounded-xl border ${
          isPublished
            ? hasUnpublishedChanges
              ? 'bg-amber-400/5 border-amber-400/30'
              : 'bg-emerald-400/5 border-emerald-400/30'
            : 'bg-gray-800 border-gray-700'
        }`}>
          <div className="flex items-center gap-3">
            {isPublished ? (
              hasUnpublishedChanges ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Unpublished changes</p>
                    <p className="text-xs text-gray-400 mt-0.5">Re-publish to push updates to the member app</p>
                  </div>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">Schedule is live</p>
                    {settings?.published_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Published {new Date(settings.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </>
              )
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-300">Schedule not published</p>
                  <p className="text-xs text-gray-500 mt-0.5">Members cannot see sessions until you publish</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPublished && (
              <button onClick={() => handlePublish(false)} disabled={publishing}
                className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-xs hover:bg-gray-700 transition-colors disabled:opacity-40">
                Unpublish
              </button>
            )}
            <button
              onClick={() => handlePublish(true)}
              disabled={
                publishing ||
                (isPublished && !hasUnpublishedChanges) ||
                (!isPublished && !hasPublishableContent)
              }
              title={!isPublished && !hasPublishableContent ? 'Add at least one session to publish' : undefined}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                (isPublished && !hasUnpublishedChanges) || (!isPublished && !hasPublishableContent)
                  ? 'bg-gray-700 text-gray-500 cursor-default'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}>
              {publishing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Globe className="w-3.5 h-3.5" />}
              {isPublished ? (hasUnpublishedChanges ? 'Push Changes' : 'Published') : 'Publish Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk actions (under the publish banner) ── */}
      {can(permissions, 'classes', 'create') && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowCopyMonth(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-purple-500/50 hover:bg-purple-500/5 text-gray-400 hover:text-purple-300 text-xs font-medium transition-colors"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            Copy this month to next month
          </button>
        </div>
      )}

      {/* ── Branch tabs (multi-branch only) ── */}
      {branches.length > 1 && (
        <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-fit">
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => setActiveBranchId(b.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeBranchId === b.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Week navigation ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-white min-w-[200px] text-center">
            {formatWeekRange(weekDates)}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
            Today
          </button>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Pop-up (one-off)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Recurring (every week)
        </span>
      </div>

      {/* ── 7-day grid ── */}
      <div className="grid grid-cols-7 gap-3">
        {weekDates.map((date, idx) => {
          const dateStr    = toDateStr(date);
          const isToday    = dateStr === todayStr;
          const isPast     = dateStr < todayStr;
          const daySessions = getSessionsForDay(visibleSessions, date);

          return (
            <div key={dateStr}>
              {/* Column header */}
              <div className={`flex items-center justify-between mb-2 pb-2 border-b ${isToday ? 'border-purple-500' : 'border-gray-700'}`}>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-purple-400' : isPast ? 'text-gray-600' : 'text-gray-400'}`}>
                    {DAY_LABELS[idx]}
                  </p>
                  <p className={`text-sm font-bold leading-none mt-0.5 ${isToday ? 'text-purple-300' : isPast ? 'text-gray-600' : 'text-white'}`}>
                    {date.getDate()}
                  </p>
                </div>
                {can(permissions, 'classes', 'create') && (
                  <button
                    onClick={() => onCreateSession(dateStr, activeBranchId ?? undefined)}
                    title={`Add session on ${DAY_FULL[idx]}`}
                    className="p-0.5 rounded text-gray-600 hover:text-purple-400 hover:bg-purple-400/10 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Session cards */}
              <div className="space-y-2">
                {daySessions.length === 0 ? (
                  can(permissions, 'classes', 'create') ? (
                    <button
                      onClick={() => onCreateSession(dateStr, activeBranchId ?? undefined)}
                      className="w-full border border-dashed border-gray-700 rounded-lg py-5 flex items-center justify-center text-gray-600 hover:text-gray-500 hover:border-gray-600 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-full border border-dashed border-gray-800 rounded-lg py-5" />
                  )
                ) : (
                  <>
                    {daySessions.map(session => (
                      <_SessionCard
                        key={session.id}
                        session={session}
                        permissions={permissions}
                        isUnpublished={
                          // Schedule entirely unpublished, OR this row hasn't
                          // been included in a publish run yet (publish() flips
                          // is_published=true on every active row; new rows
                          // default to false).
                          settings ? (!settings.is_published || !session.is_published) : false
                        }
                        onEdit={() => onEditSession(session)}
                        onCancel={() => onCancelSession(session)}
                        onBookings={() => onViewBookings(session)}
                        onStopRecurring={session.recurring_template_id ? () => onStopRecurring(session.recurring_template_id!) : undefined}
                      />
                    ))}
                    {can(permissions, 'classes', 'create') && (
                      <button
                        onClick={() => onCreateSession(dateStr)}
                        className="w-full py-1.5 text-xs text-gray-600 hover:text-gray-400 rounded-lg border border-dashed border-gray-700/50 hover:border-gray-700 transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCopyMonth && (
        <CopyMonthModal
          branchId={activeBranchId}
          branchName={branches.find(b => b.id === activeBranchId)?.name ?? null}
          onClose={() => setShowCopyMonth(false)}
          onCopied={() => {
            // Hard reload so the parent's local sessions state is rebuilt
            // from a fresh SSR fetch — router.refresh() alone re-renders the
            // server component but useState in classes-page.tsx wouldn't
            // pick up the new rows until remount. Delay so the success
            // toast is visible before navigation.
            setTimeout(() => window.location.reload(), 1500);
          }}
        />
      )}
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function _SessionCard({ session, permissions, onEdit, onCancel, onBookings, onStopRecurring, isUnpublished }: {
  session: ClassSession;
  permissions: Permission[] | null;
  onEdit: () => void;
  onCancel: () => void;
  onBookings: () => void;
  onStopRecurring?: () => void;
  isUnpublished?: boolean;
}) {
  const isPopup     = session.session_type === 'popup';
  const isRecurring = session.session_type === 'recurring';

  return (
    <div className={`rounded-lg p-2.5 group border transition-colors ${
      isUnpublished
        ? 'bg-gray-800/60 border-dashed border-amber-500/40 hover:border-amber-500/60'
        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
    }`}>
      {/* Unpublished badge */}
      {isUnpublished && (
        <div className="flex items-center gap-1 mb-1.5">
          <EyeOff className="w-2.5 h-2.5 text-amber-400/70" />
          <span className="text-xs text-amber-400/70 font-medium">Unpublished</span>
        </div>
      )}
      {/* Color dot + name + type badge */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: session.color }} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{session.class_name}</p>
          {isPopup && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-medium mt-1 inline-block">Pop-up</span>
          )}
          {isRecurring && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-400/10 text-purple-400 font-medium mt-1 inline-block">Recurring</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
        <Clock className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate">{fmt12(session.start_time)}–{fmt12(session.end_time)}</span>
      </div>

      {session.location && (
        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{session.location}</span>
        </div>
      )}

      {session.instructor && (
        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
          <User className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{session.instructor}</span>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-gray-600">
        <Users className="w-2.5 h-2.5 flex-shrink-0" />
        <span>{session.booked_count}{session.capacity ? `/${session.capacity}` : ''} booked</span>
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onBookings} title="Bookings"
          className="flex-1 flex items-center justify-center py-1 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
          <Users className="w-3 h-3" />
        </button>
        {can(permissions, 'classes', 'edit') && (
          <button onClick={onEdit} title="Edit this session"
            className="flex-1 flex items-center justify-center py-1 rounded text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {can(permissions, 'classes', 'delete') && (
          <button onClick={onCancel} title="Cancel this session"
            className="flex-1 flex items-center justify-center py-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <XCircle className="w-3 h-3" />
          </button>
        )}
        {isRecurring && onStopRecurring && can(permissions, 'classes', 'delete') && (
          <button onClick={onStopRecurring} title="Stop this recurring series"
            className="flex-1 flex items-center justify-center py-1 rounded text-gray-500 hover:text-orange-400 hover:bg-orange-400/10 transition-colors">
            <StopCircle className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
