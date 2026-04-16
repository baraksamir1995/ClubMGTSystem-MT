'use client';

import { useState } from 'react';
import { X, Loader2, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Plan } from '@/app/dashboard/plans/page';
import type { PlanPromotion } from './plan-pricing-tab';

interface Props {
  plans: Plan[];
  existing?: PlanPromotion;
  onClose: () => void;
  onSaved: (promo: PlanPromotion) => void;
}

export default function PlanPromoModal({ plans, existing, onClose, onSaved }: Props) {
  const activePlans = plans.filter(p => p.is_active);

  const [planId,     setPlanId]     = useState(existing?.plan_id ?? activePlans[0]?.id ?? '');
  const [promoPrice, setPromoPrice] = useState(existing?.promo_price?.toString() ?? '');
  const [validFrom,  setValidFrom]  = useState(existing?.valid_from?.slice(0, 10) ?? '');
  const [validUntil, setValidUntil] = useState(existing?.valid_until?.slice(0, 10) ?? '');
  const [saving,     setSaving]     = useState(false);

  const selectedPlan = plans.find(p => p.id === planId);

  const handleSave = async () => {
    if (!planId)                                           { toast.error('Select a plan'); return; }
    if (!promoPrice || isNaN(Number(promoPrice)) || Number(promoPrice) < 0) { toast.error('Enter a valid price'); return; }
    if (!validFrom)                                        { toast.error('Valid from date is required'); return; }
    if (!validUntil)                                       { toast.error('Valid until date is required'); return; }
    if (validFrom >= validUntil)                           { toast.error('End date must be after start date'); return; }

    setSaving(true);
    try {
      const body = { planId, promoPrice: Number(promoPrice), validFrom, validUntil };

      const res = existing
        ? await fetch(`/api/promos/plan-pricing/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/promos/plan-pricing',                { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }

      toast.success(existing ? 'Promotion updated' : 'Promotion created');
      onSaved({
        id:          existing?.id ?? data.id,
        plan_id:     planId,
        plan_name:   selectedPlan?.name ?? '',
        plan_price:  Number(selectedPlan?.price) || 0,
        currency:    selectedPlan?.currency ?? 'USD',
        promo_price: Number(promoPrice),
        valid_from:  validFrom,
        valid_until: validUntil,
        created_at:  existing?.created_at ?? new Date().toISOString(),
      });
      onClose();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const inp = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

  const savings = selectedPlan && promoPrice
    ? (Number(selectedPlan.price) || 0) - Number(promoPrice)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">{existing ? 'Edit Plan Promotion' : 'Set Plan Promotion'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Plan picker */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Membership Plan <span className="text-red-400">*</span></label>
            {existing ? (
              <div className="bg-gray-700/50 rounded-lg px-3 py-2 text-sm text-white">{existing.plan_name}</div>
            ) : (
              <select value={planId} onChange={e => setPlanId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                {activePlans.length === 0 && <option value="">No active plans</option>}
                {activePlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.currency} {(Number(p.price) || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Original price display */}
          {selectedPlan && (
            <div className="flex items-center gap-3 bg-gray-700/30 rounded-lg px-3 py-2.5">
              <div className="flex-1">
                <p className="text-xs text-gray-400">Original Price</p>
                <p className="text-sm text-white font-medium">{selectedPlan.currency} {(Number(selectedPlan.price) || 0).toFixed(2)}</p>
              </div>
              {savings !== null && savings > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Member Saves</p>
                  <p className="text-sm text-emerald-400 font-medium">{selectedPlan.currency} {(Number(savings) || 0).toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          {/* Promo price */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Promotional Price <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                {selectedPlan?.currency ?? '$'}
              </span>
              <input type="number" min="0" step="0.01"
                value={promoPrice} onChange={e => setPromoPrice(e.target.value)}
                placeholder="0.00"
                className={inp + ' pl-8'} />
            </div>
          </div>

          {/* Validity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Valid From <span className="text-red-400">*</span></label>
              <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                className={inp + ' [color-scheme:dark]'} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Valid Until <span className="text-red-400">*</span></label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className={inp + ' [color-scheme:dark]'} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !planId || !promoPrice || !validFrom || !validUntil}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : (existing ? 'Save Changes' : 'Set Promotion')}
          </button>
        </div>
      </div>
    </div>
  );
}
