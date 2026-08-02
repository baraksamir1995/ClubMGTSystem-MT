'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { MemberOption, AttendanceLog, SessionOption } from '@/app/dashboard/attendance/page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { Avatar, Button, Input, Modal, Select } from '@/components/ui';

interface Props {
  members: MemberOption[];
  accessPoints: string[];
  sessionEntryPoints: string[];
  sessionOptions: SessionOption[];
  branches: GymBranch[];
  onClose: () => void;
  onSaved: (log: AttendanceLog) => void;
}

export default function ManualLogModal({ members, accessPoints, sessionEntryPoints: initialSessionEntryPoints, sessionOptions: initialSessionOptions, branches, onClose, onSaved }: Props) {
  const t = useTranslations('attendance');
  const tc = useTranslations('common');

  const [search,      setSearch]      = useState('');
  const [selectedId,  setSelectedId]  = useState('');
  const [checkInAt,   setCheckInAt]   = useState(() => {
    // Use local time for the datetime-local input (not UTC)
    const now = new Date();
    now.setSeconds(0, 0);
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}`;
  });
  const defaultGymEntry = branches.length === 1 ? branches[0].name : t('qrModal.gymMainEntrance');
  const [accessPoint,  setAccessPoint]  = useState(defaultGymEntry);
  const [customPoint,  setCustomPoint]  = useState('');
  const [branchId,     setBranchId]     = useState(branches.length === 1 ? branches[0].id : '');
  const [saving,       setSaving]       = useState(false);

  // Dynamic sessions — re-fetch when selected date changes
  const [dateSessions, setDateSessions] = useState<SessionOption[]>(initialSessionOptions);
  const [dateEntryPoints, setDateEntryPoints] = useState<string[]>(initialSessionEntryPoints);

  useEffect(() => {
    const selectedDate = checkInAt.slice(0, 10); // YYYY-MM-DD
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate === today) {
      // Use the initial sessions passed from server
      setDateSessions(initialSessionOptions);
      setDateEntryPoints(initialSessionEntryPoints);
      return;
    }
    // Fetch sessions for the selected date
    fetch(`/api/sessions?date=${selectedDate}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const rawSessions = data?.sessions ?? data?.data ?? data ?? [];
        const sessions = rawSessions.map((s: any) => ({
          ...s,
          class_name: s.class_name ?? s.class_model?.name ?? null,
          instructor: s.instructor ?? s.class_model?.instructor ?? null,
        }));
        const opts: SessionOption[] = sessions
          .filter((s: any) => s.class_name)
          .map((s: any) => ({
            id: s.id,
            label: s.start_time ? `${s.class_name} - ${s.start_time}` : s.class_name,
            branch_id: s.branch_id ?? null,
            branch_name: s.branch_name ?? branches.find((b: any) => b.id === s.branch_id)?.name ?? null,
            instructor: s.instructor ?? null,
          }));
        setDateSessions(opts);
        setDateEntryPoints(opts.map(o => o.label));
      })
      .catch(() => {
        setDateSessions([]);
        setDateEntryPoints([]);
      });
  }, [checkInAt.slice(0, 10), initialSessionOptions, initialSessionEntryPoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve the selected session (if a class entry point is picked)
  const selectedSession = useMemo(
    () => dateSessions.find(s => s.label === accessPoint) ?? null,
    [dateSessions, accessPoint]
  );

  // When a session is selected, derive branch & specialist from it
  const effectiveBranchId   = selectedSession?.branch_id ?? branchId;
  const effectiveBranchName = selectedSession?.branch_name ?? branches.find(b => b.id === branchId)?.name ?? null;
  const effectiveSpecialist = selectedSession?.instructor ?? null;

  const handleAccessPointChange = (val: string) => {
    setAccessPoint(val);
    // When switching to a session, auto-set branch from session
    const session = dateSessions.find(s => s.label === val);
    if (session?.branch_id) {
      setBranchId(session.branch_id);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return members.slice(0, 20);
    const q = search.toLowerCase();
    return members.filter(m =>
      String(m.member_number ?? '').toLowerCase().includes(q) ||
      m.full_name?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [members, search]);

  const selected = members.find(m => m.id === selectedId);

  // Plan type restrictions for the dropdown
  const planType = selected?.plan_type ?? null;
  const canAccessGym = planType === null || planType === 'duration' || planType === 'duration_session';
  const canAccessClass = planType === null || planType === 'sessions' || planType === 'duration_session';

  const handleSave = async () => {
    if (!selectedId) { toast.error(t('manualModal.selectMemberError')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId:       selectedId,
          checkInAt:      new Date(checkInAt).toISOString(),
          accessPoint:    (accessPoint === '__custom__' ? customPoint.trim() : accessPoint) || null,
          branchId:       effectiveBranchId || null,
          classSessionId: selectedSession?.id ?? null,
          specialistName: effectiveSpecialist ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('manualModal.failedToLog')); return; }

      toast.success(t('manualModal.attendanceLogged'));
      const finalPoint = (accessPoint === '__custom__' ? customPoint.trim() : accessPoint) || null;
      onSaved({
        id:              data.id,
        gym_member_id:   selectedId,
        member_number:   selected!.member_number,
        full_name:       selected!.full_name,
        photo_url:       null,
        check_in_at:     new Date(checkInAt).toISOString(),
        method:          'manual',
        access_point:    finalPoint,
        instructor_name: effectiveSpecialist,
        branch_name:     effectiveBranchName,
        studio_name:     null,
        class_name:      null,
        specialist_name: effectiveSpecialist,
        plan_name:       null,
        plan_type:       null,
      });
      onClose();
    } catch { toast.error(t('manualModal.networkError')); }
    finally { setSaving(false); }
  };

  const fieldBox = 'px-3 py-2 bg-surface border border-line rounded-lg text-sm text-fg-muted';

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><UserCheck className="w-4 h-4 text-brand" aria-hidden /> {t('manualModal.title')}</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Member search */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('manualModal.memberLabel')} <span className="text-danger">*</span></label>
          <div className="mb-2">
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('manualModal.searchPlaceholder')}
              leftIcon={<Search className="w-4 h-4" />} />
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-fg-faint px-2 py-1">{t('manualModal.noMembersFound')}</p>
            )}
            {filtered.map(m => (
              <button key={m.id} type="button"
                onClick={() => setSelectedId(m.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-start transition-colors ${
                  selectedId === m.id ? 'bg-brand/15 border border-brand/40' : 'hover:bg-surface-3/50 border border-transparent'
                }`}>
                <Avatar name={m.full_name ?? m.member_number ?? '?'} size={28} />
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">{m.full_name ?? '—'}</p>
                  <p className="text-xs text-fg-faint font-mono">{m.member_number}</p>
                </div>
                {selectedId === m.id && (
                  <UserCheck className="w-4 h-4 text-brand ms-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Date & time */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('manualModal.checkInDateTime')} <span className="text-danger">*</span></label>
          <Input type="datetime-local" value={checkInAt} onChange={e => setCheckInAt(e.target.value)}
            className="[color-scheme:dark]" />
        </div>

        {/* Entry point */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('manualModal.entryPoint')}</label>
          <Select value={accessPoint} onChange={e => handleAccessPointChange(e.target.value)}>
            <optgroup label={canAccessGym ? t('manualModal.gymAccessGroup') : t('manualModal.gymAccessGroupRestricted')}>
              <option value={defaultGymEntry} disabled={!canAccessGym}>
                {defaultGymEntry}{!canAccessGym ? t('manualModal.planClassOnly') : ''}
              </option>
              {accessPoints
                .filter(p => p !== defaultGymEntry && p !== 'Gym Main Entrance' && !dateEntryPoints.includes(p))
                .map(p => <option key={p} value={p} disabled={!canAccessGym}>{p}</option>)}
            </optgroup>
            {dateEntryPoints.length > 0 && (
              <optgroup label={canAccessClass ? t('manualModal.classSessionGroup') : t('manualModal.classSessionGroupRestricted')}>
                {dateEntryPoints.map(p => <option key={p} value={p} disabled={!canAccessClass}>
                  {p}{!canAccessClass ? t('manualModal.planGymOnly') : ''}
                </option>)}
              </optgroup>
            )}
            <option value="__custom__">{t('manualModal.otherCustom')}</option>
          </Select>
          {accessPoint === '__custom__' && (
            <Input value={customPoint} onChange={e => setCustomPoint(e.target.value)}
              placeholder={t('manualModal.enterEntryPoint')} className="mt-2" />
          )}
        </div>

        {/* Branch */}
        {branches.length > 0 && (
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('manualModal.branchLabel')}</label>
            {selectedSession ? (
              <div className={fieldBox}>
                {effectiveBranchName ?? <span className="text-fg-faint">—</span>}
              </div>
            ) : (
              <Select value={branchId} onChange={e => setBranchId(e.target.value)}>
                <option value="">{t('manualModal.selectBranch')}</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            )}
          </div>
        )}

        {/* Specialist (auto-filled from selected session) */}
        {selectedSession && (
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('manualModal.specialistLabel')}</label>
            <div className={fieldBox}>
              {effectiveSpecialist ?? <span className="text-fg-faint">—</span>}
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={!selectedId} isLoading={saving}>
          {t('manualModal.logCheckin')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
