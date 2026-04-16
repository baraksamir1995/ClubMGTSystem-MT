'use client';

import { useState, useEffect } from 'react';
import { X, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymClass } from '@/app/dashboard/classes/page';
import type { StaffMember } from './class-modal';

interface Props {
  cls: GymClass;
  onClose: () => void;
  onReassigned: (classId: string, instructor: string | null) => void;
}

export default function ReassignTrainerModal({ cls, onClose, onReassigned }: Props) {
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(cls.instructor ?? '');
  const [saving, setSaving]       = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [custom, setCustom]       = useState('');

  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.json())
      .then(d => {
        const list: StaffMember[] = d.staff ?? [];
        setStaff(list);
        if (cls.instructor) {
          const match = list.find(s => s.full_name === cls.instructor);
          if (!match) { setUseCustom(true); setCustom(cls.instructor); }
        }
      })
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const instructor = useCustom ? custom.trim() || null : selected || null;
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cls.name, classType: cls.class_type,
          description: cls.description, instructor,
          location: cls.location, color: cls.color,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to update'); return; }
      toast.success('Trainer reassigned');
      onReassigned(cls.id, instructor);
      onClose();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Assign Trainer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Class info */}
          <div className="flex items-center gap-2.5 bg-gray-700/40 rounded-xl px-4 py-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
            <div>
              <p className="text-sm text-white font-medium">{cls.name}</p>
              <p className="text-xs text-gray-400 capitalize">{cls.class_type}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Select Trainer</label>
                {staff.length > 0 && (
                  <button onClick={() => { setUseCustom(c => !c); setSelected(''); setCustom(''); }}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                    {useCustom ? '← From staff list' : 'Custom name'}
                  </button>
                )}
              </div>

              {staff.length === 0 || useCustom ? (
                <input value={custom} onChange={e => setCustom(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  placeholder="Trainer name" />
              ) : (
                <select value={selected} onChange={e => setSelected(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                  <option value="">— Remove trainer —</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.full_name}>
                      {s.full_name}{s.role && s.role !== 'staff' ? ` · ${s.role}` : ''}
                    </option>
                  ))}
                </select>
              )}

              {/* Preview */}
              {((!useCustom && selected) || (useCustom && custom.trim())) && (
                <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                  <User className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-white font-medium">{useCustom ? custom : selected}</p>
                    {!useCustom && <p className="text-xs text-gray-500">{staff.find(s => s.full_name === selected)?.email ?? ''}</p>}
                  </div>
                  <span className="ml-auto text-xs text-purple-400 font-medium">Assigned</span>
                </div>
              )}

              {/* Current */}
              {cls.instructor && (
                <p className="text-xs text-gray-500">
                  Current: <span className="text-gray-400">{cls.instructor}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || loading}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Assign Trainer'}
          </button>
        </div>
      </div>
    </div>
  );
}
