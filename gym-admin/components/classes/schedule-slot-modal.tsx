'use client';

import { useState, useEffect } from 'react';
import { Zap, Repeat, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { GymClass } from '@/app/dashboard/classes/page';
import type { WeeklySlot } from './schedule-tab';
import type { TrainerProfile } from '@/components/trainers/trainer-modal';
import { Button, Input, Modal, Select } from '@/components/ui';

type SessionType = 'popup' | 'recurring';

interface Props {
  classes: GymClass[];
  existing?: WeeklySlot;
  defaultDay?: number;
  onClose: () => void;
  onSaved: (slot: WeeklySlot) => void;
}

export default function ScheduleSlotModal({ classes, existing, defaultDay, onClose, onSaved }: Props) {
  const t  = useTranslations('classes');
  const tc = useTranslations('common');

  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

  const SESSION_TYPES: { value: SessionType; label: string; icon: LucideIcon; desc: string }[] = [
    { value: 'popup',     label: t('scheduleSlot.popupLabel'),     icon: Zap,    desc: t('scheduleSlot.popupDesc') },
    { value: 'recurring', label: t('scheduleSlot.recurringLabel'), icon: Repeat, desc: t('scheduleSlot.recurringDesc') },
  ];

  const activeClasses = classes.filter(c => c.is_active);

  const [classId,          setClassId]          = useState(existing?.class_id ?? activeClasses[0]?.id ?? '');
  const [day,              setDay]              = useState(existing?.day_of_week ?? defaultDay ?? 1);
  const [startTime,        setStartTime]        = useState(existing?.start_time?.slice(0, 5) ?? '09:00');
  const [endTime,          setEndTime]          = useState(existing?.end_time?.slice(0, 5) ?? '10:00');
  const [instructor,       setInstructor]       = useState(existing?.instructor ?? '');
  const [location,         setLocation]         = useState(existing?.location ?? '');
  const [capacity,         setCapacity]         = useState(existing?.capacity?.toString() ?? '');
  const [sessionType,      setSessionType]      = useState<SessionType>(
    existing?.session_type === 'popup' ? 'popup' : 'recurring',
  );
  const [loading,          setLoading]          = useState(false);
  const [trainers,         setTrainers]         = useState<TrainerProfile[]>([]);
  const [loadingTrainers,  setLoadingTrainers]  = useState(true);

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
      .then(d => setTrainers((d.trainers ?? []).filter((tr: TrainerProfile) => tr.is_active)))
      .catch(() => {})
      .finally(() => setLoadingTrainers(false));
  }, []);

  const handleSave = async () => {
    if (!classId)               { toast.error(t('scheduleSlot.selectClass')); return; }
    if (!startTime || !endTime) { toast.error(t('scheduleSlot.setStartEndTime')); return; }
    if (startTime >= endTime)   { toast.error(t('scheduleSlot.endTimeAfterStart')); return; }

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
      if (!res.ok) { toast.error(data.error ?? t('scheduleSlot.failedToSave')); return; }

      toast.success(existing ? t('scheduleSlot.slotUpdated') : t('scheduleSlot.slotAdded'));
      onSaved(data.slot);
      onClose();
    } catch { toast.error(t('scheduleSlot.networkError')); }
    finally { setLoading(false); }
  };

  const inp = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand';
  const lbl = 'block text-xs text-fg-muted mb-1.5';

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>{existing ? t('scheduleSlot.titleEdit') : t('scheduleSlot.titleNew')}</Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Class */}
        <div>
          <label className={lbl}>{t('scheduleSlot.labelClass')} <span className="text-danger">*</span></label>
          <Select value={classId} onChange={e => setClassId(e.target.value)}>
            {activeClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>

        {/* Day */}
        <div>
          <label className={lbl}>{t('scheduleSlot.labelDayOfWeek')} <span className="text-danger">*</span></label>
          <Select value={day} onChange={e => setDay(Number(e.target.value))}>
            {DAY_KEYS.map((key, i) => (
              <option key={i + 1} value={i + 1}>{t(`schedule.daysFull.${key}`)}</option>
            ))}
          </Select>
        </div>

        {/* Session Type */}
        <div>
          <label className={lbl}>{t('scheduleSlot.labelSessionType')} <span className="text-fg-faint">{t('scheduleSlot.sessionTypeOptional')}</span></label>
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

        {/* Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>{t('scheduleSlot.labelStartTime')} <span className="text-danger">*</span></label>
            <TimeWithAmPm value={startTime} onChange={setStartTime} inputCls={inp} />
          </div>
          <div>
            <label className={lbl}>{t('scheduleSlot.labelEndTime')} <span className="text-danger">*</span></label>
            <TimeWithAmPm value={endTime} onChange={setEndTime} inputCls={inp} />
          </div>
        </div>

        {/* Trainer */}
        <div>
          <label className={lbl}>{t('scheduleSlot.labelTrainer')} <span className="text-fg-faint">{t('scheduleSlot.trainerOptional')}</span></label>
          {loadingTrainers ? (
            <div className="h-9 bg-surface-3/40 rounded-lg animate-pulse" />
          ) : (
            <Select value={instructor} onChange={e => setInstructor(e.target.value)}>
              <option value="">{t('scheduleSlot.noTrainerAssigned')}</option>
              {trainers.map(tr => (
                <option key={tr.id} value={tr.name}>{tr.name}</option>
              ))}
            </Select>
          )}
        </div>

        {/* Location */}
        <div>
          <label className={lbl}>{t('scheduleSlot.labelLocation')} <span className="text-fg-faint">{t('scheduleSlot.locationOptional')}</span></label>
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('scheduleSlot.locationPlaceholder')} />
        </div>

        {/* Capacity */}
        <div>
          <label className={lbl}>{t('scheduleSlot.labelCapacity')} <span className="text-fg-faint">{t('scheduleSlot.capacityOptional')}</span></label>
          <Input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder={t('scheduleSlot.capacityPlaceholder')} />
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={!classId} isLoading={loading}>
          {existing ? tc('saveChanges') : t('scheduleSlot.addSlot')}
        </Button>
      </Modal.Footer>
    </Modal>
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
      <div className="flex rounded-lg border border-line overflow-hidden flex-shrink-0">
        {(['AM', 'PM'] as const).map(p => (
          <button key={p} type="button" onClick={() => setPeriod(p)}
            className={`px-2.5 text-xs font-semibold transition-colors ${
              period === p
                ? 'bg-brand text-brand-ink'
                : 'bg-surface text-fg-muted hover:text-fg'
            }`}>{p}</button>
        ))}
      </div>
    </div>
  );
}
