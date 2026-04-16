'use client';

import { useState } from 'react';
import { X, Loader2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import type { PromoCode } from '@/app/dashboard/promotions/page';

interface Props {
  existing?: PromoCode;
  onClose: () => void;
  onSaved: (promo: PromoCode) => void;
}

export default function PromoModal({ existing, onClose, onSaved }: Props) {
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
    if (!code.trim())          { toast.error('Code is required'); return; }
    if (!name.trim())          { toast.error('Name is required'); return; }
    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
      toast.error('Enter a valid discount value'); return;
    }
    if (discountType === 'percent' && Number(discountValue) > 100) {
      toast.error('Percentage cannot exceed 100'); return;
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
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }

      toast.success(existing ? 'Promo code updated' : 'Promo code created');
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
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const inp = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">{existing ? 'Edit Promo Code' : 'New Promo Code'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Code */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Code <span className="text-red-400">*</span></label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER20"
              className={inp + ' font-mono tracking-widest uppercase'}
            />
            <p className="text-xs text-gray-600 mt-1">Members enter this at checkout</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Promotion" className={inp} />
          </div>

          {/* Discount type + value */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Discount <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              <div className="flex bg-gray-900 border border-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                {(['percent', 'fixed'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setDiscountType(type)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${discountType === type ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {type === 'percent' ? '%' : 'Fixed'}
                  </button>
                ))}
              </div>
              <div className="relative flex-1">
                <input
                  type="number" min="0" max={discountType === 'percent' ? 100 : undefined}
                  value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percent' ? '0–100' : 'Amount'}
                  className={inp}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                  {discountType === 'percent' ? '%' : 'off'}
                </span>
              </div>
            </div>
          </div>

          {/* Validity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Valid From <span className="text-gray-600">(optional)</span></label>
              <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                className={inp + ' [color-scheme:dark]'} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Valid Until <span className="text-gray-600">(optional)</span></label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className={inp + ' [color-scheme:dark]'} />
            </div>
          </div>

          {/* Max uses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Total Max Uses <span className="text-gray-600">(optional)</span></label>
              <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)}
                placeholder="Unlimited" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Per Member Limit <span className="text-gray-600">(optional)</span></label>
              <input type="number" min="1" value={maxUsesPerMember} onChange={e => setMaxUsesPerMember(e.target.value)}
                placeholder="Unlimited" className={inp} />
              <p className="text-xs text-gray-600 mt-1">e.g. 1 = one-time use per member</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !code.trim() || !name.trim()}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : (existing ? 'Save Changes' : 'Create Code')}
          </button>
        </div>
      </div>
    </div>
  );
}
