'use client';

import { useRef, useState } from 'react';
import { Package, Plus, Trash2, Upload, ImageIcon, ArrowUp, ArrowDown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import { IMAGE_MIME_TO_EXT, MAX_IMAGE_BYTES } from '@/lib/upload-validation';
import type { GymProduct } from '@/lib/types/store-events';

interface VariantRow {
  /** Stable React key. */
  key: string;
  /** Backend id for existing variants; null for new rows. */
  id: string | null;
  name: string;
  /** Not editable here — carried through so a save doesn't drop it. */
  image_url: string | null;
  before_price: string;
  price: string;
  stock: string;
  is_active: boolean;
}

interface Props {
  product?: GymProduct;
  onClose: () => void;
  onSaved: (product: GymProduct) => void;
}

const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_MIME_TO_EXT);

const parseMoney = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : NaN;
};
const parseStock = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : NaN;
};

export default function ProductModal({ product, onClose, onSaved }: Props) {
  const t    = useTranslations('store.modal');
  const tc   = useTranslations('common');
  const tErr = useTranslations('common.errors');
  const isEdit = !!product;

  const [name, setName]               = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl]       = useState(product?.image_url ?? '');
  const [price, setPrice]             = useState(product ? String(product.price) : '');
  const [beforePrice, setBeforePrice] = useState(product?.before_price != null ? String(product.before_price) : '');
  const [currency, setCurrency]       = useState(product?.currency ?? 'EGP');
  const [stock, setStock]             = useState(product?.stock != null ? String(product.stock) : '');
  const [displayOrder, setDisplayOrder] = useState(String(product?.display_order ?? 0));
  const [isActive, setIsActive]       = useState(product?.is_active ?? true);
  const [variants, setVariants]       = useState<VariantRow[]>(
    [...(product?.variants ?? [])]
      .sort((a, b) => a.display_order - b.display_order)
      .map(v => ({
        key: v.id,
        id: v.id,
        name: v.name,
        image_url: v.image_url,
        before_price: v.before_price != null ? String(v.before_price) : '',
        price: String(v.price),
        stock: v.stock != null ? String(v.stock) : '',
        is_active: v.is_active,
      })),
  );
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasVariants = variants.length > 0;

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error(t('imageBadType')); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error(t('imageTooBig')); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/products/image', { method: 'POST', body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      setImageUrl(json.url);
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setUploading(false);
    }
  };

  const addVariant = () => setVariants(prev => [...prev, {
    key: `new-${Date.now()}-${prev.length}`, id: null, name: '', image_url: null,
    before_price: '', price: price, stock: '', is_active: true,
  }]);
  const updateVariant = (key: string, patch: Partial<VariantRow>) =>
    setVariants(prev => prev.map(v => (v.key === key ? { ...v, ...patch } : v)));
  const removeVariant = (key: string) => setVariants(prev => prev.filter(v => v.key !== key));
  const moveVariant = (key: string, dir: -1 | 1) => setVariants(prev => {
    const i = prev.findIndex(v => v.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error(t('nameRequired')); return; }

    const variantsPayload = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const vp = parseMoney(v.price);
      const vb = parseMoney(v.before_price);
      const vs = parseStock(v.stock);
      if (!v.name.trim()) { toast.error(t('variantNameRequired', { row: i + 1 })); return; }
      if (vp === null || Number.isNaN(vp) || vp < 0) { toast.error(t('variantPriceRequired', { row: i + 1 })); return; }
      if (vb !== null && (Number.isNaN(vb) || vb < 0)) { toast.error(t('invalidBeforePrice')); return; }
      if (vs !== null && (Number.isNaN(vs) || vs < 0)) { toast.error(t('invalidStock')); return; }
      variantsPayload.push({
        ...(v.id ? { id: v.id } : {}),
        name: v.name.trim(),
        image_url: v.image_url,
        before_price: vb,
        price: vp,
        stock: vs,
        is_active: v.is_active,
        display_order: i,
      });
    }
    const names = variantsPayload.map(v => v.name.toLowerCase());
    if (new Set(names).size !== names.length) { toast.error(t('variantNamesUnique')); return; }

    // The API requires a product-level price even when variants carry their
    // own; fall back to the cheapest variant so the field can be left blank.
    let parsedPrice = parseMoney(price);
    if (parsedPrice === null && variantsPayload.length > 0) {
      parsedPrice = Math.min(...variantsPayload.map(v => v.price));
    }
    if (parsedPrice === null || Number.isNaN(parsedPrice) || parsedPrice < 0) { toast.error(t('priceRequired')); return; }
    const parsedBefore = parseMoney(beforePrice);
    if (parsedBefore !== null && (Number.isNaN(parsedBefore) || parsedBefore < 0)) { toast.error(t('invalidBeforePrice')); return; }
    const parsedStock = hasVariants ? null : parseStock(stock);
    if (parsedStock !== null && (Number.isNaN(parsedStock) || parsedStock < 0)) { toast.error(t('invalidStock')); return; }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      image_url: imageUrl || null,
      before_price: parsedBefore,
      price: parsedPrice,
      currency: currency.trim().toUpperCase() || 'EGP',
      stock: parsedStock,
      is_active: isActive,
      display_order: parseInt(displayOrder, 10) || 0,
      variants: variantsPayload,
    };

    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/products/${product.id}` : '/api/products', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      toast.success(isEdit ? t('updated') : t('created'));
      onSaved((json?.data ?? json) as GymProduct);
      onClose();
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="xl">
      <Modal.Header>
        <span className="inline-flex items-center gap-3">
          <span className="w-8 h-8 bg-brand/15 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-brand" aria-hidden />
          </span>
          {isEdit ? t('editTitle') : t('addTitle')}
        </span>
      </Modal.Header>

      <Modal.Body>
        <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
          <ToggleRow
            label={t('active')}
            hint={isActive ? t('activeHint') : t('inactiveHint')}
            checked={isActive}
            onChange={setIsActive}
          />

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Image */}
            <div className="flex-shrink-0">
              <p className="text-xs font-medium text-fg-muted mb-1.5">{t('image')}</p>
              <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-line bg-surface-3">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image on external host
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-fg-faint">
                    <ImageIcon className="w-6 h-6" aria-hidden />
                    <span className="text-[11px]">{t('noImage')}</span>
                  </div>
                )}
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    aria-label={t('removeImage')}
                    className="absolute top-1.5 end-1.5 p-1 bg-overlay/60 hover:bg-overlay/80 rounded-md text-white"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 w-36"
                isLoading={uploading}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => fileRef.current?.click()}
              >
                {imageUrl ? t('replaceImage') : t('uploadImage')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={handleImage}
              />
            </div>

            <div className="flex-1 space-y-4">
              <Field label={t('name')} required>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} maxLength={255} />
              </Field>
              <Field label={tc('description')}>
                <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label={t('price')} required={!hasVariants} hint={hasVariants ? t('priceVariantsHint') : undefined}>
              <Input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
            </Field>
            <Field label={t('beforePrice')} hint={t('beforePriceHint')}>
              <Input type="number" min={0} step="0.01" value={beforePrice} onChange={e => setBeforePrice(e.target.value)} />
            </Field>
            <Field label={tc('currency')}>
              <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={5} placeholder="EGP" />
            </Field>
            <Field label={t('displayOrder')}>
              <Input type="number" step={1} value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} />
            </Field>
          </div>

          <Field label={t('stock')} hint={hasVariants ? t('stockVariantsHint') : t('stockHint')}>
            <Input
              type="number" min={0} step={1}
              value={hasVariants ? '' : stock}
              onChange={e => setStock(e.target.value)}
              placeholder={hasVariants ? '—' : t('untrackedPlaceholder')}
              disabled={hasVariants}
            />
          </Field>

          {/* Variants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-fg">{t('variants')}</p>
                <p className="text-xs text-fg-muted">{t('variantsHint')}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={addVariant}>
                {t('addVariant')}
              </Button>
            </div>

            {variants.map((v, i) => (
              <div key={v.key} className="bg-surface border border-line rounded-xl p-3 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={t('variantName')} required>
                      <Input value={v.name} onChange={e => updateVariant(v.key, { name: e.target.value })} placeholder={t('variantNamePlaceholder')} maxLength={255} />
                    </Field>
                  </div>
                  <button type="button" aria-label={t('moveUp')} title={t('moveUp')} disabled={i === 0}
                    onClick={() => moveVariant(v.key, -1)}
                    className="min-h-10 p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" aria-hidden />
                  </button>
                  <button type="button" aria-label={t('moveDown')} title={t('moveDown')} disabled={i === variants.length - 1}
                    onClick={() => moveVariant(v.key, 1)}
                    className="min-h-10 p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" aria-hidden />
                  </button>
                  <button type="button" aria-label={t('removeVariant')} title={t('removeVariant')}
                    onClick={() => removeVariant(v.key)}
                    className="min-h-10 p-2 rounded-lg text-fg-muted hover:text-danger hover:bg-danger-soft">
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <Field label={t('price')} required>
                    <Input type="number" min={0} step="0.01" value={v.price} onChange={e => updateVariant(v.key, { price: e.target.value })} placeholder="0" />
                  </Field>
                  <Field label={t('beforePrice')}>
                    <Input type="number" min={0} step="0.01" value={v.before_price} onChange={e => updateVariant(v.key, { before_price: e.target.value })} />
                  </Field>
                  <Field label={t('stock')}>
                    <Input type="number" min={0} step={1} value={v.stock} onChange={e => updateVariant(v.key, { stock: e.target.value })} placeholder={t('untrackedPlaceholder')} />
                  </Field>
                  <label className="flex items-center gap-2 min-h-10 text-sm text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={v.is_active}
                      onChange={e => updateVariant(v.key, { is_active: e.target.checked })}
                      className="w-4 h-4 accent-brand"
                    />
                    {t('variantActive')}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>{tc('cancel')}</Button>
        <Button type="submit" form="product-form" disabled={uploading} isLoading={saving}>
          {isEdit ? tc('saveChanges') : t('create')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-start transition-colors hover:border-line-strong"
    >
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {hint && <span className="block text-xs text-fg-muted mt-0.5">{hint}</span>}
      </span>
      <span className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-surface-3 border border-line'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'start-5' : 'start-1'}`} />
      </span>
    </button>
  );
}
