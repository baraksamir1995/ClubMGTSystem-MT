'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Snowflake, Play, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('members.freeze');
  const tc = useTranslations('common');
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
        throw new Error(body.error ?? t('toast.freezeFailed'));
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
        throw new Error(body.error ?? t('toast.unfreezeFailed'));
      }
      onClose();
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const frozenUntilDate = membership.frozen_until
    ? new Date(membership.frozen_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-info-soft flex items-center justify-center">
            <Snowflake className="w-5 h-5 text-info" aria-hidden />
          </span>
          <span>
            {isFrozen ? t('titleUnfreeze') : t('titleFreeze')}
            <span className="block text-fg-muted text-xs font-normal mt-0.5">{memberName}</span>
          </span>
        </span>
      </Modal.Header>

      <Modal.Body className="space-y-5">
        {isFrozen ? (
          <>
            <p className="text-fg-muted text-sm">
              {t('resumeDesc', { date: frozenUntilDate })}
            </p>
            {error && <p className="text-danger text-sm">{error}</p>}
          </>
        ) : (
          <>
            {/* Plan info */}
            <div className="bg-surface-3/60 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between text-fg-muted">
                <span>{t('plan')}</span>
                <span className="text-fg font-medium">{membership.plan_name}</span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>{t('freezeDaysAvailable')}</span>
                <span className={`font-medium ${isDaysExhausted ? 'text-danger' : 'text-fg'}`}>
                  {Math.max(0, daysRemaining)} of {membership.freeze_max_days ?? 0}
                </span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>{t('freezesUsed')}</span>
                <span className={`font-medium ${isCountExhausted ? 'text-danger' : 'text-fg'}`}>
                  {membership.freeze_count} of {membership.freeze_max_count ?? '∞'}
                </span>
              </div>
            </div>

            {/* Limit reached banner */}
            {isLimitReached ? (
              <div className="flex items-start gap-3 bg-danger-soft border border-danger/20 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" aria-hidden />
                <p className="text-danger text-sm">
                  {isDaysExhausted
                    ? t('limitReachedDays', { max: membership.freeze_max_days ?? 0 })
                    : t('limitReachedCount', { max: membership.freeze_max_count ?? 0 })}
                  {t('limitReachedSuffix')}
                </p>
              </div>
            ) : (
              <>
                {/* Day picker */}
                <div>
                  <label className="block text-fg-muted text-sm font-medium mb-3">{t('howManyDays')}</label>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      type="button"
                      aria-label="Decrease days"
                      onClick={() => setDays(d => Math.max(1, d - 1))}
                      disabled={days <= 1}
                      className="w-10 h-10 rounded-xl bg-surface-3 hover:bg-surface-4 text-fg flex items-center justify-center text-xl font-bold disabled:opacity-30 transition-colors"
                    >
                      −
                    </button>
                    <span className="text-fg text-3xl font-bold w-12 text-center">{days}</span>
                    <button
                      type="button"
                      aria-label="Increase days"
                      onClick={() => setDays(d => Math.min(maxAllowed, d + 1))}
                      disabled={days >= maxAllowed}
                      className="w-10 h-10 rounded-xl bg-surface-3 hover:bg-surface-4 text-fg flex items-center justify-center text-xl font-bold disabled:opacity-30 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-center text-fg-faint text-xs mt-2">{t('maxDays', { max: maxAllowed })}</p>
                </div>

                {/* New expiry preview */}
                {newExpiry && (
                  <div className="flex items-center gap-2 bg-info-soft border border-info/40 rounded-xl p-3 text-sm">
                    <Snowflake className="w-4 h-4 text-info shrink-0" aria-hidden />
                    <span className="text-info">
                      {t('newExpiry')}
                      <span className="font-semibold text-info">
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
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>{tc('cancel')}</Button>
        {isFrozen ? (
          <Button variant="primary" fullWidth onClick={handleUnfreeze} isLoading={loading} leftIcon={<Play className="w-4 h-4" />}>
            {t('resumeNow')}
          </Button>
        ) : !isLimitReached && (
          <Button variant="primary" fullWidth onClick={handleFreeze} isLoading={loading} leftIcon={<Snowflake className="w-4 h-4" />}>
            {t('freezePlan')}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
