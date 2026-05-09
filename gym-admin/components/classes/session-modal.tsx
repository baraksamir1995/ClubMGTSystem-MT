'use client';

import { useState, useEffect, useRef } from 'react';
import { X, CalendarDays, Zap, Repeat, Copy, type LucideIcon } from 'lucide-react'; // Copy used in parallel toggle
import toast from 'react-hot-toast';
import type { GymClass, ClassSession, GymBranch, GymStudio } from '@/app/dashboard/classes/page';


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

const SESSION_TYPES: { value: SessionType; label: string; icon: LucideIcon; desc: string }[] = [
  { value: 'popup',     label: 'Pop-up',    icon: Zap,    desc: 'One-off special session' },
  { value: 'recurring', label: 'Recurring', icon: Repeat, desc: 'Repeating weekly class' },
];

export default function SessionModal({ classes, branches, studios, existing, defaultClassId, defaultDate, defaultBranchId, onClose, onSaved, onSavedMultiple, onSeriesUpdated }: Props) {
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
    if (!classId || !date || !startTime || !endTime) { toast.error('Fill in all required fields'); return; }
    if (branches.length > 1 && !branchId) { toast.error('Please select a branch'); return; }
    if (!studioId) { toast.error('Please select a studio'); return; }
    if (startTime >= endTime) { toast.error('End time must be after start time'); return; }
    if (showParallel && !parallelStudioId) { toast.error('Select a studio for the parallel session'); return; }

    setSaving(true);
    try {
      // Save main session
      const res = await fetch(existing ? `/api/sessions/${existing.id}` : '/api/sessions', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }

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
        toast.success(`Recurring session scheduled — ${recurringSessions.length} weeks generated`);
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
        toast.success(`Session updated — ${data.updated_siblings} upcoming sibling${data.updated_siblings === 1 ? '' : 's'} also updated`);
      } else {
        toast.success(existing ? 'Session updated' : 'Session scheduled');
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
          toast.success('Parallel session also scheduled');
        } else {
          toast.error(`Parallel session failed: ${data2.error ?? 'Unknown error'}`);
        }
      }

      onClose();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 [color-scheme:dark]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">{existing ? 'Edit Session' : 'Schedule Session'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isRecurringSeriesEdit && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 space-y-2">
              <p className="text-xs text-purple-300 font-medium uppercase tracking-wide flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5" />
                Recurring Series
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" checked={applyToSeries} onChange={() => setApplyToSeries(true)}
                  className="mt-0.5 accent-purple-500" />
                <div>
                  <p className="text-sm text-white">Apply to this and all upcoming sessions</p>
                  <p className="text-xs text-gray-400 mt-0.5">Date changes shift the whole series by the same number of days.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" checked={!applyToSeries} onChange={() => setApplyToSeries(false)}
                  className="mt-0.5 accent-purple-500" />
                <div>
                  <p className="text-sm text-white">Apply to this session only</p>
                  <p className="text-xs text-gray-400 mt-0.5">Detaches this instance from the rest of the series.</p>
                </div>
              </label>
            </div>
          )}

          {/* Branch picker — first, filters classes below */}
          {branches.length > 1 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Branch <span className="text-red-400">*</span></label>
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* Class picker — filtered by selected branch */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Class <span className="text-red-400">*</span></label>
            <select value={classId} onChange={e => setClassId(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
              {visibleClasses.length === 0
                ? <option value="">{branches.length > 1 && !branchId ? 'Select a branch first' : 'No classes for this branch'}</option>
                : visibleClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              }
            </select>
          </div>

          {/* Session Type — required */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Session Type <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_TYPES.map(({ value, label, icon: Icon, desc }) => (
                <button key={value} type="button"
                  onClick={() => setSessionType(value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                    sessionType === value
                      ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                      : 'border-gray-600 bg-gray-700/40 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  }`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <div className="text-left">
                    <p>{label}</p>
                    <p className="text-gray-600 font-normal mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Date <span className="text-red-400">*</span></label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              min={existing ? undefined : todayLocal} className={inputCls} />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Start Time <span className="text-red-400">*</span></label>
              <TimeWithAmPm value={startTime} onChange={setStartTime} inputCls={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">End Time <span className="text-red-400">*</span></label>
              <TimeWithAmPm value={endTime} onChange={setEndTime} inputCls={inputCls} />
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Capacity <span className="text-gray-500">(optional)</span></label>
            <input type="number" value={capacity} onChange={e => setCapacity(e.target.value)}
              min="1" placeholder="Unlimited"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
          </div>

          {/* Studio — filtered by selected branch */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Studio <span className="text-red-400">*</span></label>
            <select value={studioId} onChange={e => setStudioId(e.target.value)}
              disabled={branches.length > 1 && !branchId}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50">
              <option value="">
                {branches.length > 1 && !branchId
                  ? 'Select a branch first'
                  : branchStudios.length === 0
                    ? 'No studios for this branch'
                    : 'No studio assigned'}
              </option>
              {branchStudios.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Walk-in toggle — only relevant when a studio is selected */}
          {studioId && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setWalkInAllowed(p => !p)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${walkInAllowed ? 'bg-purple-600' : 'bg-gray-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${walkInAllowed ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-300">Allow walk-ins</p>
                  <p className="text-xs text-gray-500 mt-0.5">Members can scan the studio QR without booking</p>
                </div>
              </label>
            </div>
          )}

          {/* Trainer — dropdown fetched from branch trainers, defaults to class trainer */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Trainer
              {selectedClass?.instructor && instructor && instructor !== selectedClass.instructor && (
                <button type="button" onClick={() => setInstructor(selectedClass.instructor ?? '')}
                  className="ml-2 text-purple-400 hover:text-purple-300 text-xs underline">
                  Reset to default
                </button>
              )}
            </label>
            <select
              value={instructor}
              onChange={e => setInstructor(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">No trainer assigned</option>
              {trainers.map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
              {/* Keep class default visible even if not in branch trainer list */}
              {selectedClass?.instructor && !trainers.some(t => t.name === selectedClass.instructor) && (
                <option value={selectedClass.instructor}>{selectedClass.instructor} (class default)</option>
              )}
              {/* Keep current session value visible if it doesn't match any trainer */}
              {instructor && instructor !== selectedClass?.instructor && !trainers.some(t => t.name === instructor) && (
                <option value={instructor}>{instructor}</option>
              )}
            </select>
          </div>

          {/* Parallel session toggle (new sessions only) */}
          {!existing && (
            <div className="border-t border-gray-700 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setShowParallel(p => !p)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${showParallel ? 'bg-purple-600' : 'bg-gray-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showParallel ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-300 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5" />
                    Add parallel session at the same time
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Same class, same time — different studio</p>
                </div>
              </label>

              {showParallel && (
                <div className="mt-4 space-y-3 bg-gray-700/30 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Parallel Session</p>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Studio <span className="text-red-400">*</span></label>
                    <select value={parallelStudioId} onChange={e => setParallelStudioId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                      <option value="">Select studio…</option>
                      {branchStudios.filter(s => s.id !== studioId).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Capacity <span className="text-gray-600">(optional — defaults to main)</span></label>
                    <input type="number" min="1" value={parallelCapacity} onChange={e => setParallelCapacity(e.target.value)}
                      placeholder={capacity || 'Same as main session'}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !classId || !date}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : existing ? 'Save Changes' : showParallel ? 'Schedule Both' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
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
