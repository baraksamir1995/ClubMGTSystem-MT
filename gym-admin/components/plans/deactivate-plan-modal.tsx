'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Users, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { Plan } from '@/app/dashboard/plans/page';

interface ActiveMember {
  member_id: string;
  member_number: string;
  full_name: string;
  email: string;
  start_date: string | null;
  end_date: string | null;
  sessions_remaining: number | null;
}

interface Props {
  plan: Plan;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export default function DeactivatePlanModal({ plan, onConfirm, onClose }: Props) {
  const [members, setMembers]   = useState<ActiveMember[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    fetch(`/api/plans/${plan.id}/members`)
      .then(r => r.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .finally(() => setFetching(false));
  }, [plan.id]);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-white">Deactivate Plan</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Plan info */}
          <div className="bg-gray-700/40 rounded-xl p-4">
            <p className="text-sm font-medium text-white">{plan.name}</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{plan.plan_type} · {plan.billing_cycle ?? 'one-time'}</p>
          </div>

          {/* What happens */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">What this means</p>
            <div className="space-y-2">
              {[
                { icon: '🚫', text: 'This plan will no longer appear when assigning plans to new members.' },
                { icon: '✅', text: 'Existing members already on this plan will not be affected — their membership continues normally.' },
                { icon: '↩️', text: 'You can reactivate this plan at any time.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-2.5 text-sm text-gray-300">
                  <span className="flex-shrink-0">{item.icon}</span>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Members on this plan */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Members currently on this plan
              </p>
            </div>

            {fetching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <div className="flex items-center gap-2.5 p-3 bg-gray-700/30 rounded-xl">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-gray-300">No members are currently assigned to this plan.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-amber-400 mb-2">
                  ⚠ {members.length} member{members.length > 1 ? 's are' : ' is'} on this plan — their access will continue uninterrupted.
                </p>
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                  {members.map(m => (
                    <Link
                      key={m.member_id}
                      href={`/dashboard/members/${m.member_id}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-700/40 hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                        {String(m.full_name ?? m.member_number ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{m.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{m.email || m.member_number}</p>
                      </div>
                      {m.end_date && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          until {new Date(m.end_date).toLocaleDateString('en-GB')}
                        </span>
                      )}
                      {m.sessions_remaining != null && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {m.sessions_remaining} sessions left
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
            {loading ? 'Deactivating…' : 'Deactivate Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
