'use client';

import { useState } from 'react';
import { X, CalendarPlus } from 'lucide-react';
import toast from 'react-hot-toast';

const PRESETS = [
  { label: '7 days',   days: 7 },
  { label: '14 days',  days: 14 },
  { label: '1 month',  days: 30 },
  { label: '3 months', days: 90 },
];

interface Props {
  membershipId: string;
  memberName: string;
  currentExpiry: string | null;
  onClose: () => void;
}

export default function ExtendMembershipModal({ membershipId, memberName, currentExpiry, onClose }: Props) {
  const [days, setDays]       = useState('');
  const [preset, setPreset]   = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const resolvedDays = preset ?? (parseInt(days) || 0);

  const newExpiry = () => {
    if (!resolvedDays) return null;
    const base = currentExpiry && new Date(currentExpiry) > new Date()
      ? new Date(currentExpiry)
      : new Date();
    base.setDate(base.getDate() + resolvedDays);
    return base.toLocaleDateString('en-GB');
  };

  const handleSubmit = async () => {
    if (!resolvedDays || resolvedDays < 1) { toast.error('Enter number of days'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/memberships/${membershipId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extra_days: resolvedDays }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success(`Membership extended by ${resolvedDays} days`);
      onClose();
      window.location.reload();
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
            <CalendarPlus className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Extend Membership</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-400">Extending membership for <span className="text-white font-medium">{memberName}</span></p>

          {currentExpiry && (
            <div className="bg-gray-700/40 rounded-lg px-4 py-3 text-sm">
              <span className="text-gray-400">Current expiry: </span>
              <span className="text-white">{new Date(currentExpiry).toLocaleDateString('en-GB')}</span>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-2">Quick select</p>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map(p => (
                <button key={p.days} type="button"
                  onClick={() => { setPreset(p.days); setDays(''); }}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    preset === p.days
                      ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                      : 'border-gray-700 hover:border-gray-600 text-gray-400'
                  }`}>{p.label}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1.5">Or enter custom days</p>
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={days}
                onChange={e => { setDays(e.target.value); setPreset(null); }}
                placeholder="e.g. 45" className={inputCls} />
              <span className="text-xs text-gray-500 whitespace-nowrap">days</span>
            </div>
          </div>

          {newExpiry() && (
            <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-lg px-4 py-3 text-sm">
              <span className="text-gray-400">New expiry: </span>
              <span className="text-emerald-400 font-medium">{newExpiry()}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-700 flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading || !resolvedDays}
            className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
            {loading ? 'Extending…' : `Extend ${resolvedDays ? `+${resolvedDays}d` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
