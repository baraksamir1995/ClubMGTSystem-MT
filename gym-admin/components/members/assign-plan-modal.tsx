'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Tag, Percent, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button, Input, Modal, Select } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  plan_type: string;
  duration_days: number | null;
  session_count: number | null;
}

interface PromoOption {
  id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
}

interface PlanPromoOption {
  id: string;
  promo_price: number;
  valid_from: string;
  valid_until: string;
}

interface Props {
  memberId: string;
  plans: Plan[];
  currentPlanId?: string | null;
  onClose: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export default function AssignPlanModal({ memberId, plans, currentPlanId, onClose }: Props) {
  const t = useTranslations('members.assignPlan');
  const tc = useTranslations('common');
  const router = useRouter();
  const [selectedPlanId,    setSelectedPlanId]    = useState(currentPlanId ?? '');
  const [startDate,         setStartDate]         = useState(new Date().toISOString().slice(0, 10));
  const [loading,           setLoading]           = useState(false);

  const [promoCodes,        setPromoCodes]        = useState<PromoOption[]>([]);
  const [planPromo,         setPlanPromo]         = useState<PlanPromoOption | null>(null);
  const [loadingDiscounts,  setLoadingDiscounts]  = useState(false);
  const [discountMode,      setDiscountMode]      = useState<'none' | 'promo_code' | 'plan_promo'>('none');
  const [selectedPromoId,   setSelectedPromoId]   = useState('');

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const isChange = !!currentPlanId;
  const today = new Date().toISOString().slice(0, 10);

  // When plan changes, fetch available discounts
  useEffect(() => {
    setDiscountMode('none');
    setSelectedPromoId('');
    setPlanPromo(null);
    setPromoCodes([]);
    if (!selectedPlanId) return;

    setLoadingDiscounts(true);
    Promise.all([
      fetch('/api/promos').then(r => r.json()),
      fetch('/api/promos/plan-pricing').then(r => r.json()),
    ]).then(([promoData, planPromoData]) => {
      const codes: PromoOption[] = (promoData.promos ?? []).filter((p: any) =>
        p.is_active &&
        (!p.valid_from  || p.valid_from  <= today) &&
        (!p.valid_until || p.valid_until >= today) &&
        (!p.max_uses    || p.usage_count < p.max_uses)
      );
      setPromoCodes(codes);

      const pp = (planPromoData.promotions ?? []).find((p: any) =>
        p.plan_id === selectedPlanId &&
        p.valid_from  <= today &&
        p.valid_until >= today
      );
      setPlanPromo(pp ?? null);
    }).catch(() => {}).finally(() => setLoadingDiscounts(false));
  }, [selectedPlanId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute final price
  const originalPrice = selectedPlan?.price ?? 0;
  const currency      = selectedPlan?.currency ?? 'EGP';

  const discountAmount = (() => {
    if (discountMode === 'plan_promo' && planPromo) {
      return originalPrice - planPromo.promo_price;
    }
    if (discountMode === 'promo_code' && selectedPromoId) {
      const code = promoCodes.find(c => c.id === selectedPromoId);
      if (!code) return 0;
      return code.discount_type === 'percentage'
        ? originalPrice * (code.discount_value / 100)
        : Math.min(code.discount_value, originalPrice);
    }
    return 0;
  })();

  const finalPrice = Math.max(0, originalPrice - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) { toast.error(t('toast.selectPlan')); return; }
    if (!startDate)      { toast.error(t('toast.setStartDate')); return; }

    setLoading(true);
    try {
      const body: Record<string, any> = { plan_id: selectedPlanId, start_date: startDate };
      if (discountMode === 'promo_code' && selectedPromoId) body.promo_code_id = selectedPromoId;
      if (discountMode === 'plan_promo' && planPromo)       body.plan_promotion_id = planPromo.id;

      const res = await fetch(`/api/members/${memberId}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tc('somethingWrong')); return; }
      toast.success(isChange ? t('toast.planChanged') : t('toast.planAssigned'));
      onClose();
      router.refresh();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand" /> {isChange ? t('titleChange') : t('title')}
        </span>
      </Modal.Header>

      <Modal.Body>
        <form id="assign-plan-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Plan selection */}
          <div>
            <label className="block text-xs text-fg-muted mb-2">{t('selectPlan')}</label>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {plans.length === 0 && (
                <p className="text-sm text-fg-faint">{t('noPlans')}</p>
              )}
              {plans.map(plan => (
                <label
                  key={plan.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPlanId === plan.id
                      ? 'border-brand bg-brand/10'
                      : 'border-line hover:border-line-strong bg-surface-3/30'
                  }`}
                >
                  <input
                    type="radio" name="plan" value={plan.id}
                    checked={selectedPlanId === plan.id}
                    onChange={() => setSelectedPlanId(plan.id)}
                    className="accent-brand"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-fg">{plan.name}</p>
                      <p className="text-sm font-semibold text-brand flex-shrink-0">
                        {fmt(plan.price, plan.currency)}
                      </p>
                    </div>
                    <p className="text-xs text-fg-muted capitalize mt-0.5">
                      {plan.plan_type}
                      {plan.duration_days ? ` · ${plan.duration_days} days` : ''}
                      {plan.session_count ? ` · ${plan.session_count} sessions` : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Discount section */}
          {selectedPlanId && !loadingDiscounts && (planPromo || promoCodes.length > 0) && (
            <div className="space-y-2">
              <label className="block text-xs text-fg-muted">
                {t('applyDiscount')} <span className="text-fg-faint">({tc('optional')})</span>
              </label>

              {/* No discount option */}
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${discountMode === 'none' ? 'border-brand bg-brand/10' : 'border-line hover:border-line-strong bg-surface-3/30'}`}>
                <input type="radio" name="discount" checked={discountMode === 'none'} onChange={() => setDiscountMode('none')} className="accent-brand" />
                <span className="text-sm text-fg-muted">{t('noDiscount')}</span>
              </label>

              {/* Plan promotion */}
              {planPromo && (
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${discountMode === 'plan_promo' ? 'border-success bg-success-soft' : 'border-line hover:border-line-strong bg-surface-3/30'}`}>
                  <input type="radio" name="discount" checked={discountMode === 'plan_promo'} onChange={() => { setDiscountMode('plan_promo'); setSelectedPromoId(''); }} className="accent-success" />
                  <Percent className="w-4 h-4 text-success flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-fg font-medium">{t('promotionalPrice')}</p>
                    <p className="text-xs text-fg-muted">
                      {fmt(planPromo.promo_price, currency)} · {t('promoValidUntil', { price: '', date: new Date(planPromo.valid_until).toLocaleDateString('en-GB') }).replace(' · ', '')}
                    </p>
                  </div>
                  <span className="text-xs text-success font-medium flex-shrink-0">
                    {t('promoSave', { amount: fmt(originalPrice - planPromo.promo_price, currency) })}
                  </span>
                </label>
              )}

              {/* Promo codes */}
              {promoCodes.length > 0 && (
                <div>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${discountMode === 'promo_code' ? 'border-brand bg-brand/10' : 'border-line hover:border-line-strong bg-surface-3/30'}`}>
                    <input type="radio" name="discount" checked={discountMode === 'promo_code'} onChange={() => setDiscountMode('promo_code')} className="accent-brand" />
                    <Tag className="w-4 h-4 text-brand flex-shrink-0" />
                    <span className="text-sm text-fg-muted">{t('applyPromoCode')}</span>
                    <ChevronDown className="w-4 h-4 text-fg-faint ms-auto" />
                  </label>
                  {discountMode === 'promo_code' && (
                    <Select
                      value={selectedPromoId}
                      onChange={e => setSelectedPromoId(e.target.value)}
                      className="mt-1.5"
                    >
                      <option value="">{t('selectCode')}</option>
                      {promoCodes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name} ({c.discount_type === 'percentage' ? `${c.discount_value}% off` : `${fmt(c.discount_value, currency)} off`})
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Start date */}
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('startDate')}</label>
            <Input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="[color-scheme:dark]"
              required
            />
          </div>

          {/* Summary */}
          {selectedPlan && (
            <div className="bg-surface-3/40 rounded-lg p-3 text-xs text-fg-muted space-y-1.5">
              <p><span className="text-fg-faint">{t('summaryPlan')}</span> <span className="text-fg">{selectedPlan.name}</span></p>
              {selectedPlan.duration_days && startDate && (
                <p><span className="text-fg-faint">{t('summaryExpires')}</span> <span className="text-fg">
                  {(() => { const d = new Date(startDate); d.setDate(d.getDate() + selectedPlan.duration_days!); return d.toLocaleDateString('en-GB'); })()}
                </span></p>
              )}
              {selectedPlan.session_count && (
                <p><span className="text-fg-faint">{t('summarySessions')}</span> <span className="text-fg">{selectedPlan.session_count}</span></p>
              )}
              <div className="border-t border-line pt-1.5 space-y-1">
                <p className="flex justify-between">
                  <span className="text-fg-faint">{t('summaryOriginalPrice')}</span>
                  <span className="text-fg">{fmt(originalPrice, currency)}</span>
                </p>
                {discountAmount > 0 && (
                  <p className="flex justify-between">
                    <span className="text-fg-faint">{t('summaryDiscount')}</span>
                    <span className="text-success">− {fmt(discountAmount, currency)}</span>
                  </p>
                )}
                <p className="flex justify-between font-medium">
                  <span className="text-fg-muted">{t('summaryTotal')}</span>
                  <span className={discountAmount > 0 ? 'text-success font-semibold' : 'text-fg'}>{fmt(finalPrice, currency)}</span>
                </p>
              </div>
              {isChange && (
                <p className="text-warning mt-1">⚠ {t('warningPlanChange')}</p>
              )}
            </div>
          )}

        </form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>{tc('cancel')}</Button>
        <Button type="submit" form="assign-plan-form" variant="primary" fullWidth disabled={!selectedPlanId} isLoading={loading}>
          {isChange ? t('titleChange') : t('title')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
