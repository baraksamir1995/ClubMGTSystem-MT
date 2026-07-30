'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDays, Zap, Repeat, Copy, type LucideIcon } from 'lucide-react'; // Copy used in parallel toggle
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { GymClass, ClassSession, GymBranch, GymStudio } from '@/app/dashboard/classes/page';
import { Button, Input, Modal, Select } from '@/components/ui';


type SessionType = 'popup' | 'recurring';

interface Props {
  classes: GymClass[];
  branches: GymBranch[];
  studios: GymStudio[];
  existing?: ClassSession;
  defaultClassId?: string;
  defaultDate?: string;
  defaultBranchId?: string;
  onClose: () => void;
  onSaved: (s: ClassSession) => void;
  onSavedMultiple?: (sessions: ClassSession[]) => void;
  onSeriesUpdated?: (params: {
    templateId: string;
    excludeId: string;
    fromDate: string;
    deltaDays: number;
    fields: Partial<Pick<
      ClassSession,
      'start_time' | 'end_time' | 'capacity' | 'instructor' | 'location' |
      'branch_id' | 'studio_id' | 'walk_in_allowed'
    >>;
  }) => void;
}

export default function SessionModal({ classes, branches, studios, existing, defaultClassId, defaultDate, defaultBranchId, onClose, onSaved, onSavedMultiple, onSeriesUpdated }: Props) {
  const t = useTranslations('classes');
  const tc = useTranslations('common');

  const SESSION_TYPES: { value: SessionType; label: string; icon: LucideIcon; desc: string }[] = [
    { value: 'popup',     label: t('sessionModal.popupLabel'),     icon: Zap,    desc: t('sessionModal.popupDesc') },
    { value: 'recurring', label: t('sessionModal.recurringLabel'), icon: Repeat, desc: t('sessionModal.recurringDesc') },
  ];

  const todayLocal = new Date().toLocaleDateString('en-CA');

  const [branchId,    setBranchId]    = useState(existing?.branch_id ?? defaultBranchId ?? (branches.length === 1 ? branches[0].id : ''));

  const activeClasses   = classes.filter(c => c.is_active);
  const visibleClasses  = (branches.length > 1 && branchId)
    ? activeClasses.filter(c => !c.branch_id || c.branch_id === branchId)
    : activeClasses;

  const [classId,      setClassId]      = useState(existing?.class_id ?? defaultClassId ?? visibleClasses[0]?.id ?? '');
  const [sessionType,  setSessionType]  = useState<SessionType>(
    (existing?.session_type === 'popup' || existing?.session_type === 'recurring')
      ? existing.session_type
      : 'recurring'
  );
  const [date,         setDate]         = useState(existing?.session_date ?? defaultDate ?? todayLocal);
  const [startTime,    setStartTime]    = useState(existing?.start_time?.slice(0, 5) ?? '09:00');
  const [endTime,      setEndTime]      = useState(existing?.end_time?.slice(0, 5) ?? '10:00');
  const [capacity,     setCapacity]     = useState(existing?.capacity?.toString() ?? '');
  const [instructor,   setInstructor]   = useState(existing?.instructor ?? visibleClasses.find(c => c.id === (existing?.class_id ?? defaultClassId ?? visibleClasses[0]?.id))?.instructor ?? '');
  const [studioId,      setStudioId]      = useState(existing?.studio_id ?? '');
  const [walkInAllowed, setWalkInAllowed] = useState(existing?.walk_in_allowed ?? false);
  const [saving,        setSaving]        = useState(false);

  // Trainers for the selected branch
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([]);
  const trainerFetchRef = useRef<string | null>(null);

  // Parallel session (new sessions only)
  const [showParallel,     setShowParallel]     = useState(false);
  const [parallelStudioId, setParallelStudioId] = useState('');
  const [parallelCapacity, setParallelCapacity] = useState('');

  // When editing a recurring session in an existing series, default to
  // applying changes across all upcoming siblings.
  const isRecurringSeriesEdit = !!(existing && existing.session_type === 'recurring' && existing.recurring_template_id);
  const [applyToSeries, setApplyToSeries] = useState(isRecurringSeriesEdit);

  const selectedClass = classes.find(c => c.id === classId);

  // Studios filtered by selected branch
  const branchStudios = branchId
    ? studios.filter(s => s.branch_id === branchId)
    : studios;

  // When class changes on a new session, reset instructor to the class default
  useEffect(() => {
    if (!existing) {
      setInstructor(selectedClass?.instructor ?? '');
    }
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch trainers when branch changes
  useEffect(() => {
    const key = branchId || '__all__';
    if (trainerFetchRef.current === key) return;
    trainerFetchRef.current = key;
    const url = branchId ? `/api/trainers?branch_id=${branchId}` : '/api/trainers';
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.trainers) setTrainers(data.trainers); })
      .catch(() => {});
  }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset class when branch changes if selected class isn't in the new branch
  useEffect(() => {
    if (branches.length > 1 && classId) {
      const cls = classes.find(c => c.id === classId);
      if (cls && cls.branch_id && cls.branch_id !== branchId) {
        setClassId(visibleClasses[0]?.id ?? '');
      }
    }
    // Reset studio if it no longer belongs to the new branch
    if (studioId && !branchStudios.find(s => s.id === studioId)) {
      setStudioId('');
    }
  }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildBody = (opts?: { studioId?: string; capacity?: string }) => {
    const cap = opts?.capacity ?? capacity;
    const sid = opts?.studioId !== undefined ? opts.studioId : studioId;
    return {
      classId,
      sessionType,
      date,
      startTime,
      endTime,
      capacity:      cap ? parseInt(cap) : null,
      instructor:    instructor.trim() || null,
      studioId:      sid || null,
      walkInAllowed,
      branchId:      branchId || null,
      applyToSeries: isRecurringSeriesEdit ? applyToSeries : false,
    };
  };

  const handleSubmit = async () => {
    if (!classId || !date || !startTime || !endTime) { toast.error(t('sessionModal.fillRequired')); return; }
    if (branches.length > 1 && !branchId) { toast.error(t('sessionModal.selectBranchError')); return; }
    if (!studioId) { toast.error(t('sessionModal.selectStudioError')); return; }
    if (startTime >= endTime) { toast.error(t('sessionModal.endTimeAfterStart')); return; }
    if (showParallel && !parallelStudioId) { toast.error(t('sessionModal.selectParallelStudio')); return; }

    setSaving(true);
    try {
      // Save main session
      const res = await fetch(existing ? `/api/sessions/${existing.id}` : '/api/sessions', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tc('somethingWrong')); return; }

      const cls = classes.find(c => c.id === classId)!;

      const selectedStudioName = studioId ? (studios.find(s => s.id === studioId)?.name ?? null) : null;
      const resolvedLocation = selectedStudioName ?? cls.location ?? null;

      // Recurring: API returns array of generated sessions
      if (!existing && sessionType === 'recurring' && data.sessions) {
        const recurringSessions: ClassSession[] = (data.sessions as any[]).map(s => ({
          id:                    s.id,
          class_id:              classId,
          class_name:            cls.name,
          class_type:            cls.class_type,
          session_type:          'recurring' as const,
          instructor:            (s.instructor ?? instructor.trim()) || null,
          location:              resolvedLocation,
          color:                 cls.color,
          // Laravel casts session_date to datetime ISO ("2026-05-12T00:00:00.000000Z");
          // schedule grid matches against "YYYY-MM-DD" cell keys.
          session_date:          (s.session_date ?? '').slice(0, 10),
          start_time:            (s.start_time ?? '').slice(0, 5),
          end_time:              (s.end_time ?? '').slice(0, 5),
          capacity:              s.capacity ?? (capacity ? parseInt(capacity) : null),
          booked_count:          0,
          status:                'scheduled' as const,
          cancel_reason:         null,
          cancelled_at:          null,
          created_at:            s.created_at ?? new Date().toISOString(),
          recurring_template_id: data.templateId,
          is_published:          false,
          branch_id:             branchId || null,
          studio_id:             studioId || null,
          walk_in_allowed:       walkInAllowed,
        }));
        toast.success(t('sessionModal.recurringScheduled', { count: recurringSessions.length }));
        onSavedMultiple ? onSavedMultiple(recurringSessions) : recurringSessions.forEach(s => onSaved(s));
        onClose();
        return;
      }

      const baseSession: ClassSession = {
        ...(existing ?? { booked_count: 0, status: 'scheduled' as const, cancel_reason: null, cancelled_at: null, created_at: new Date().toISOString(), is_published: false }),
        id:              existing?.id ?? data.id,
        is_published:    existing?.is_published ?? false,
        class_id:        classId,
        class_name:      cls.name,
        class_type:      cls.class_type,
        session_type:    sessionType,
        instructor:      instructor.trim() || null,
        location:        resolvedLocation,
        color:           cls.color,
        session_date:    date,
        start_time:      startTime,
        end_time:        endTime,
        capacity:        capacity ? parseInt(capacity) : null,
        branch_id:       branchId || null,
        studio_id:       studioId || null,
        walk_in_allowed: walkInAllowed,
      };

      const seriesUpdated = existing && isRecurringSeriesEdit && applyToSeries;
      if (seriesUpdated && data.updated_siblings > 0) {
        toast.success(
          data.updated_siblings === 1
            ? t('sessionModal.seriesUpdatedSiblings', { count: data.updated_siblings })
            : t('sessionModal.seriesUpdatedSiblingsPlural', { count: data.updated_siblings })
        );
      } else {
        toast.success(existing ? t('sessionModal.sessionUpdated') : t('sessionModal.sessionScheduled'));
      }
      onSaved(baseSession);

      if (seriesUpdated && existing && onSeriesUpdated && existing.recurring_template_id) {
        // Mirror the backend's propagation in local state so the schedule
        // reflects sibling changes immediately, before router.refresh()
        // re-runs the server fetch.
        const deltaDays = Math.round(
          (Date.parse(date) - Date.parse(existing.session_date)) / 86_400_000
        );
        onSeriesUpdated({
          templateId: existing.recurring_template_id,
          excludeId: existing.id,
          fromDate: existing.session_date,
          deltaDays,
          fields: {
            start_time: startTime,
            end_time: endTime,
            capacity: capacity ? parseInt(capacity) : null,
            instructor: instructor.trim() || null,
            location: resolvedLocation,
            branch_id: branchId || null,
            studio_id: studioId || null,
            walk_in_allowed: walkInAllowed,
          },
        });
      }

      // Create parallel session if requested
      if (!existing && showParallel && parallelStudioId) {
        const res2 = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBody({ studioId: parallelStudioId, capacity: parallelCapacity || capacity })),
        });
        const data2 = await res2.json();
        if (res2.ok) {
          const parallelStudioName = studios.find(s => s.id === parallelStudioId)?.name ?? null;
          onSaved({
            ...baseSession,
            id:              data2.id,
            booked_count:    0,
            location:        parallelStudioName,
            studio_id:       parallelStudioId,
            instructor:      instructor.trim() || null,
            capacity:        (parallelCapacity || capacity) ? parseInt(parallelCapacity || capacity) : null,
          });
          toast.success(t('sessionModal.parallelScheduled'));
        } else {
          toast.error(t('sessionModal.parallelFailed', { error: data2.error ?? 'Unknown error' }));
        }
      }

      onClose();
    } catch { toast.error(tc('networkError')); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand [color-scheme:dark]';

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><CalendarDays className="w-4 h-4 text-brand" /> {existing ? t('sessionModal.titleEdit') : t('sessionModal.titleNew')}</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {isRecurringSeriesEdit && (
          <div className="bg-brand/10 border border-brand/30 rounded-xl p-3 space-y-2">
            <p className="text-xs text-brand font-medium uppercase tracking-wide flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" />
              {t('sessionModal.recurringSeries')}
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={applyToSeries} onChange={() => setApplyToSeries(true)}
                className="mt-0.5 accent-brand" />
              <div>
                <p className="text-sm text-fg">{t('sessionModal.applyToAll')}</p>
                <p className="text-xs text-fg-muted mt-0.5">{t('sessionModal.applyToAllHint')}</p>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" checked={!applyToSeries} onChange={() => setApplyToSeries(false)}
                className="mt-0.5 accent-brand" />
              <div>
                <p className="text-sm text-fg">{t('sessionModal.applyToThis')}</p>
                <p className="text-xs text-fg-muted mt-0.5">{t('sessionModal.applyToThisHint')}</p>
              </div>
            </label>
          </div>
        )}

        {/* Branch picker — first, filters classes below */}
        {branches.length > 1 && (
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelBranch')} <span className="text-danger">*</span></label>
            <Select value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">{tc('select')}…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
        )}

        {/* Class picker — filtered by selected branch */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelClass')} <span className="text-danger">*</span></label>
          <Select value={classId} onChange={e => setClassId(e.target.value)}>
            {visibleClasses.length === 0
              ? <option value="">{branches.length > 1 && !branchId ? t('sessionModal.selectBranchFirst') : t('sessionModal.noClassesForBranch')}</option>
              : visibleClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
            }
          </Select>
        </div>

        {/* Session Type — required */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelSessionType')} <span className="text-danger">*</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SESSION_TYPES.map(({ value, label, icon: Icon, desc }) => (
              <button key={value} type="button"
                onClick={() => setSessionType(value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                  sessionType === value
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-line bg-surface-3/40 text-fg-muted hover:border-line-strong hover:text-fg'
                }`}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <div className="text-start">
                  <p>{label}</p>
                  <p className="text-fg-faint font-normal mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelDate')} <span className="text-danger">*</span></label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)}
            min={existing ? undefined : todayLocal} className="[color-scheme:dark]" />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelStartTime')} <span className="text-danger">*</span></label>
            <TimeWithAmPm value={startTime} onChange={setStartTime} inputCls={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelEndTime')} <span className="text-danger">*</span></label>
            <TimeWithAmPm value={endTime} onChange={setEndTime} inputCls={inputCls} />
          </div>
        </div>

        {/* Capacity — disabled when this is a walk-in session (no booking
            means no enforced cap). State stays in `capacity` so toggling
            back to booking-required preserves whatever the admin typed. */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">
            {t('sessionModal.labelCapacity')} <span className="text-fg-faint">({t('sessionModal.capacityOptional')})</span>
            {walkInAllowed && (
              <span className="ms-2 text-[10px] uppercase tracking-wider text-fg-faint">
                {t('sessionModal.notEnforcedWalkIn')}
              </span>
            )}
          </label>
          <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)}
            min="1" placeholder={walkInAllowed ? t('sessionModal.notEnforced') : t('sessionModal.unlimited')}
            disabled={walkInAllowed} />
        </div>

        {/* Studio — filtered by selected branch */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelStudio')} <span className="text-danger">*</span></label>
          <Select value={studioId} onChange={e => setStudioId(e.target.value)}
            disabled={branches.length > 1 && !branchId}>
            <option value="">
              {branches.length > 1 && !branchId
                ? t('sessionModal.selectBranchFirst')
                : branchStudios.length === 0
                  ? t('sessionModal.noStudiosForBranch')
                  : t('sessionModal.noStudioAssigned')}
            </option>
            {branchStudios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>

        {/* Booking requirement — only relevant when a studio is selected.
            Displayed state is the inverse of the stored flag: the column
            is `walk_in_allowed` (true = no booking needed), but admins
            think in terms of "does this class need booking?" so the
            toggle is labelled the other way around. ON = booking
            required (today's default), OFF = walk-in. */}
        {studioId && (
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              {(() => {
                const needsBooking = !walkInAllowed;
                return (
                  <>
                    <div onClick={() => setWalkInAllowed(p => !p)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${needsBooking ? 'bg-brand' : 'bg-surface-4'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${needsBooking ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <div>
                      <p className="text-sm text-fg-muted">{t('sessionModal.needsBooking')}</p>
                      <p className="text-xs text-fg-faint mt-0.5">
                        {needsBooking
                          ? t('sessionModal.needsBookingHint')
                          : t('sessionModal.walkInHint')}
                      </p>
                    </div>
                  </>
                );
              })()}
            </label>
          </div>
        )}

        {/* Trainer — dropdown fetched from branch trainers, defaults to class trainer */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">
            {t('sessionModal.labelTrainer')}
            {selectedClass?.instructor && instructor && instructor !== selectedClass.instructor && (
              <button type="button" onClick={() => setInstructor(selectedClass.instructor ?? '')}
                className="ms-2 text-brand hover:text-brand-dim text-xs underline">
                {t('sessionModal.resetToDefault')}
              </button>
            )}
          </label>
          <Select value={instructor} onChange={e => setInstructor(e.target.value)}>
            <option value="">{t('sessionModal.noTrainerAssigned')}</option>
            {trainers.map(tr => (
              <option key={tr.id} value={tr.name}>{tr.name}</option>
            ))}
            {/* Keep class default visible even if not in branch trainer list */}
            {selectedClass?.instructor && !trainers.some(tr => tr.name === selectedClass.instructor) && (
              <option value={selectedClass.instructor}>{selectedClass.instructor} {t('sessionModal.classDefault')}</option>
            )}
            {/* Keep current session value visible if it doesn't match any trainer */}
            {instructor && instructor !== selectedClass?.instructor && !trainers.some(tr => tr.name === instructor) && (
              <option value={instructor}>{instructor}</option>
            )}
          </Select>
        </div>

        {/* Parallel session toggle (new sessions only) */}
        {!existing && (
          <div className="border-t border-line pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setShowParallel(p => !p)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${showParallel ? 'bg-brand' : 'bg-surface-4'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showParallel ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <div>
                <p className="text-sm text-fg-muted flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  {t('sessionModal.parallelSession')}
                </p>
                <p className="text-xs text-fg-faint mt-0.5">{t('sessionModal.parallelSessionHint')}</p>
              </div>
            </label>

            {showParallel && (
              <div className="mt-4 space-y-3 bg-surface-3/30 border border-line rounded-xl p-4">
                <p className="text-xs text-fg-muted font-medium uppercase tracking-wide">{t('sessionModal.parallelSessionTitle')}</p>

                <div>
                  <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelParallelStudio')} <span className="text-danger">*</span></label>
                  <Select value={parallelStudioId} onChange={e => setParallelStudioId(e.target.value)}>
                    <option value="">{t('sessionModal.selectStudio')}</option>
                    {branchStudios.filter(s => s.id !== studioId).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs text-fg-muted mb-1.5">{t('sessionModal.labelParallelCapacity')} <span className="text-fg-faint">({t('sessionModal.parallelCapacityHint')})</span></label>
                  <Input type="number" min="1" value={parallelCapacity} onChange={e => setParallelCapacity(e.target.value)}
                    placeholder={capacity || t('sessionModal.parallelCapacityPlaceholder')} />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={!classId || !date} isLoading={saving}>
          {existing ? tc('saveChanges') : showParallel ? t('sessionModal.scheduleBoth') : t('sessionModal.schedule')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function TimeWithAmPm({ value, onChange, inputCls }: {
  value: string;
  onChange: (v: string) => void;
  inputCls: string;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={inputCls}
    />
  );
}
