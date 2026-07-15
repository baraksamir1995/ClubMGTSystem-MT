'use client';

import { useState, useRef } from 'react';
import {
  Upload, Trash2, Loader2, ImageIcon, Eye, EyeOff,
  ExternalLink, Smartphone, ChevronDown, ChevronUp, Pencil, Check, X, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { GymBanner } from '@/app/dashboard/content/page';
import { can, type Permission } from '@/lib/get-permissions';

interface Props {
  initialBanners: GymBanner[];
  permissions: Permission[] | null;
}

type ActionType = 'none' | 'external_link' | 'internal' | 'sponsor';

interface UploadForm {
  caption: string;
  description: string;
  tag: string;
  tagColor: string;
  actionType: ActionType;
  actionValue: string;
  sortOrder: string;
  sponsorPromoCode: string;
  sponsorExternalUrl: string;
  sponsorTerms: string;
}

const emptyForm = (): UploadForm => ({
  caption: '', description: '', tag: '', tagColor: '#FFFFFF', actionType: 'none', actionValue: '', sortOrder: '0',
  sponsorPromoCode: '', sponsorExternalUrl: '', sponsorTerms: '',
});

export default function BannersTab({ initialBanners, permissions }: Props) {
  const t = useTranslations('content');
  const tc = useTranslations('common');

  const [banners,    setBanners]    = useState<GymBanner[]>(initialBanners);
  const [uploading,  setUploading]  = useState(false);
  const [form,       setForm]       = useState<UploadForm>(emptyForm());
  const [showForm,   setShowForm]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editForm,   setEditForm]   = useState<Partial<UploadForm>>({});
  const [savingId,   setSavingId]   = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const pendingReplaceIdRef = useRef<string | null>(null);

  const ACTION_LABELS: Record<ActionType, string> = {
    none:          t('banners.noAction'),
    external_link: t('banners.openUrl'),
    internal:      t('banners.internalScreen'),
    sponsor:       t('banners.sponsorOffer'),
  };

  const INTERNAL_SCREENS = [
    { value: 'schedule',   label: t('popups.screens.schedule') },
    { value: 'membership', label: t('popups.screens.membership') },
    { value: 'checkin',    label: t('popups.screens.checkin') },
    { value: 'profile',    label: t('popups.screens.profile') },
  ];

  // ─── Upload ────────────────────────────────────────────────────────────────
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('caption',     form.caption);
      fd.append('description', form.description);
      fd.append('tag',         form.tag);
      fd.append('tagColor',    form.tag ? form.tagColor : '');
      fd.append('actionType',  form.actionType);
      fd.append('actionValue', form.actionType === 'none' || form.actionType === 'sponsor' ? '' : form.actionValue);
      fd.append('sortOrder',   form.sortOrder);
      if (form.actionType === 'sponsor') {
        fd.append('sponsorPromoCode',   form.sponsorPromoCode);
        fd.append('sponsorExternalUrl', form.sponsorExternalUrl);
        fd.append('sponsorTerms',       form.sponsorTerms);
      }

      const res  = await fetch('/api/content/banners', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('banners.uploadFailed')); return; }
      setBanners(prev => [...prev, data.banner]);
      setForm(emptyForm());
      setShowForm(false);
      toast.success(t('banners.addedSuccess'));
    } catch { toast.error(tc('networkError')); }
    finally { setUploading(false); }
  };

  // ─── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (banner: GymBanner) => {
    setTogglingId(banner.id);
    try {
      const res  = await fetch(`/api/content/banners/${banner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !banner.is_active }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tc('somethingWrong')); return; }
      setBanners(prev => prev.map(b => b.id === banner.id ? data.banner : b));
    } catch { toast.error(tc('networkError')); }
    finally { setTogglingId(null); }
  };

  // ─── Replace image only ───────────────────────────────────────────────────
  const replaceImage = async (bannerId: string, file: File) => {
    setReplacingId(bannerId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/content/banners/${bannerId}/image`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('banners.imageUploadFailed')); return; }
      const updated = data.banner ?? data;
      setBanners(prev => prev.map(b => b.id === bannerId ? updated : b));
      toast.success(t('banners.imageUpdatedSuccess'));
    } catch { toast.error(tc('networkError')); }
    finally { setReplacingId(null); }
  };

  // ─── Inline edit save ─────────────────────────────────────────────────────
  const startEdit = (banner: GymBanner) => {
    setEditingId(banner.id);
    setEditForm({
      caption:     banner.caption     ?? '',
      description: banner.description ?? '',
      tag:         banner.tag         ?? '',
      tagColor:    banner.tag_color   ?? '#FFFFFF',
      actionType:  (banner.action_type as ActionType) ?? 'none',
      actionValue: banner.action_value ?? '',
      sortOrder:   String(banner.sort_order ?? 0),
      sponsorPromoCode:   banner.sponsor_promo_code   ?? '',
      sponsorExternalUrl: banner.sponsor_external_url ?? '',
      sponsorTerms:       banner.sponsor_terms        ?? '',
    });
  };

  const saveEdit = async (banner: GymBanner) => {
    setSavingId(banner.id);
    try {
      const res = await fetch(`/api/content/banners/${banner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption:     editForm.caption || null,
          description: editForm.description || null,
          tag:         editForm.tag || null,
          tagColor:    editForm.tag ? (editForm.tagColor || null) : null,
          actionType:  editForm.actionType,
          actionValue: editForm.actionType === 'none' || editForm.actionType === 'sponsor'
            ? null
            : (editForm.actionValue || null),
          sortOrder:   parseInt(editForm.sortOrder ?? '0', 10),
          sponsorPromoCode:   editForm.actionType === 'sponsor' ? (editForm.sponsorPromoCode   || null) : null,
          sponsorExternalUrl: editForm.actionType === 'sponsor' ? (editForm.sponsorExternalUrl || null) : null,
          sponsorTerms:       editForm.actionType === 'sponsor' ? (editForm.sponsorTerms       || null) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tc('somethingWrong')); return; }
      setBanners(prev => prev.map(b => b.id === banner.id ? data.banner : b));
      setEditingId(null);
      toast.success(t('banners.updatedSuccess'));
    } catch { toast.error(tc('networkError')); }
    finally { setSavingId(null); }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const deleteBanner = async (banner: GymBanner) => {
    if (!confirm(t('banners.confirmDelete'))) return;
    setDeletingId(banner.id);
    try {
      const res = await fetch(`/api/content/banners/${banner.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(tc('somethingWrong')); return; }
      setBanners(prev => prev.filter(b => b.id !== banner.id));
      toast.success(t('banners.deletedSuccess'));
    } catch { toast.error(tc('networkError')); }
    finally { setDeletingId(null); }
  };

  const sortedBanners = [...banners].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-6">

      {/* Always-mounted hidden input for the per-row Replace-image overlay. */}
      <input
        ref={replaceFileRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          const id = pendingReplaceIdRef.current;
          pendingReplaceIdRef.current = null;
          if (f && id) replaceImage(id, f);
          e.target.value = '';
        }}
      />

      {/* ── Upload section ─────────────────────────────────────────────────── */}
      {can(permissions, 'content', 'create') && (
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          <button
            onClick={() => setShowForm(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-fg hover:bg-surface-3 transition-colors">
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand" />
              {t('banners.addNew')}
            </span>
            {showForm ? <ChevronUp className="w-4 h-4 text-fg-muted" /> : <ChevronDown className="w-4 h-4 text-fg-muted" />}
          </button>

          {showForm && (
            <div className="px-5 pb-5 space-y-3 border-t border-line">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <input
                  value={form.caption}
                  onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  placeholder={t('banners.captionPlaceholder')}
                  className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                />
                <input
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                  type="number"
                  placeholder={t('banners.sortOrderPlaceholder')}
                  className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                />
              </div>

              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('banners.descriptionPlaceholder')}
                rows={2}
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand resize-none"
              />

              <div className="flex items-center gap-2">
                <input
                  value={form.tag}
                  onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                  placeholder={t('banners.tagPlaceholder')}
                  className="flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="text-xs text-fg-muted whitespace-nowrap">{t('banners.tagColor')}</label>
                  <input
                    type="color"
                    value={form.tagColor}
                    onChange={e => setForm(f => ({ ...f, tagColor: e.target.value }))}
                    disabled={!form.tag}
                    className="w-8 h-8 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border-0 bg-transparent p-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={form.actionType}
                  onChange={e => setForm(f => ({
                    ...f,
                    actionType: e.target.value as ActionType,
                    actionValue: '',
                    sponsorPromoCode: '',
                    sponsorExternalUrl: '',
                    sponsorTerms: '',
                  }))}
                  className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand">
                  {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>

                {form.actionType === 'external_link' && (
                  <input
                    value={form.actionValue}
                    onChange={e => setForm(f => ({ ...f, actionValue: e.target.value }))}
                    placeholder="https://example.com"
                    className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                  />
                )}
                {form.actionType === 'internal' && (
                  <select
                    value={form.actionValue}
                    onChange={e => setForm(f => ({ ...f, actionValue: e.target.value }))}
                    className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand">
                    <option value="">{t('banners.selectScreen')}</option>
                    {INTERNAL_SCREENS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {form.actionType === 'sponsor' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-brand/40 bg-brand/10">
                  <input
                    value={form.sponsorPromoCode}
                    onChange={e => setForm(f => ({ ...f, sponsorPromoCode: e.target.value }))}
                    placeholder={t('banners.sponsorPromoPlaceholder')}
                    className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                  />
                  <input
                    value={form.sponsorExternalUrl}
                    onChange={e => setForm(f => ({ ...f, sponsorExternalUrl: e.target.value }))}
                    placeholder={t('banners.sponsorUrlPlaceholder')}
                    className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                  />
                  <input
                    value={form.sponsorTerms}
                    onChange={e => setForm(f => ({ ...f, sponsorTerms: e.target.value }))}
                    placeholder={t('banners.sponsorTermsPlaceholder')}
                    className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand sm:col-span-2"
                  />
                </div>
              )}

              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                  {uploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('banners.uploading')}</>
                    : <><Upload className="w-4 h-4" /> {t('banners.chooseImageUpload')}</>}
                </button>
                <p className="text-xs text-fg-faint">
                  {t('banners.imageSpec', { dims: '1170×534 px' })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Banner list ────────────────────────────────────────────────────── */}
      {sortedBanners.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <ImageIcon className="w-10 h-10 text-fg-faint mx-auto mb-3" />
          <p className="text-sm text-fg-muted">{t('banners.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBanners.map(banner => {
            const isEditing = editingId === banner.id;
            const ef = editForm as UploadForm;

            return (
              <div
                key={banner.id}
                className={`bg-surface-2 border rounded-xl overflow-hidden transition-opacity ${
                  banner.is_active ? "border-line" : "border-line opacity-60"
                }`}>

                <div className="flex gap-0">
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-32 h-24 sm:w-40 sm:h-28 group">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded banner on external host */}
                    <img
                      src={banner.image_url}
                      alt={banner.caption ?? t('banners.addNew')}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 start-1.5 flex gap-1 flex-wrap">
                      {!banner.is_active && (
                        <span className="text-xs bg-surface/90 text-fg-muted px-1.5 py-0.5 rounded-full">
                          {t('banners.inactive')}
                        </span>
                      )}
                    </div>
                    {can(permissions, 'content', 'edit') && (
                      <button
                        type="button"
                        disabled={replacingId === banner.id}
                        onClick={() => {
                          pendingReplaceIdRef.current = banner.id;
                          replaceFileRef.current?.click();
                        }}
                        title={t('banners.replaceImage')}
                        className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 hover:bg-black/55 text-fg text-xs font-medium opacity-0 hover:opacity-100 transition-all disabled:opacity-100 disabled:bg-black/55">
                        {replacingId === banner.id
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> {t('banners.uploading')}</>
                          : <><Upload className="w-3.5 h-3.5"/> {t('banners.replaceImage')}</>}
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={ef.caption}
                            onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))}
                            placeholder={t('banners.captionEditPlaceholder')}
                            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                          />
                          <input
                            value={ef.sortOrder}
                            onChange={e => setEditForm(f => ({ ...f, sortOrder: e.target.value }))}
                            type="number"
                            placeholder={t('banners.sortOrderEditPlaceholder')}
                            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                          />
                        </div>
                        <textarea
                          value={ef.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          placeholder={t('banners.descriptionEditPlaceholder')}
                          rows={2}
                          className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            value={ef.tag}
                            onChange={e => setEditForm(f => ({ ...f, tag: e.target.value }))}
                            placeholder={t('banners.tagEditPlaceholder')}
                            className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="text-xs text-fg-muted whitespace-nowrap">{t('banners.tagColorShort')}</label>
                            <input
                              type="color"
                              value={ef.tagColor ?? '#FFFFFF'}
                              onChange={e => setEditForm(f => ({ ...f, tagColor: e.target.value }))}
                              disabled={!ef.tag}
                              className="w-7 h-7 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border-0 bg-transparent p-0"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={ef.actionType}
                            onChange={e => setEditForm(f => ({
                              ...f,
                              actionType: e.target.value as ActionType,
                              actionValue: '',
                              sponsorPromoCode: '',
                              sponsorExternalUrl: '',
                              sponsorTerms: '',
                            }))}
                            className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-brand">
                            {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                          {ef.actionType === 'external_link' && (
                            <input
                              value={ef.actionValue}
                              onChange={e => setEditForm(f => ({ ...f, actionValue: e.target.value }))}
                              placeholder="https://…"
                              className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                            />
                          )}
                          {ef.actionType === 'internal' && (
                            <select
                              value={ef.actionValue}
                              onChange={e => setEditForm(f => ({ ...f, actionValue: e.target.value }))}
                              className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-brand">
                              <option value="">{t('banners.selectScreen')}</option>
                              {INTERNAL_SCREENS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {ef.actionType === 'sponsor' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg border border-brand/40 bg-brand/10">
                            <input
                              value={ef.sponsorPromoCode ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, sponsorPromoCode: e.target.value }))}
                              placeholder={t('banners.sponsorPromoEditPlaceholder')}
                              className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                            />
                            <input
                              value={ef.sponsorExternalUrl ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, sponsorExternalUrl: e.target.value }))}
                              placeholder={t('banners.sponsorUrlEditPlaceholder')}
                              className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand"
                            />
                            <input
                              value={ef.sponsorTerms ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, sponsorTerms: e.target.value }))}
                              placeholder={t('banners.sponsorTermsEditPlaceholder')}
                              className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand sm:col-span-2"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-fg truncate">
                          {banner.caption || <span className="text-fg-faint italic">{t('banners.noCaption')}</span>}
                        </p>
                        {banner.description && (
                          <p className="text-xs text-fg-muted mt-0.5 line-clamp-2">{banner.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {banner.tag && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                backgroundColor: banner.tag_color ?? '#ffffff22',
                                color: banner.tag_color
                                  ? (parseInt(banner.tag_color.replace('#',''), 16) > 0x7FFFFF ? '#1D1D1B' : '#ffffff')
                                  : '#d1d5db',
                              }}>
                              {banner.tag}
                            </span>
                          )}
                          <ActionBadge
                            type={banner.action_type as ActionType}
                            value={banner.action_value}
                            labels={{
                              urlNotSet: t('banners.urlNotSet'),
                              screenNotSet: t('banners.screenNotSet'),
                              sponsor: t('banners.sponsor'),
                              noAction: t('banners.noAction'),
                            }}
                          />
                          <span className="text-xs text-fg-faint">{t('banners.orderLabel', { order: banner.sort_order ?? 0 })}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-center justify-center gap-1.5 px-3 border-s border-line">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(banner)}
                          disabled={savingId === banner.id}
                          title={tc('save')}
                          aria-label={tc('save')}
                          className="p-1.5 rounded-lg bg-success-soft hover:bg-success/25 text-success transition-colors">
                          {savingId === banner.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          title={tc('cancel')}
                          aria-label={tc('cancel')}
                          className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {can(permissions, 'content', 'edit') && (
                          <button
                            onClick={() => startEdit(banner)}
                            title={tc('edit')}
                            aria-label={tc('edit')}
                            className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {can(permissions, 'content', 'edit') && (
                          <button
                            onClick={() => toggleActive(banner)}
                            disabled={togglingId === banner.id}
                            title={banner.is_active ? t('banners.deactivate') : t('banners.activate')}
                            aria-label={banner.is_active ? t('banners.deactivate') : t('banners.activate')}
                            className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted transition-colors">
                            {togglingId === banner.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : banner.is_active
                                ? <EyeOff className="w-4 h-4" />
                                : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                        {can(permissions, 'content', 'delete') && (
                          <button
                            onClick={() => deleteBanner(banner)}
                            disabled={deletingId === banner.id}
                            title={tc('delete')}
                            aria-label={tc('delete')}
                            className="p-1.5 rounded-lg bg-danger-soft hover:bg-danger/25 text-danger transition-colors">
                            {deletingId === banner.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ActionBadgeProps {
  type: ActionType;
  value: string | null;
  labels: { urlNotSet: string; screenNotSet: string; sponsor: string; noAction: string };
}

function ActionBadge({ type, value, labels }: ActionBadgeProps) {
  if (type === 'external_link') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-info-soft text-info px-2 py-0.5 rounded-full border border-info/40">
        <ExternalLink className="w-3 h-3" aria-hidden />
        {value ? (
          <span className="max-w-[120px] truncate">{value}</span>
        ) : labels.urlNotSet}
      </span>
    );
  }
  if (type === 'internal') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-brand/15 text-brand px-2 py-0.5 rounded-full border border-brand/20">
        <Smartphone className="w-3 h-3" aria-hidden />
        {value || labels.screenNotSet}
      </span>
    );
  }
  if (type === 'sponsor') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-warning-soft text-warning px-2 py-0.5 rounded-full border border-warning/40">
        <Tag className="w-3 h-3" aria-hidden />
        {labels.sponsor}
      </span>
    );
  }
  return (
    <span className="text-xs text-fg-faint">{labels.noAction}</span>
  );
}
