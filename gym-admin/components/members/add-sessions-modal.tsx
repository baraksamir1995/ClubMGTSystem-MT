'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const PRESETS = [5, 10, 20, 50];

interface Props {
  membershipId: string;
  memberName: string;
  sessionsUsed: number;
  sessionsTotal: number | null;
  onClose: () => void;
}

export default function AddSessionsModal({ membershipId, memberName, sessionsUsed, sessionsTotal, onClose }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState('');
  const [preset, setPreset]     = useState<number | null>(null);
  const [loading, setLoading]   = useState(false);

  const resolvedSessions = preset ?? (parseInt(sessions) || 0);
  const newTotal = sessionsTotal != null ? sessionsTotal + resolvedSessions : null;

  const handleSubmit = async () => {
    if (!resolvedSessions || resolvedSessions < 1) { toast.error('Enter number of sessions'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/memberships/${membershipId}/add-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extra_sessions: resolvedSessions }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success(`${resolvedSessions} sessions added`);
      onClose();
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Add Sessions</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-400">Adding sessions for <span className="text-white font-medium">{memberName}</span></p>

          {sessionsTotal != null && (
            <div className="bg-gray-700/40 rounded-lg px-4 py-3 text-sm">
              <span className="text-gray-400">Current: </span>
              <span className="text-white">{sessionsUsed} used / {sessionsTotal} total</span>
              <span className="text-gray-400 ml-2">({Math.max(0, sessionsTotal - sessionsUsed)} remaining)</span>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-2">Quick select</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map(p => (
                <button key={p} type="button"
                  onClick={() => { setPreset(p); setSessions(''); }}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    preset === p
                      ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                      : 'border-gray-700 hover:border-gray-600 text-gray-400'
                  }`}>+{p}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1.5">Or enter custom amount</p>
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={sessions}
                onChange={e => { setSessions(e.target.value); setPreset(null); }}
                placeholder="e.g. 15" className={inputCls} />
              <span className="text-xs text-gray-500 whitespace-nowrap">sessions</span>
            </div>
          </div>

          {resolvedSessions > 0 && newTotal != null && (
            <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-lg px-4 py-3 text-sm">
              <span className="text-gray-400">New total: </span>
              <span className="text-emerald-400 font-medium">{newTotal} sessions</span>
              <span className="text-gray-400 ml-2">({Math.max(0, newTotal - sessionsUsed)} remaining)</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-700 flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading || !resolvedSessions}
            className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
            {loading ? 'Adding…' : `Add ${resolvedSessions ? `+${resolvedSessions}` : ''} Sessions`}
          </button>
        </div>
      </div>
    </div>
  );
}
