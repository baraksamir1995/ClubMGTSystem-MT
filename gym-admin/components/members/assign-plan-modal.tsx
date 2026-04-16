'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, Tag, Percent, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

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
    if (!selectedPlanId) { toast.error('Please select a plan'); return; }
    if (!startDate)      { toast.error('Please set a start date'); return; }

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
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success(isChange ? 'Plan changed successfully' : 'Plan assigned successfully');
      onClose();
      window.location.reload();
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
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">
              {isChange ? 'Change Plan' : 'Assign Plan'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Plan selection */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Select Plan *</label>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {plans.length === 0 && (
                <p className="text-sm text-gray-500">No plans available. Create plans first.</p>
              )}
              {plans.map(plan => (
                <label
                  key={plan.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPlanId === plan.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 hover:border-gray-600 bg-gray-700/30'
                  }`}
                >
                  <input
                    type="radio" name="plan" value={plan.id}
                    checked={selectedPlanId === plan.id}
                    onChange={() => setSelectedPlanId(plan.id)}
                    className="accent-purple-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{plan.name}</p>
                      <p className="text-sm font-semibold text-purple-400 flex-shrink-0">
                        {fmt(plan.price, plan.currency)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">
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
              <label className="block text-xs text-gray-400">Apply Discount <span className="text-gray-600">(optional)</span></label>

              {/* No discount option */}
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${discountMode === 'none' ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-600 bg-gray-700/30'}`}>
                <input type="radio" name="discount" checked={discountMode === 'none'} onChange={() => setDiscountMode('none')} className="accent-purple-500" />
                <span className="text-sm text-gray-300">No discount — full price</span>
              </label>

              {/* Plan promotion */}
              {planPromo && (
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${discountMode === 'plan_promo' ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-700 hover:border-gray-600 bg-gray-700/30'}`}>
                  <input type="radio" name="discount" checked={discountMode === 'plan_promo'} onChange={() => { setDiscountMode('plan_promo'); setSelectedPromoId(''); }} className="accent-emerald-500" />
                  <Percent className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">Promotional Price</p>
                    <p className="text-xs text-gray-400">
                      {fmt(planPromo.promo_price, currency)} · valid until {new Date(planPromo.valid_until).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <span className="text-xs text-emerald-400 font-medium flex-shrink-0">
                    Save {fmt(originalPrice - planPromo.promo_price, currency)}
                  </span>
                </label>
              )}

              {/* Promo codes */}
              {promoCodes.length > 0 && (
                <div>
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${discountMode === 'promo_code' ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-600 bg-gray-700/30'}`}>
                    <input type="radio" name="discount" checked={discountMode === 'promo_code'} onChange={() => setDiscountMode('promo_code')} className="accent-purple-500" />
                    <Tag className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300">Apply Promo Code</span>
                    <ChevronDown className="w-4 h-4 text-gray-500 ml-auto" />
                  </label>
                  {discountMode === 'promo_code' && (
                    <select
                      value={selectedPromoId}
                      onChange={e => setSelectedPromoId(e.target.value)}
                      className="w-full mt-1.5 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">— Select a code —</option>
                      {promoCodes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name} ({c.discount_type === 'percentage' ? `${c.discount_value}% off` : `${fmt(c.discount_value, currency)} off`})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Start date */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Start Date *</label>
            <input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 [color-scheme:dark]"
              required
            />
          </div>

          {/* Summary */}
          {selectedPlan && (
            <div className="bg-gray-700/40 rounded-lg p-3 text-xs text-gray-400 space-y-1.5">
              <p><span className="text-gray-500">Plan:</span> <span className="text-white">{selectedPlan.name}</span></p>
              {selectedPlan.duration_days && startDate && (
                <p><span className="text-gray-500">Expires:</span> <span className="text-white">
                  {(() => { const d = new Date(startDate); d.setDate(d.getDate() + selectedPlan.duration_days!); return d.toLocaleDateString('en-GB'); })()}
                </span></p>
              )}
              {selectedPlan.session_count && (
                <p><span className="text-gray-500">Sessions:</span> <span className="text-white">{selectedPlan.session_count}</span></p>
              )}
              <div className="border-t border-gray-600 pt-1.5 space-y-1">
                <p className="flex justify-between">
                  <span className="text-gray-500">Original price:</span>
                  <span className="text-white">{fmt(originalPrice, currency)}</span>
                </p>
                {discountAmount > 0 && (
                  <p className="flex justify-between">
                    <span className="text-gray-500">Discount:</span>
                    <span className="text-emerald-400">− {fmt(discountAmount, currency)}</span>
                  </p>
                )}
                <p className="flex justify-between font-medium">
                  <span className="text-gray-400">Total:</span>
                  <span className={discountAmount > 0 ? 'text-emerald-400 font-semibold' : 'text-white'}>{fmt(finalPrice, currency)}</span>
                </p>
              </div>
              {isChange && (
                <p className="text-amber-400 mt-1">⚠ Current plan will be cancelled and replaced.</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || !selectedPlanId}
              className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
              {loading ? 'Saving…' : isChange ? 'Change Plan' : 'Assign Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
