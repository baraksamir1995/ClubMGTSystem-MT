'use client';

import { useState } from 'react';
import { Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { Plan } from '@/app/dashboard/plans/page';
import type { PlanPromotion } from './plan-pricing-tab';
import { Button, Input, Modal, Select } from '@/components/ui';

interface Props {
  plans: Plan[];
  existing?: PlanPromotion;
  onClose: () => void;
  onSaved: (promo: PlanPromotion) => void;
}

export default function PlanPromoModal({ plans, existing, onClose, onSaved }: Props) {
  const t  = useTranslations('promotions');
  const tc = useTranslations('common');
  const activePlans = plans.filter(p => p.is_active);

  const [planId,     setPlanId]     = useState(existing?.plan_id ?? activePlans[0]?.id ?? '');
  const [promoPrice, setPromoPrice] = useState(existing?.promo_price?.toString() ?? '');
  const [validFrom,  setValidFrom]  = useState(existing?.valid_from?.slice(0, 10) ?? '');
  const [validUntil, setValidUntil] = useState(existing?.valid_until?.slice(0, 10) ?? '');
  const [saving,     setSaving]     = useState(false);

  const selectedPlan = plans.find(p => p.id === planId);

  const handleSave = async () => {
    if (!planId)                                           { toast.error(t('selectPlanRequired')); return; }
    if (!promoPrice || isNaN(Number(promoPrice)) || Number(promoPrice) < 0) { toast.error(t('validPriceRequired')); return; }
    if (!validFrom)                                        { toast.error(t('validFromRequired')); return; }
    if (!validUntil)                                       { toast.error(t('validUntilRequired')); return; }
    if (validFrom >= validUntil)                           { toast.error(t('endDateAfterStart')); return; }

    setSaving(true);
    try {
      const body = { planId, promoPrice: Number(promoPrice), validFrom, validUntil };

      const res = existing
        ? await fetch(`/api/promos/plan-pricing/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/promos/plan-pricing',                { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('failedToSave')); return; }

      toast.success(existing ? t('promotionUpdated') : t('promotionCreated'));
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
    } catch { toast.error(tc('networkError')); }
    finally { setSaving(false); }
  };

  const inp = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand';

  const savings = selectedPlan && promoPrice
    ? (Number(selectedPlan.price) || 0) - Number(promoPrice)
    : null;

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><Percent className="w-4 h-4 text-brand" /> {existing ? t('editPlanPromotion') : t('setPlanPromotion')}</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Plan picker */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('labelMembershipPlan')} <span className="text-danger">*</span></label>
          {existing ? (
            <div className="bg-surface-3/50 rounded-lg px-3 py-2 text-sm text-fg">{existing.plan_name}</div>
          ) : (
            <Select value={planId} onChange={e => setPlanId(e.target.value)}>
              {activePlans.length === 0 && <option value="">{t('noActivePlans')}</option>}
              {activePlans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.currency} {(Number(p.price) || 0).toFixed(2)}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Original price display */}
        {selectedPlan && (
          <div className="flex items-center gap-3 bg-surface-3/30 rounded-lg px-3 py-2.5">
            <div className="flex-1">
              <p className="text-xs text-fg-muted">{t('labelOriginalPrice')}</p>
              <p className="text-sm text-fg font-medium">{selectedPlan.currency} {(Number(selectedPlan.price) || 0).toFixed(2)}</p>
            </div>
            {savings !== null && savings > 0 && (
              <div className="text-end">
                <p className="text-xs text-fg-muted">{t('labelMemberSaves')}</p>
                <p className="text-sm text-success font-medium">{selectedPlan.currency} {(Number(savings) || 0).toFixed(2)}</p>
              </div>
            )}
          </div>
        )}

        {/* Promo price */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('labelPromoPrice')} <span className="text-danger">*</span></label>
          <div className="relative">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted text-sm pointer-events-none z-10">
              {selectedPlan?.currency ?? '$'}
            </span>
            <input type="number" min="0" step="0.01"
              value={promoPrice} onChange={e => setPromoPrice(e.target.value)}
              placeholder="0.00"
              className={inp + ' ps-8'} />
          </div>
        </div>

        {/* Validity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('labelValidFrom')} <span className="text-danger">*</span></label>
            <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="[color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('labelValidUntil')} <span className="text-danger">*</span></label>
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="[color-scheme:dark]" />
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={!planId || !promoPrice || !validFrom || !validUntil} isLoading={saving}>
          {existing ? tc('saveChanges') : t('setPromotion')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
