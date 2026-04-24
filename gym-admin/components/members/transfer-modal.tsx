'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ArrowRight, Search, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Member {
  id: string;
  member_number: string;
  full_name: string | null;
  email: string | null;
}

interface ActiveMembership {
  plan_name: string;
  end_date: string | null;
  sessions_remaining: number | null;
}

interface Props {
  sourceMemberId: string;
  sourceMemberName: string;
  activeMembership: ActiveMembership | null;
  gymMembers: Member[];
  onClose: () => void;
}

export default function TransferModal({
  sourceMemberId,
  sourceMemberName,
  activeMembership,
  gymMembers,
  onClose,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);
  const [step, setStep] = useState<'select' | 'review'>('select');
  const [loading, setLoading] = useState(false);

  const filtered = gymMembers.filter(m => {
    if (m.id === sourceMemberId) return false;
    const q = search.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(q) ||
      String(m.member_number ?? '').toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  });

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${sourceMemberId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination_member_id: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Transfer failed'); return; }
      toast.success('Membership transferred successfully');
      onClose();
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">Transfer Membership</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'select' ? (
          <div className="p-5 space-y-4">
            {/* Source */}
            <div className="bg-gray-700/40 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-500 mb-1">Transferring FROM</p>
              <p className="text-sm font-medium text-white">{sourceMemberName}</p>
              {activeMembership ? (
                <p className="text-xs text-purple-400 mt-0.5">{activeMembership.plan_name}</p>
              ) : (
                <p className="text-xs text-red-400 mt-0.5">No active membership</p>
              )}
            </div>

            {/* Search destination */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Search destination member</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Name, member #, or email…"
                  className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Member list */}
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No members found</p>
              )}
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    selected?.id === m.id
                      ? 'bg-purple-500/20 border border-purple-500'
                      : 'hover:bg-gray-700/50 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                    {String(m.full_name ?? m.member_number ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{m.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{m.member_number} · {m.email ?? ''}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button" onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!selected || !activeMembership}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                Review <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Transfer summary */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700/40 rounded-lg p-3 border border-gray-700 text-center">
                  <p className="text-xs text-gray-500 mb-1">From</p>
                  <p className="text-sm font-medium text-white">{sourceMemberName}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <div className="flex-1 bg-gray-700/40 rounded-lg p-3 border border-purple-500/40 text-center">
                  <p className="text-xs text-gray-500 mb-1">To</p>
                  <p className="text-sm font-medium text-white">{selected?.full_name ?? '—'}</p>
                </div>
              </div>

              <div className="bg-gray-700/40 rounded-lg p-4 border border-gray-700 space-y-2">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Membership being transferred</p>
                <p className="text-sm text-white font-semibold">{activeMembership?.plan_name}</p>
                {activeMembership?.end_date && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Expiry</span>
                    <span className="text-xs text-white">{new Date(activeMembership.end_date).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
                {activeMembership?.sessions_remaining != null && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Sessions remaining</span>
                    <span className="text-xs text-white">{activeMembership.sessions_remaining}</span>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/30 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  This will cancel the source member's active plan and transfer the remaining duration to the destination member. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Transferring…' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
