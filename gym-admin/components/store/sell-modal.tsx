'use client';

import { useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import MemberPicker, { type PickedMember } from './member-picker';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import {
  DESK_PAYMENT_METHODS, METHOD_LABEL_KEY,
  type BranchOption, type DeskPaymentMethod, type GymProduct,
} from '@/lib/types/store-events';
import { fmtPrice } from './store-page';

interface Props {
  product: GymProduct;
  branches: BranchOption[];
  onClose: () => void;
  onSold: () => void;
}

export default function SellModal({ product, branches, onClose, onSold }: Props) {
  const t    = useTranslations('store.sell');
  const tc   = useTranslations('common');
  const tp   = useTranslations('payments');
  const tErr = useTranslations('common.errors');

  const variants = useMemo(
    () => product.variants.filter(v => v.is_active).sort((a, b) => a.display_order - b.display_order),
    [product.variants],
  );
  const hasVariants = variants.length > 0;

  const [variantId, setVariantId] = useState<string>(() => variants.find(v => v.stock === null || v.stock > 0)?.id ?? '');
  const [quantity, setQuantity]   = useState('1');
  const [member, setMember]       = useState<PickedMember | null>(null);
  const [method, setMethod]       = useState<DeskPaymentMethod>('cash');
  const [branchId, setBranchId]   = useState(branches.length === 1 ? branches[0].id : '');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const variant = variants.find(v => v.id === variantId) ?? null;
  const unitPrice = hasVariants ? (variant?.price ?? null) : product.price;
  const available = hasVariants ? (variant ? variant.stock : null) : product.stock;
  const qty = Math.max(0, parseInt(quantity, 10) || 0);
  const total = unitPrice != null ? unitPrice * qty : null;

  const submit = async () => {
    setError(null);
    if (hasVariants && !variant) { setError(t('errors.variant_required')); return; }
    if (qty < 1 || qty > 100) { setError(t('quantityInvalid')); return; }
    if (available !== null && qty > available) {
      setError(available <= 0 ? t('errors.out_of_stock') : t('onlyLeft', { count: available }));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id: variant?.id ?? null,
          quantity: qty,
          gym_member_id: member?.id ?? null,
          payment_method: method,
          notes: notes.trim() || null,
          branch_id: branchId || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const code = json?.code as string | undefined;
        const msg = code && ['out_of_stock', 'variant_required', 'product_unavailable'].includes(code)
          ? t(`errors.${code}`)
          : apiErrorMessage(json, res.status, tErr);
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(t('success', { name: product.name }));
      onSold();
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-3">
          <span className="w-8 h-8 bg-brand/15 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-brand" aria-hidden />
          </span>
          {t('title', { name: product.name })}
        </span>
      </Modal.Header>
      <Modal.Body>
        {hasVariants && (
          <Field label={t('variant')} required>
            <Select value={variantId} onChange={e => setVariantId(e.target.value)}>
              <option value="">{t('chooseVariant')}</option>
              {variants.map(v => {
                const out = v.stock !== null && v.stock <= 0;
                return (
                  <option key={v.id} value={v.id} disabled={out}>
                    {v.name} — {fmtPrice(v.price)} {product.currency}
                    {v.stock === null ? '' : out ? ` (${t('soldOut')})` : ` (${t('inStock', { count: v.stock })})`}
                  </option>
                );
              })}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('quantity')}
            hint={hasVariants && !variant ? undefined
              : available === null ? t('untracked') : t('inStock', { count: available })}
          >
            <Input type="number" min={1} max={100} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} />
          </Field>
          <Field label={tp('table.method')}>
            <Select value={method} onChange={e => setMethod(e.target.value as DeskPaymentMethod)}>
              {DESK_PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{tp(`method.${METHOD_LABEL_KEY[m]}`)}</option>
              ))}
            </Select>
          </Field>
        </div>

        <MemberPicker value={member} onChange={setMember} />

        {branches.length > 0 && (
          <Field label={tc('branch')}>
            <Select value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">{t('noBranch')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        )}

        <Field label={tc('notes')}>
          <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} />
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
          <span className="text-sm text-fg-muted">{tc('total')}</span>
          <span className="text-lg font-bold text-fg tabular-nums">
            {total != null ? `${fmtPrice(total)} ${product.currency}` : '—'}
          </span>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{tc('cancel')}</Button>
        <Button fullWidth isLoading={saving} onClick={submit}>{t('confirm')}</Button>
      </Modal.Footer>
    </Modal>
  );
}
