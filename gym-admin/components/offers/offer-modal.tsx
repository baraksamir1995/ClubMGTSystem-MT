'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Gift, Plus, Trash2, Upload, ImageIcon, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymOffer } from '@/app/dashboard/content/page';
import { Button, Modal } from '@/components/ui';

interface PlanOption {
  id: string; name: string; type: 'plan' | 'package'; category?: string;
  price?: number; session_count?: number; duration_days?: number; plan_type?: string;
}


interface Props {
  offer?: GymOffer;
  gymId: string;
  onClose: () => void;
  onSaved: (offer: GymOffer) => void;
}

const TAG_COLORS = [
  { label: 'Amber',  value: '#F59E0B' },
  { label: 'Green',  value: '#10B981' },
  { label: 'Blue',   value: '#3B82F6' },
  { label: 'Red',    value: '#EF4444' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Teal',   value: '#14B8A6' },
  { label: 'Pink',   value: '#EC4899' },
  { label: 'Orange', value: '#F97316' },
];

const STATUS_OPTIONS = [
  { value: 'draft',   label: 'Draft',   hint: 'Not visible on mobile' },
  { value: 'active',  label: 'Active',  hint: 'Visible to members now' },
  { value: 'expired', label: 'Expired', hint: 'Hidden, expired' },
];

const inputCls = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand transition-colors';
const labelCls = 'block text-xs font-medium text-fg-muted mb-1.5';

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try { return iso.substring(0, 10); } catch { return ''; }
}

export default function OfferModal({ offer, gymId, onClose, onSaved }: Props) {
  const isEdit = !!offer;

  const [title, setTitle]                   = useState(offer?.title ?? '');
  const [shortDesc, setShortDesc]           = useState(offer?.short_description ?? '');
  const [fullDesc, setFullDesc]             = useState(offer?.full_description ?? '');
  const [tagLabel, setTagLabel]             = useState(offer?.tag_label ?? '');
  const [tagColor, setTagColor]             = useState(offer?.tag_color ?? TAG_COLORS[0].value);
  const [heroUrl, setHeroUrl]               = useState(offer?.hero_image_url ?? '');
  const [expiresAt, setExpiresAt]           = useState(toDateInputValue(offer?.expires_at));
  const [ctaLabel, setCtaLabel]             = useState(offer?.cta_label ?? '');
  const [offerPrice, setOfferPrice]         = useState(offer?.offer_price?.toString() ?? '');
  const [originalPrice, setOriginalPrice]   = useState(offer?.original_price?.toString() ?? '');
  const [sessionCount, setSessionCount]     = useState(offer?.session_count?.toString() ?? '');
  const [terms, setTerms]                   = useState<string[]>(Array.isArray(offer?.terms) ? offer.terms : []);
  const [status, setStatus]                 = useState<'draft' | 'active' | 'expired'>(offer?.status ?? 'draft');
  const [termInput, setTermInput]           = useState('');
  const [saving, setSaving]                 = useState(false);
  const [uploading, setUploading]           = useState(false);

  // Linked plan/package
  const [planOptions, setPlanOptions]       = useState<PlanOption[]>([]);
  const [linkedId, setLinkedId]             = useState<string>(
    offer?.linked_plan_id ?? offer?.linked_package_id ?? ''
  );
  const [loadingOptions, setLoadingOptions] = useState(false);

  const termRef    = useRef<HTMLInputElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([
      fetch('/api/plans').then(r => r.json()),
      fetch('/api/service-packages').then(r => r.json()),
    ]).then(([plans, pkgsRes]) => {
      if (cancelled) return;
      const planOpts: PlanOption[] = (Array.isArray(plans) ? plans : []).map(
        (p: { id: string; name: string; price?: number; session_count?: number; duration_days?: number; plan_type?: string }) => ({
          id: p.id, name: p.name, type: 'plan' as const,
          price: p.price, session_count: p.session_count,
          duration_days: p.duration_days, plan_type: p.plan_type,
        })
      );
      const rawPkgs: { id: string; name: string; trainer_type?: string; price?: number; session_count?: number }[] =
        Array.isArray(pkgsRes) ? pkgsRes : (pkgsRes?.packages ?? []);
      const pkgOpts: PlanOption[] = rawPkgs.map(p => ({
        id: p.id, name: p.name, type: 'package' as const, category: p.trainer_type,
        price: p.price, session_count: p.session_count,
      }));
      setPlanOptions([...planOpts, ...pkgOpts]);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoadingOptions(false); });
    return () => { cancelled = true; };
  }, []);

  // Prefill price/sessions/duration when a plan/package is selected
  const linkedOption = planOptions.find(p => p.id === linkedId);
  useEffect(() => {
    if (!linkedId || !linkedOption) return;
    if (linkedOption.price != null)         setOriginalPrice(linkedOption.price.toString());
    if (linkedOption.session_count != null) setSessionCount(linkedOption.session_count.toString());
    // duration_days is display-only; we don't store it on the offer (it lives in the plan)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedId]);

  const addTerm = () => {
    const val = termInput.trim();
    if (!val || terms.length >= 10) return;
    setTerms(prev => [...prev, val]);
    setTermInput('');
    termRef.current?.focus();
  };

  const removeTerm = (i: number) => setTerms(prev => prev.filter((_, idx) => idx !== i));

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP or GIF images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'offer-images');
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error('Upload failed: ' + (data.error ?? 'Unknown error')); return; }

      setHeroUrl(data.url);
      toast.success('Image uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      // reset so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!expiresAt)    { toast.error('Expiry date is required'); return; }
    if (tagLabel.length > 12) { toast.error('Tag label must be 12 characters or fewer'); return; }

    setSaving(true);
    const linked_plan_id    = linkedOption?.type === 'plan'    ? linkedId || null : null;
    const linked_package_id = linkedOption?.type === 'package' ? linkedId || null : null;

    const payload = {
      title: title.trim(),
      short_description: shortDesc.trim() || null,
      full_description: fullDesc.trim() || null,
      tag_label: tagLabel.trim() || null,
      tag_color: tagColor || null,
      hero_image_url: heroUrl || null,
      expires_at: new Date(expiresAt).toISOString(),
      cta_label: ctaLabel.trim() || null,
      terms,
      status,
      offer_price: offerPrice ? parseFloat(offerPrice) : null,
      original_price: originalPrice ? parseFloat(originalPrice) : null,
      session_count: sessionCount ? parseInt(sessionCount) : null,
      linked_plan_id,
      linked_package_id,
    };

    try {
      const res = await fetch(isEdit ? `/api/offers/${offer.id}` : '/api/offers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Failed to save offer'); return; }
      toast.success(isEdit ? 'Offer updated' : 'Offer created');
      onSaved(json as GymOffer);
      onClose();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="xl">
      <Modal.Header>
        <span className="inline-flex items-center gap-3">
          <span className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
            <Gift className="w-4 h-4 text-brand" />
          </span>
          {isEdit ? 'Edit Offer' : 'New Offer'}
        </span>
      </Modal.Header>

      <Modal.Body>
        <form id="offer-form" onSubmit={handleSubmit} className="space-y-5">

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value as typeof status)}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    status === s.value
                      ? 'border-brand bg-brand/10'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  <span className="text-sm font-medium text-fg">{s.label}</span>
                  <span className="text-xs text-fg-muted mt-0.5">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Title <span className="text-red-400">*</span></label>
            <input
              className={inputCls}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Personal Training Bundle"
              maxLength={120}
              required
            />
          </div>

          {/* Short description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls.replace('mb-1.5', '')}>Short Description</label>
              <span className={`text-xs ${shortDesc.length > 150 ? 'text-red-400' : 'text-fg-faint'}`}>
                {shortDesc.length}/150
              </span>
            </div>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={shortDesc}
              onChange={e => setShortDesc(e.target.value)}
              placeholder="Shown on the offer card in the Explore feed"
              maxLength={150}
            />
          </div>

          {/* Full description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls.replace('mb-1.5', '')}>Full Description</label>
              <span className={`text-xs ${fullDesc.length > 500 ? 'text-red-400' : 'text-fg-faint'}`}>
                {fullDesc.length}/500
              </span>
            </div>
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              value={fullDesc}
              onChange={e => setFullDesc(e.target.value)}
              placeholder="Shown on the offer detail screen"
              maxLength={500}
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Offer Price (EGP)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-faint">EGP</span>
                <input className={`${inputCls} pl-12`} type="number" min={0} step={1}
                  value={offerPrice} onChange={e => setOfferPrice(e.target.value)} placeholder="e.g. 1200" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Original Price (EGP)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-faint">EGP</span>
                <input className={`${inputCls} pl-12`} type="number" min={0} step={1}
                  value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} placeholder="e.g. 1500" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Sessions</label>
              <input className={inputCls} type="number" min={1}
                value={sessionCount} onChange={e => setSessionCount(e.target.value)} placeholder="e.g. 12" />
            </div>
          </div>

          {/* Tag label + color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelCls.replace('mb-1.5', '')}>Tag Label</label>
                <span className={`text-xs ${tagLabel.length > 12 ? 'text-red-400' : 'text-fg-faint'}`}>
                  {tagLabel.length}/12
                </span>
              </div>
              <input
                className={inputCls}
                value={tagLabel}
                onChange={e => setTagLabel(e.target.value)}
                placeholder="e.g. 20% off"
                maxLength={12}
              />
            </div>
            <div>
              <label className={labelCls}>Tag Color</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TAG_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setTagColor(c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      tagColor === c.value ? 'border-fg scale-110' : 'border-transparent hover:border-line-strong'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Hero image upload */}
          <div>
            <label className={labelCls}>Hero Image</label>
            {heroUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-surface border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroUrl}
                  alt="Hero preview"
                  className="w-full h-40 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => { setHeroUrl(''); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-fg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 disabled:opacity-50 text-fg text-xs rounded-lg transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  {uploading ? 'Uploading…' : 'Replace'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-2 h-32 bg-surface border border-dashed border-line hover:border-brand rounded-xl text-fg-faint hover:text-brand disabled:opacity-50 transition-colors"
              >
                {uploading ? (
                  <span className="text-sm">Uploading…</span>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-sm">Click to upload image</span>
                    <span className="text-xs text-fg-faint">JPEG, PNG, WebP or GIF · max 5 MB</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Expiry date */}
          <div>
            <label className={labelCls}>Expiry Date <span className="text-red-400">*</span></label>
            <input
              className={inputCls}
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              min={new Date().toISOString().substring(0, 10)}
              required
            />
          </div>

          {/* Linked plan / package */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Link2 className="w-3.5 h-3.5 text-brand" />
              <label className={labelCls.replace('mb-1.5', '')}>Link to Plan or Package</label>
            </div>
            <select
              className={inputCls}
              value={linkedId}
              onChange={e => setLinkedId(e.target.value)}
              disabled={loadingOptions}
            >
              <option value="">— None (record payment only) —</option>
              {planOptions.filter(p => p.type === 'plan').length > 0 && (
                <optgroup label="Membership Plans">
                  {planOptions.filter(p => p.type === 'plan').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              )}
              {planOptions.filter(p => p.type === 'package').length > 0 && (
                <optgroup label="Service Packages">
                  {planOptions.filter(p => p.type === 'package').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.category ? ` (${p.category})` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {linkedOption && (
              <div className="mt-2 flex flex-wrap gap-2">
                {linkedOption.price != null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand/10 text-brand text-xs rounded-full">
                    Original price: {linkedOption.price.toLocaleString()} EGP
                  </span>
                )}
                {linkedOption.session_count != null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600/10 text-blue-300 text-xs rounded-full">
                    {linkedOption.session_count} sessions
                  </span>
                )}
                {linkedOption.duration_days != null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600/10 text-teal-300 text-xs rounded-full">
                    {linkedOption.duration_days} days
                  </span>
                )}
              </div>
            )}
            <p className="text-xs text-fg-faint mt-1">
              When set, buying this offer activates the linked plan or service package at the offer price. Original price and sessions auto-filled from the plan.
            </p>
          </div>

          {/* CTA label only */}
          <div>
            <label className={labelCls}>CTA Button Label</label>
            <input
              className={inputCls}
              value={ctaLabel}
              onChange={e => setCtaLabel(e.target.value)}
              placeholder="e.g. Buy Now"
            />
          </div>

          {/* Terms & conditions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls.replace('mb-1.5', '')}>Terms &amp; Conditions</label>
              <span className="text-xs text-fg-faint">{terms.length}/10</span>
            </div>
            {terms.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {terms.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 bg-surface border border-line rounded-lg px-3 py-2">
                    <span className="text-sm text-fg-muted flex-1">{t}</span>
                    <button
                      type="button"
                      onClick={() => removeTerm(i)}
                      className="text-fg-faint hover:text-danger transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {terms.length < 10 && (
              <div className="flex gap-2">
                <input
                  ref={termRef}
                  className={`${inputCls} flex-1`}
                  value={termInput}
                  onChange={e => setTermInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTerm(); } }}
                  placeholder="Add a term and press Enter"
                />
                <button
                  type="button"
                  onClick={addTerm}
                  disabled={!termInput.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-surface-3 hover:bg-surface-4 disabled:opacity-40 text-fg text-sm rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </form>
      </Modal.Body>

      {/* Footer */}
      <Modal.Footer className="justify-end">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="offer-form" variant="primary" disabled={uploading} isLoading={saving}>
          {isEdit ? 'Save Changes' : 'Create Offer'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
