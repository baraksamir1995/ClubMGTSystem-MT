'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Zap, Repeat, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymClass } from '@/app/dashboard/classes/page';
import type { WeeklySlot } from './schedule-tab';
import type { TrainerProfile } from '@/components/trainers/trainer-modal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type SessionType = 'popup' | 'recurring';
const SESSION_TYPES: { value: SessionType; label: string; icon: LucideIcon; desc: string }[] = [
  { value: 'popup',     label: 'Pop-up',    icon: Zap,    desc: 'One-off special session' },
  { value: 'recurring', label: 'Recurring', icon: Repeat, desc: 'Repeating weekly class'  },
];

interface Props {
  classes: GymClass[];
  existing?: WeeklySlot;
  defaultDay?: number;
  onClose: () => void;
  onSaved: (slot: WeeklySlot) => void;
}

export default function ScheduleSlotModal({ classes, existing, defaultDay, onClose, onSaved }: Props) {
  const activeClasses = classes.filter(c => c.is_active);

  const [classId,     setClassId]     = useState(existing?.class_id ?? activeClasses[0]?.id ?? '');
  const [day,         setDay]         = useState(existing?.day_of_week ?? defaultDay ?? 1);
  const [startTime,   setStartTime]   = useState(existing?.start_time?.slice(0, 5) ?? '09:00');
  const [endTime,     setEndTime]     = useState(existing?.end_time?.slice(0, 5) ?? '10:00');
  const [instructor,  setInstructor]  = useState(existing?.instructor ?? '');
  const [location,    setLocation]    = useState(existing?.location ?? '');
  const [capacity,    setCapacity]    = useState(existing?.capacity?.toString() ?? '');
  const [sessionType,    setSessionType]    = useState<SessionType>(
    existing?.session_type === 'popup' ? 'popup' : 'recurring',
  );
  const [loading,        setLoading]        = useState(false);
  const [trainers,       setTrainers]       = useState<TrainerProfile[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(true);

  // Auto-fill location from selected class when adding new slot
  useEffect(() => {
    if (!existing) {
      const cls = activeClasses.find(c => c.id === classId);
      if (cls?.location) setLocation(cls.location);
    }
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/trainers')
      .then(r => r.json())
      .then(d => setTrainers((d.trainers ?? []).filter((t: TrainerProfile) => t.is_active)))
      .catch(() => {})
      .finally(() => setLoadingTrainers(false));
  }, []);

  const handleSave = async () => {
    if (!classId)               { toast.error('Select a class'); return; }
    if (!startTime || !endTime) { toast.error('Set start and end time'); return; }
    if (startTime >= endTime)   { toast.error('End time must be after start time'); return; }

    setLoading(true);
    try {
      const body = {
        classId,
        dayOfWeek:   day,
        startTime,
        endTime,
        instructor:  instructor.trim() || null,
        location:    location.trim() || null,
        capacity:    capacity ? parseInt(capacity) : null,
        sessionType,
      };

      const res = existing
        ? await fetch(`/api/schedule/slots/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/schedule/slots',               { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }

      toast.success(existing ? 'Slot updated' : 'Slot added');
      onSaved(data.slot);
      onClose();
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  };

  const inp = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';
  const sel = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500';
  const lbl = 'block text-xs text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">{existing ? 'Edit Schedule Slot' : 'Add Schedule Slot'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Class */}
          <div>
            <label className={lbl}>Class <span className="text-red-400">*</span></label>
            <select value={classId} onChange={e => setClassId(e.target.value)} className={sel}>
              {activeClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Day */}
          <div>
            <label className={lbl}>Day of Week <span className="text-red-400">*</span></label>
            <select value={day} onChange={e => setDay(Number(e.target.value))} className={sel}>
              {DAYS.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
            </select>
          </div>

          {/* Session Type */}
          <div>
            <label className={lbl}>Session Type <span className="text-gray-600">(optional)</span></label>
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

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Start Time <span className="text-red-400">*</span></label>
              <TimeWithAmPm value={startTime} onChange={setStartTime} inputCls={inp} />
            </div>
            <div>
              <label className={lbl}>End Time <span className="text-red-400">*</span></label>
              <TimeWithAmPm value={endTime} onChange={setEndTime} inputCls={inp} />
            </div>
          </div>

          {/* Trainer */}
          <div>
            <label className={lbl}>Trainer <span className="text-gray-600">(optional)</span></label>
            {loadingTrainers ? (
              <div className="h-9 bg-gray-700/40 rounded-lg animate-pulse" />
            ) : (
              <select value={instructor} onChange={e => setInstructor(e.target.value)} className={sel}>
                <option value="">— No trainer assigned —</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Location */}
          <div>
            <label className={lbl}>Location <span className="text-gray-600">(optional)</span></label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Studio A" className={inp} />
          </div>

          {/* Capacity */}
          <div>
            <label className={lbl}>Capacity <span className="text-gray-600">(optional)</span></label>
            <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Max members" className={inp} />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading || !classId}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : (existing ? 'Save Changes' : 'Add Slot')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Time input with AM/PM pill ────────────────────────────────────────────────

function TimeWithAmPm({ value, onChange, inputCls }: {
  value: string;
  onChange: (v: string) => void;
  inputCls: string;
}) {
  const [hRaw, mRaw] = (value || '09:00').split(':').map(Number);
  const period: 'AM' | 'PM' = hRaw >= 12 ? 'PM' : 'AM';

  const setPeriod = (p: 'AM' | 'PM') => {
    if (p === period) return;
    const newH = p === 'PM' ? hRaw + 12 : hRaw - 12;
    onChange(`${String(newH).padStart(2, '0')}:${String(mRaw).padStart(2, '0')}`);
  };

  return (
    <div className="flex gap-2">
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={inputCls + ' flex-1'}
      />
      <div className="flex rounded-lg border border-gray-600 overflow-hidden flex-shrink-0">
        {(['AM', 'PM'] as const).map(p => (
          <button key={p} type="button" onClick={() => setPeriod(p)}
            className={`px-2.5 text-xs font-semibold transition-colors ${
              period === p
                ? 'bg-purple-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}>{p}</button>
        ))}
      </div>
    </div>
  );
}
