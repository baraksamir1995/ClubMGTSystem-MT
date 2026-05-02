'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Search, UserCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { MemberOption, AttendanceLog, SessionOption } from '@/app/dashboard/attendance/page';
import type { GymBranch } from '@/app/dashboard/branches/page';

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
  const defaultGymEntry = branches.length === 1 ? branches[0].name : 'Gym Main Entrance';
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
      m.member_number?.toLowerCase().includes(q) ||
      m.full_name?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [members, search]);

  const selected = members.find(m => m.id === selectedId);

  // Plan type restrictions for the dropdown
  const planType = selected?.plan_type ?? null;
  const canAccessGym = planType === null || planType === 'duration' || planType === 'duration_session';
  const canAccessClass = planType === null || planType === 'sessions' || planType === 'duration_session';

  const handleSave = async () => {
    if (!selectedId) { toast.error('Select a member'); return; }
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
      if (!res.ok) { toast.error(data.error ?? 'Failed to log'); return; }

      toast.success('Attendance logged');
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
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const inp = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Manual Check-in</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Member search */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Member <span className="text-red-400">*</span></label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or ID…"
                className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-xs text-gray-500 px-2 py-1">No members found</p>
              )}
              {filtered.map(m => (
                <button key={m.id} type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedId === m.id ? 'bg-purple-600/20 border border-purple-600/40' : 'hover:bg-gray-700/50 border border-transparent'
                  }`}>
                  <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-purple-400">
                      {String(m.full_name ?? m.member_number ?? '?').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{m.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-500 font-mono">{m.member_number}</p>
                  </div>
                  {selectedId === m.id && (
                    <UserCheck className="w-4 h-4 text-purple-400 ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Date & time */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Check-in Date & Time <span className="text-red-400">*</span></label>
            <input type="datetime-local" value={checkInAt} onChange={e => setCheckInAt(e.target.value)}
              className={inp + ' [color-scheme:dark]'} />
          </div>

          {/* Entry point */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Entry Point</label>
            <select value={accessPoint} onChange={e => handleAccessPointChange(e.target.value)}
              className={inp}>
              <optgroup label={`Gym Access (no session deducted)${!canAccessGym ? ' — not available on this plan' : ''}`}>
                <option value={defaultGymEntry} disabled={!canAccessGym}>
                  {defaultGymEntry}{!canAccessGym ? ' (plan is class-only)' : ''}
                </option>
                {accessPoints
                  .filter(p => p !== defaultGymEntry && p !== 'Gym Main Entrance' && !dateEntryPoints.includes(p))
                  .map(p => <option key={p} value={p} disabled={!canAccessGym}>{p}</option>)}
              </optgroup>
              {dateEntryPoints.length > 0 && (
                <optgroup label={`Class Session (session deducted)${!canAccessClass ? ' — not available on this plan' : ''}`}>
                  {dateEntryPoints.map(p => <option key={p} value={p} disabled={!canAccessClass}>
                    {p}{!canAccessClass ? ' (plan is gym-only)' : ''}
                  </option>)}
                </optgroup>
              )}
              <option value="__custom__">Other (type below)…</option>
            </select>
            {accessPoint === '__custom__' && (
              <input value={customPoint} onChange={e => setCustomPoint(e.target.value)}
                placeholder="Enter entry point name…" className={inp + ' mt-2'} />
            )}
          </div>

          {/* Branch */}
          {branches.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Branch</label>
              {selectedSession ? (
                <div className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-300">
                  {effectiveBranchName ?? <span className="text-gray-500">—</span>}
                </div>
              ) : (
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className={inp}>
                  <option value="">— Select branch —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Specialist (auto-filled from selected session) */}
          {selectedSession && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Specialist</label>
              <div className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-gray-300">
                {effectiveSpecialist ?? <span className="text-gray-500">—</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !selectedId}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Log Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
