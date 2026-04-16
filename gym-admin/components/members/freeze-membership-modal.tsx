'use client';

import { useState } from 'react';
import { Snowflake, X, Play, AlertCircle } from 'lucide-react';

interface ActiveMembership {
  id: string;
  plan_name: string;
  end_date: string | null;
  freeze_status: string | null;
  freeze_days_used: number;
  freeze_max_days: number | null;
  freeze_count: number;
  freeze_max_count: number | null;
  frozen_until: string | null;
}

interface Props {
  membership: ActiveMembership;
  memberName: string;
  onClose: () => void;
}

export default function FreezeMembershipModal({ membership, memberName, onClose }: Props) {
  const isFrozen = membership.freeze_status === 'frozen';
  const [days, setDays] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysRemaining    = (membership.freeze_max_days  ?? 0) - membership.freeze_days_used;
  const freezesRemaining = (membership.freeze_max_count ?? 0) - membership.freeze_count;
  const isDaysExhausted  = membership.freeze_max_days  != null && daysRemaining  <= 0;
  const isCountExhausted = membership.freeze_max_count != null && freezesRemaining <= 0;
  const isLimitReached   = isDaysExhausted || isCountExhausted;

  const daysUntilExpiry = membership.end_date
    ? Math.ceil((new Date(membership.end_date).getTime() - Date.now()) / 86_400_000)
    : 0;
  const maxAllowed = Math.max(0, Math.min(daysRemaining, daysUntilExpiry));

  const newExpiry = membership.end_date
    ? new Date(new Date(membership.end_date).getTime() + days * 86_400_000)
    : null;

  async function handleFreeze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memberships/${membership.id}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'freeze', days }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to freeze membership');
      }
      onClose();
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnfreeze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memberships/${membership.id}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unfreeze' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to unfreeze membership');
      }
      onClose();
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700/50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Snowflake className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">
                {isFrozen ? 'Unfreeze Membership' : 'Freeze Membership'}
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">{memberName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isFrozen ? (
            <>
              <p className="text-gray-300 text-sm">
                The membership is currently frozen and will resume on{' '}
                <span className="text-white font-medium">
                  {membership.frozen_until
                    ? new Date(membership.frozen_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </span>
                . Resuming now will refund any unused freeze days back to the expiry date.
              </p>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnfreeze}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {loading ? 'Resuming…' : 'Resume Now'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Plan info */}
              <div className="bg-gray-800/60 rounded-xl p-4 text-sm space-y-2">
                <div className="flex justify-between text-gray-400">
                  <span>Plan</span>
                  <span className="text-white font-medium">{membership.plan_name}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Freeze days available</span>
                  <span className={`font-medium ${isDaysExhausted ? 'text-red-400' : 'text-white'}`}>
                    {Math.max(0, daysRemaining)} of {membership.freeze_max_days ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Freezes used</span>
                  <span className={`font-medium ${isCountExhausted ? 'text-red-400' : 'text-white'}`}>
                    {membership.freeze_count} of {membership.freeze_max_count ?? '∞'}
                  </span>
                </div>
              </div>

              {/* Limit reached banner */}
              {isLimitReached ? (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">
                    {isDaysExhausted
                      ? `All ${membership.freeze_max_days} freeze days have been used for this plan.`
                      : `Maximum freeze count (${membership.freeze_max_count}) has been reached for this plan.`}
                    {' '}No further freezes are allowed.
                  </p>
                </div>
              ) : (
                <>
                  {/* Day picker */}
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-3">How many days?</label>
                    <div className="flex items-center justify-center gap-6">
                      <button
                        onClick={() => setDays(d => Math.max(1, d - 1))}
                        disabled={days <= 1}
                        className="w-10 h-10 rounded-xl bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-xl font-bold disabled:opacity-30 transition-colors"
                      >
                        −
                      </button>
                      <span className="text-white text-3xl font-bold w-12 text-center">{days}</span>
                      <button
                        onClick={() => setDays(d => Math.min(maxAllowed, d + 1))}
                        disabled={days >= maxAllowed}
                        className="w-10 h-10 rounded-xl bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-xl font-bold disabled:opacity-30 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-center text-gray-500 text-xs mt-2">Max {maxAllowed} days</p>
                  </div>

                  {/* New expiry preview */}
                  {newExpiry && (
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-sm">
                      <Snowflake className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-blue-300">
                        New expiry:{' '}
                        <span className="font-semibold text-blue-200">
                          {newExpiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </span>
                    </div>
                  )}
                </>
              )}

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {!isLimitReached && (
                  <button
                    onClick={handleFreeze}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Snowflake className="w-4 h-4" />
                    {loading ? 'Freezing…' : 'Freeze Plan'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
