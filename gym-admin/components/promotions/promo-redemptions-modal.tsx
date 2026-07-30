'use client';

import { useState, useEffect } from 'react';
import { Users, Loader2, Tag, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PromoCode } from '@/app/dashboard/promotions/page';
import { Modal } from '@/components/ui';

interface Redemption {
  member_number: string;
  full_name: string | null;
  plan_name: string;
  original_price: number;
  discount_amount: number;
  final_price: number;
  currency: string;
  redeemed_at: string;
}

interface Props {
  promo: PromoCode;
  onClose: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export default function PromoRedemptionsModal({ promo, onClose }: Props) {
  const t = useTranslations('promotions');
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    fetch(`/api/promos/${promo.id}/redemptions`)
      .then(r => r.json())
      .then(d => setRedemptions(d.redemptions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [promo.id]);

  const remaining = promo.max_uses != null ? promo.max_uses - promo.usage_count : null;
  const usagePct  = promo.max_uses ? Math.round((promo.usage_count / promo.max_uses) * 100) : null;
  const totalSavings = redemptions.reduce((sum, r) => sum + Number(r.discount_amount), 0);
  const currency = redemptions[0]?.currency ?? 'EGP';

  return (
    <Modal open onClose={onClose} size="xl">
      <Modal.Header>
        <span className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-brand/20 flex items-center justify-center flex-shrink-0">
            <Tag className="w-4 h-4 text-brand" />
          </span>
          <span>
            <span className="font-mono tracking-wider">{promo.code}</span>
            <span className="block text-xs text-fg-muted font-normal">{promo.name}</span>
          </span>
        </span>
      </Modal.Header>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-5 py-4 border-b border-line flex-shrink-0">
          {/* Usage */}
          <div className="bg-surface-3/40 rounded-xl p-3">
            <p className="text-xs text-fg-muted mb-1">{t('redemptionsTitle')}</p>
            <p className="text-2xl font-bold text-fg">{promo.usage_count}</p>
            {promo.max_uses && (
              <p className="text-xs text-fg-faint mt-0.5">{t('ofMax', { max: promo.max_uses })}</p>
            )}
          </div>

          {/* Remaining */}
          <div className={`rounded-xl p-3 ${remaining === 0 ? 'bg-danger-soft' : remaining != null && remaining <= 5 ? 'bg-warning-soft' : 'bg-surface-3/40'}`}>
            <p className="text-xs text-fg-muted mb-1">{t('remainingUses')}</p>
            <p className={`text-2xl font-bold ${remaining === 0 ? 'text-danger' : remaining != null && remaining <= 5 ? 'text-warning' : 'text-fg'}`}>
              {remaining != null ? remaining : '∞'}
            </p>
            {usagePct != null && (
              <div className="mt-1.5">
                <div className="h-1 bg-surface-4 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usagePct >= 100 ? 'bg-danger' : usagePct >= 80 ? 'bg-warning' : 'bg-success'}`}
                    style={{ width: `${Math.min(usagePct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-fg-faint mt-0.5">{t('percentUsed', { pct: usagePct })}</p>
              </div>
            )}
            {remaining === 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3 text-danger" aria-hidden />
                <p className="text-xs text-danger">{t('limitReached')}</p>
              </div>
            )}
          </div>

          {/* Total savings given */}
          <div className="bg-surface-3/40 rounded-xl p-3">
            <p className="text-xs text-fg-muted mb-1">{t('totalDiscountsGiven')}</p>
            <p className="text-xl font-bold text-success">{fmt(totalSavings, currency)}</p>
            <p className="text-xs text-fg-faint mt-0.5">
              {promo.discount_type === 'percent'
                ? t('perUsePercent', { value: promo.discount_value })
                : t('perUseFixed',   { value: fmt(promo.discount_value, currency) })}
            </p>
          </div>
        </div>

        {/* Redemptions list */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-fg-muted" />
            </div>
          ) : redemptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="w-10 h-10 text-fg-faint mb-3" />
              <p className="text-sm text-fg-muted">{t('noRedemptionsYet')}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 z-10">
                <tr className="border-b border-line">
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colMember')}</th>
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colPlan')}</th>
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colDate')}</th>
                  <th className="text-end text-xs text-fg-muted font-medium px-5 py-3">{t('colPricePaid')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {redemptions.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-3/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-fg font-medium">{r.full_name ?? '—'}</p>
                      <p className="text-xs text-fg-faint font-mono">{r.member_number}</p>
                    </td>
                    <td className="px-5 py-3.5 text-fg-muted text-sm">{r.plan_name}</td>
                    <td className="px-5 py-3.5 text-fg-muted text-xs">
                      {new Date(r.redeemed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      <p className="text-xs text-fg-faint line-through">{fmt(r.original_price, r.currency)}</p>
                      <p className="text-sm font-semibold text-success">{fmt(r.final_price, r.currency)}</p>
                      <p className="text-xs text-success">− {fmt(r.discount_amount, r.currency)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
    </Modal>
  );
}
