'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, User, Users, Pencil, XCircle, Globe, EyeOff, AlertTriangle, Loader2, StopCircle, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
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

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_FULL_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

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
  const t = useTranslations('classes');
  const tc = useTranslations('common');
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
      .catch(() => toast.error(t('schedule.failedToLoadSettings')))
      .finally(() => setLoadingSettings(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect newly added sessions after initial load
  useEffect(() => {
    if (initialSessionCount.current === null) return; // settings not loaded yet
    if (sessions.length > initialSessionCount.current) {
      setLocalChangedAt(new Date().toISOString());
    }
  }, [sessions.length]);

  const todayStr = toDateStr(new Date());

  // Only sessions from today onwards can ever be published: ScheduleController
  // ::publish updates `session_date >= today` and leaves older rows alone. The
  // banner must use the same window, or a gym with old unpublished sessions
  // (e.g. imported, or scheduled before the first publish) shows "unpublished
  // changes" forever — pushing appears to do nothing because the rows keeping
  // the banner alive are ones publish will never touch.
  const isPublishable = (s: ClassSession) =>
    s.status !== 'cancelled' && s.session_date >= todayStr;

  // Show banner only when there are scheduled sessions not yet published.
  // Avoids false positives from last_updated_at being bumped by booking count changes.
  const hasUnpublishedChanges = Boolean(
    settings?.is_published &&
    sessions.some(s => isPublishable(s) && !s.is_published)
  );
  // Anything to publish at all? Used to disable "Publish Schedule" pre-publish
  // when the gym has no live sessions yet.
  const hasPublishableContent = sessions.some(isPublishable);

  const handlePublish = async (publish: boolean) => {
    setPublishing(true);
    try {
      const res = await fetch('/api/schedule/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? t('schedule.failedToPublish')); return; }
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
      toast.success(publish ? t('schedule.publishSuccess') : t('schedule.unpublishSuccess'));
    } catch { toast.error(tc('networkError')); }
    finally { setPublishing(false); }
  };

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(baseDate);
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
        <div className="h-16 bg-surface-2 border border-line rounded-xl animate-pulse" />
      ) : (
        <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-xl border ${
          isPublished
            ? hasUnpublishedChanges
              ? 'bg-warning-soft border-warning/40'
              : 'bg-success-soft border-success/40'
            : 'bg-surface-2 border-line'
        }`}>
          <div className="flex items-center gap-3">
            {isPublished ? (
              hasUnpublishedChanges ? (
                <>
                  <AlertTriangle aria-hidden className="w-4 h-4 text-warning flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-warning">{t('schedule.unpublishedChanges')}</p>
                    <p className="text-xs text-fg-muted mt-0.5">{t('schedule.republishHint')}</p>
                  </div>
                </>
              ) : (
                <>
                  <Globe aria-hidden className="w-4 h-4 text-success flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-success">{t('schedule.scheduleIsLive')}</p>
                    {settings?.published_at && (
                      <p className="text-xs text-fg-muted mt-0.5">
                        {t('schedule.publishedOn', { date: new Date(settings.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}
                      </p>
                    )}
                  </div>
                </>
              )
            ) : (
              <>
                <EyeOff aria-hidden className="w-4 h-4 text-fg-muted flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-fg-muted">{t('schedule.notPublished')}</p>
                  <p className="text-xs text-fg-faint mt-0.5">{t('schedule.notPublishedHint')}</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPublished && (
              <button onClick={() => handlePublish(false)} disabled={publishing}
                className="px-3 py-1.5 rounded-lg border border-line text-fg-muted text-xs hover:bg-surface-3 transition-colors disabled:opacity-40">
                {t('schedule.unpublish')}
              </button>
            )}
            <button
              onClick={() => handlePublish(true)}
              disabled={
                publishing ||
                (isPublished && !hasUnpublishedChanges) ||
                (!isPublished && !hasPublishableContent)
              }
              title={!isPublished && !hasPublishableContent ? t('schedule.noSessionsToPublish') : undefined}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                (isPublished && !hasUnpublishedChanges) || (!isPublished && !hasPublishableContent)
                  ? 'bg-surface-3 text-fg-faint cursor-default'
                  : 'bg-brand hover:bg-brand-dim text-brand-ink'
              }`}>
              {publishing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Globe className="w-3.5 h-3.5" />}
              {isPublished ? (hasUnpublishedChanges ? t('schedule.pushChanges') : t('schedule.publishedLabel')) : t('schedule.publishSchedule')}
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk actions (under the publish banner) ── */}
      {can(permissions, 'classes', 'create') && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowCopyMonth(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:border-brand/50 hover:bg-brand/5 text-fg-muted hover:text-brand-dim text-xs font-medium transition-colors"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            {t('schedule.copyToNextMonth')}
          </button>
        </div>
      )}

      {/* ── Branch tabs (multi-branch only) ── */}
      {branches.length > 1 && (
        <div className="flex items-center gap-1 bg-surface-2 border border-line rounded-xl p-1 w-fit max-w-full overflow-x-auto">
          {branches.map(b => (
            <button
              key={b.id}
              onClick={() => setActiveBranchId(b.id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeBranchId === b.id
                  ? 'bg-surface-3 text-fg'
                  : 'text-fg-muted hover:text-fg'
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
            aria-label="Previous week"
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">
            <ChevronLeft aria-hidden className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-fg min-w-[200px] text-center">
            {formatWeekRange(weekDates)}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)}
            aria-label="Next week"
            className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">
            <ChevronRight aria-hidden className="w-4 h-4" />
          </button>
        </div>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)}
            className="text-xs text-brand hover:text-brand-dim transition-colors">
            {t('schedule.today')}
          </button>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 text-xs text-fg-faint">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning inline-block" /> {t('schedule.legendPopup')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand inline-block" /> {t('schedule.legendRecurring')}
        </span>
      </div>

      {/* ── 7-day grid ── */}
      <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-3 min-w-[840px]">
        {weekDates.map((date, idx) => {
          const dateStr    = toDateStr(date);
          const isToday    = dateStr === todayStr;
          const isPast     = dateStr < todayStr;
          const daySessions = getSessionsForDay(visibleSessions, date);
          const dayKey = DAY_KEYS[idx];
          const dayFullKey = DAY_FULL_KEYS[idx];

          return (
            <div key={dateStr}>
              {/* Column header */}
              <div className={`flex items-center justify-between mb-2 pb-2 border-b ${isToday ? 'border-brand' : 'border-line'}`}>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-brand' : isPast ? 'text-fg-faint' : 'text-fg-muted'}`}>
                    {t(`schedule.days.${dayKey}`)}
                  </p>
                  <p className={`text-sm font-bold leading-none mt-0.5 ${isToday ? 'text-brand' : isPast ? 'text-fg-faint' : 'text-fg'}`}>
                    {date.getDate()}
                  </p>
                </div>
                {can(permissions, 'classes', 'create') && (
                  <button
                    onClick={() => onCreateSession(dateStr, activeBranchId ?? undefined)}
                    title={t('schedule.addSessionOn', { day: t(`schedule.daysFull.${dayFullKey}`) })}
                    className="p-0.5 rounded text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors">
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
                      aria-label={t('schedule.add')}
                      className="w-full border border-dashed border-line rounded-lg py-5 flex items-center justify-center text-fg-faint hover:text-fg-faint hover:border-line-strong transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-full border border-dashed border-line rounded-lg py-5" />
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
                        className="w-full py-1.5 text-xs text-fg-faint hover:text-fg-muted rounded-lg border border-dashed border-line/50 hover:border-line transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> {t('schedule.add')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
  const t = useTranslations('classes');
  const isPopup     = session.session_type === 'popup';
  const isRecurring = session.session_type === 'recurring';

  return (
    <div className={`rounded-lg p-2.5 group border transition-colors ${
      isUnpublished
        ? 'bg-surface-2/60 border-dashed border-warning/40 hover:border-warning/60'
        : 'bg-surface-2 border-line hover:border-line-strong'
    }`}>
      {/* Unpublished badge */}
      {isUnpublished && (
        <div className="flex items-center gap-1 mb-1.5">
          <EyeOff aria-hidden className="w-2.5 h-2.5 text-warning/70" />
          <span className="text-xs text-warning/70 font-medium">{t('schedule.unpublishedLabel')}</span>
        </div>
      )}
      {/* Color dot + name + type badge */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: session.color }} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-fg leading-tight line-clamp-2">{session.class_name}</p>
          {isPopup && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-warning-soft text-warning font-medium mt-1 inline-block">{t('sessions.popup')}</span>
          )}
          {isRecurring && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand/10 text-brand font-medium mt-1 inline-block">{t('sessions.recurring')}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-fg-faint mb-1">
        <Clock aria-hidden className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate">{fmt12(session.start_time)}–{fmt12(session.end_time)}</span>
      </div>

      {session.location && (
        <div className="flex items-center gap-1 text-xs text-fg-faint mb-1">
          <MapPin aria-hidden className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{session.location}</span>
        </div>
      )}

      {session.instructor && (
        <div className="flex items-center gap-1 text-xs text-fg-faint mb-1">
          <User aria-hidden className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{session.instructor}</span>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-fg-faint">
        <Users aria-hidden className="w-2.5 h-2.5 flex-shrink-0" />
        <span>{t('schedule.bookedSlots', { booked: `${session.booked_count}${session.capacity ? `/${session.capacity}` : ''}` })}</span>
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-line opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onBookings} title={t('schedule.titleBookings')}
          className="flex-1 flex items-center justify-center py-1 rounded text-fg-faint hover:text-info hover:bg-info-soft transition-colors">
          <Users className="w-3 h-3" />
        </button>
        {can(permissions, 'classes', 'edit') && (
          <button onClick={onEdit} title={t('schedule.titleEditSession')}
            className="flex-1 flex items-center justify-center py-1 rounded text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {can(permissions, 'classes', 'delete') && (
          <button onClick={onCancel} title={t('schedule.titleCancelSession')}
            className="flex-1 flex items-center justify-center py-1 rounded text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors">
            <XCircle className="w-3 h-3" />
          </button>
        )}
        {isRecurring && onStopRecurring && can(permissions, 'classes', 'delete') && (
          <button onClick={onStopRecurring} title={t('schedule.titleStopRecurring')}
            className="flex-1 flex items-center justify-center py-1 rounded text-fg-faint hover:text-accent hover:bg-accent/15 transition-colors">
            <StopCircle className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
