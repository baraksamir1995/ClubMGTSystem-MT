'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Snowflake, Play, AlertCircle } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

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
  const router = useRouter();
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
      router.refresh();
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
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Snowflake className="w-5 h-5 text-blue-400" />
          </span>
          <span>
            {isFrozen ? 'Unfreeze Membership' : 'Freeze Membership'}
            <span className="block text-fg-muted text-xs font-normal mt-0.5">{memberName}</span>
          </span>
        </span>
      </Modal.Header>

      <Modal.Body className="space-y-5">
        {isFrozen ? (
          <>
            <p className="text-fg-muted text-sm">
              The membership is currently frozen and will resume on{' '}
              <span className="text-fg font-medium">
                {membership.frozen_until
                  ? new Date(membership.frozen_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </span>
              . Resuming now will refund any unused freeze days back to the expiry date.
            </p>
            {error && <p className="text-danger text-sm">{error}</p>}
          </>
        ) : (
          <>
            {/* Plan info */}
            <div className="bg-surface-3/60 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between text-fg-muted">
                <span>Plan</span>
                <span className="text-fg font-medium">{membership.plan_name}</span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>Freeze days available</span>
                <span className={`font-medium ${isDaysExhausted ? 'text-danger' : 'text-fg'}`}>
                  {Math.max(0, daysRemaining)} of {membership.freeze_max_days ?? 0}
                </span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>Freezes used</span>
                <span className={`font-medium ${isCountExhausted ? 'text-danger' : 'text-fg'}`}>
                  {membership.freeze_count} of {membership.freeze_max_count ?? '∞'}
                </span>
              </div>
            </div>

            {/* Limit reached banner */}
            {isLimitReached ? (
              <div className="flex items-start gap-3 bg-danger-soft border border-danger/20 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <p className="text-danger text-sm">
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
                  <label className="block text-fg-muted text-sm font-medium mb-3">How many days?</label>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      onClick={() => setDays(d => Math.max(1, d - 1))}
                      disabled={days <= 1}
                      className="w-10 h-10 rounded-xl bg-surface-3 hover:bg-surface-4 text-fg flex items-center justify-center text-xl font-bold disabled:opacity-30 transition-colors"
                    >
                      −
                    </button>
                    <span className="text-fg text-3xl font-bold w-12 text-center">{days}</span>
                    <button
                      onClick={() => setDays(d => Math.min(maxAllowed, d + 1))}
                      disabled={days >= maxAllowed}
                      className="w-10 h-10 rounded-xl bg-surface-3 hover:bg-surface-4 text-fg flex items-center justify-center text-xl font-bold disabled:opacity-30 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-center text-fg-faint text-xs mt-2">Max {maxAllowed} days</p>
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

            {error && <p className="text-danger text-sm">{error}</p>}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
        {isFrozen ? (
          <Button variant="primary" fullWidth onClick={handleUnfreeze} isLoading={loading} leftIcon={<Play className="w-4 h-4" />}>
            Resume Now
          </Button>
        ) : !isLimitReached && (
          <Button variant="primary" fullWidth onClick={handleFreeze} isLoading={loading} leftIcon={<Snowflake className="w-4 h-4" />}>
            Freeze Plan
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
