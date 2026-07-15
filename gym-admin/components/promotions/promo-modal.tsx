'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { PromoCode } from '@/app/dashboard/promotions/page';
import { Button, Input, Modal } from '@/components/ui';

interface Props {
  existing?: PromoCode;
  onClose: () => void;
  onSaved: (promo: PromoCode) => void;
}

export default function PromoModal({ existing, onClose, onSaved }: Props) {
  const t  = useTranslations('promotions');
  const tc = useTranslations('common');
  const [code,          setCode]          = useState(existing?.code ?? '');
  const [name,          setName]          = useState(existing?.name ?? '');
  const [discountType,  setDiscountType]  = useState<'percent' | 'fixed'>(existing?.discount_type ?? 'percent');
  const [discountValue, setDiscountValue] = useState(existing?.discount_value?.toString() ?? '');
  const [validFrom,     setValidFrom]     = useState(existing?.valid_from?.slice(0, 10) ?? '');
  const [validUntil,    setValidUntil]    = useState(existing?.valid_until?.slice(0, 10) ?? '');
  const [maxUses,          setMaxUses]          = useState(existing?.max_uses?.toString() ?? '');
  const [maxUsesPerMember, setMaxUsesPerMember] = useState(existing?.max_uses_per_member?.toString() ?? '');
  const [saving,           setSaving]           = useState(false);

  const handleSave = async () => {
    if (!code.trim())          { toast.error(t('codeRequired')); return; }
    if (!name.trim())          { toast.error(t('nameRequired')); return; }
    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
      toast.error(t('invalidDiscountValue')); return;
    }
    if (discountType === 'percent' && Number(discountValue) > 100) {
      toast.error(t('percentExceeds100')); return;
    }

    setSaving(true);
    try {
      const body = {
        code:          code.toUpperCase().trim(),
        name:          name.trim(),
        discountType,
        discountValue:     Number(discountValue),
        validFrom:         validFrom || null,
        validUntil:        validUntil || null,
        maxUses:           maxUses ? parseInt(maxUses) : null,
        maxUsesPerMember:  maxUsesPerMember ? parseInt(maxUsesPerMember) : null,
        isActive:          existing?.is_active ?? true,
      };

      const res = existing
        ? await fetch(`/api/promos/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/promos',                { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('failedToSave')); return; }

      toast.success(existing ? t('promoCodeUpdated') : t('promoCodeCreated'));
      onSaved({
        ...(existing ?? { usage_count: 0, created_at: new Date().toISOString() }),
        id:             existing?.id ?? data.id,
        code:           body.code,
        name:           body.name,
        discount_type:  discountType,
        discount_value: Number(discountValue),
        valid_from:     validFrom || null,
        valid_until:    validUntil || null,
        max_uses:            maxUses ? parseInt(maxUses) : null,
        max_uses_per_member: maxUsesPerMember ? parseInt(maxUsesPerMember) : null,
        is_active:           existing?.is_active ?? true,
      } as PromoCode);
      onClose();
    } catch { toast.error(tc('networkError')); }
    finally { setSaving(false); }
  };

  const inp = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand';

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><Tag className="w-4 h-4 text-brand" aria-hidden /> {existing ? t('editPromoCode') : t('newPromoCode')}</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Code */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('labelCode')} <span className="text-danger">*</span></label>
          <Input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder={t('placeholderCode')}
            className="font-mono tracking-widest uppercase"
          />
          <p className="text-xs text-fg-faint mt-1">{t('hintCodeCheckout')}</p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('labelName')} <span className="text-danger">*</span></label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('placeholderName')} />
        </div>

        {/* Discount type + value */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('labelDiscount')} <span className="text-danger">*</span></label>
          <div className="flex gap-2">
            <div className="flex bg-surface border border-line rounded-lg overflow-hidden flex-shrink-0">
              {(['percent', 'fixed'] as const).map(type => (
                <button key={type} type="button" onClick={() => setDiscountType(type)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${discountType === type ? 'bg-brand text-brand-ink' : 'text-fg-muted hover:text-fg'}`}>
                  {type === 'percent' ? t('discountTypePercent') : t('discountTypeFixed')}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <input
                type="number" min="0" max={discountType === 'percent' ? 100 : undefined}
                value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? t('placeholderRange') : t('placeholderAmount')}
                className={inp}
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-fg-faint text-sm pointer-events-none">
                {discountType === 'percent' ? '%' : 'off'}
              </span>
            </div>
          </div>
        </div>

        {/* Validity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('labelValidFrom')} <span className="text-fg-faint">({tc('optional')})</span></label>
            <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="[color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('labelValidUntil')} <span className="text-fg-faint">({tc('optional')})</span></label>
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="[color-scheme:dark]" />
          </div>
        </div>

        {/* Max uses */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('labelTotalMaxUses')} <span className="text-fg-faint">({tc('optional')})</span></label>
            <Input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder={t('placeholderUnlimited')} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('labelPerMemberLimit')} <span className="text-fg-faint">({tc('optional')})</span></label>
            <Input type="number" min="1" value={maxUsesPerMember} onChange={e => setMaxUsesPerMember(e.target.value)} placeholder={t('placeholderUnlimited')} />
            <p className="text-xs text-fg-faint mt-1">{t('hintOneTimeUse')}</p>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={!code.trim() || !name.trim()} isLoading={saving}>
          {existing ? tc('saveChanges') : t('createCode')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
