'use client';

import { useState, useRef } from 'react';
import {
  Upload, Trash2, Loader2, ImageIcon, Eye, EyeOff,
  ExternalLink, Smartphone, ChevronDown, ChevronUp, Pencil, Check, X, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymBanner } from '@/app/dashboard/content/page';
import { can, type Permission } from '@/lib/get-permissions';

interface Props {
  initialBanners: GymBanner[];
  permissions: Permission[] | null;
}

type ActionType = 'none' | 'external_link' | 'internal' | 'sponsor';

const ACTION_LABELS: Record<ActionType, string> = {
  none:          'No action',
  external_link: 'Open URL',
  internal:      'Internal screen',
  sponsor:       'Sponsor offer',
};

const INTERNAL_SCREENS = [
  { value: 'schedule',   label: 'Schedule' },
  { value: 'membership', label: 'Membership' },
  { value: 'checkin',    label: 'Check-in' },
  { value: 'profile',    label: 'Profile' },
];

interface UploadForm {
  caption: string;
  description: string;
  tag: string;
  tagColor: string;
  actionType: ActionType;
  actionValue: string;
  sortOrder: string;
  // Sponsor variant: shown when actionType === 'sponsor'.
  sponsorPromoCode: string;
  sponsorExternalUrl: string;
  sponsorTerms: string;
}

const emptyForm = (): UploadForm => ({
  caption: '', description: '', tag: '', tagColor: '#FFFFFF', actionType: 'none', actionValue: '', sortOrder: '0',
  sponsorPromoCode: '', sponsorExternalUrl: '', sponsorTerms: '',
});

export default function BannersTab({ initialBanners, permissions }: Props) {
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
  // Tracks which banner row a click on the hidden replace-image input
  // belongs to, so we know which row to PATCH when the file is picked.
  const pendingReplaceIdRef = useRef<string | null>(null);

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
      // Sponsor variant uses dedicated columns instead of actionValue, so
      // null actionValue out for that type to keep the union semantics clean.
      fd.append('actionValue', form.actionType === 'none' || form.actionType === 'sponsor' ? '' : form.actionValue);
      fd.append('sortOrder',   form.sortOrder);
      if (form.actionType === 'sponsor') {
        fd.append('sponsorPromoCode',   form.sponsorPromoCode);
        fd.append('sponsorExternalUrl', form.sponsorExternalUrl);
        fd.append('sponsorTerms',       form.sponsorTerms);
      }

      const res  = await fetch('/api/content/banners', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return; }
      setBanners(prev => [...prev, data.banner]);
      setForm(emptyForm());
      setShowForm(false);
      toast.success('Banner added');
    } catch { toast.error('Network error'); }
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
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setBanners(prev => prev.map(b => b.id === banner.id ? data.banner : b));
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

  // ─── Replace image only (no other field changes) ──────────────────────────
  const replaceImage = async (bannerId: string, file: File) => {
    setReplacingId(bannerId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/content/banners/${bannerId}/image`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Image upload failed'); return; }
      const updated = data.banner ?? data;
      setBanners(prev => prev.map(b => b.id === bannerId ? updated : b));
      toast.success('Image updated');
    } catch { toast.error('Network error'); }
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
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setBanners(prev => prev.map(b => b.id === banner.id ? data.banner : b));
      setEditingId(null);
      toast.success('Banner updated');
    } catch { toast.error('Network error'); }
    finally { setSavingId(null); }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const deleteBanner = async (banner: GymBanner) => {
    if (!confirm('Delete this banner?')) return;
    setDeletingId(banner.id);
    try {
      const res = await fetch(`/api/content/banners/${banner.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setBanners(prev => prev.filter(b => b.id !== banner.id));
      toast.success('Banner deleted');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  const sortedBanners = [...banners].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-6">

      {/* Always-mounted hidden input for the per-row Replace-image overlay.
          Lives at the root so it's available regardless of whether the
          create/upload form is currently expanded. */}
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
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowForm(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-white hover:bg-gray-750 transition-colors">
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" />
              Add New Banner
            </span>
            {showForm ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showForm && (
            <div className="px-5 pb-5 space-y-3 border-t border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <input
                  value={form.caption}
                  onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  placeholder="Caption (optional)"
                  className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <input
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                  type="number"
                  placeholder="Sort order (0 = first)"
                  className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (shown on banner detail screen)"
                rows={2}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
              />

              <div className="flex items-center gap-2">
                <input
                  value={form.tag}
                  onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                  placeholder="Tag label (e.g. New, Promo, Event)"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="text-xs text-gray-400 whitespace-nowrap">Tag color</label>
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
                  className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                  {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>

                {form.actionType === 'external_link' && (
                  <input
                    value={form.actionValue}
                    onChange={e => setForm(f => ({ ...f, actionValue: e.target.value }))}
                    placeholder="https://example.com"
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                )}
                {form.actionType === 'internal' && (
                  <select
                    value={form.actionValue}
                    onChange={e => setForm(f => ({ ...f, actionValue: e.target.value }))}
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                    <option value="">Select screen…</option>
                    {INTERNAL_SCREENS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {form.actionType === 'sponsor' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-purple-700/40 bg-purple-900/10">
                  <input
                    value={form.sponsorPromoCode}
                    onChange={e => setForm(f => ({ ...f, sponsorPromoCode: e.target.value }))}
                    placeholder="Promo code (e.g. CLBY15) — optional"
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <input
                    value={form.sponsorExternalUrl}
                    onChange={e => setForm(f => ({ ...f, sponsorExternalUrl: e.target.value }))}
                    placeholder="External URL (e.g. proteinhouse.com) — optional"
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <input
                    value={form.sponsorTerms}
                    onChange={e => setForm(f => ({ ...f, sponsorTerms: e.target.value }))}
                    placeholder="Fine-print terms — optional"
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 sm:col-span-2"
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
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                  {uploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                    : <><Upload className="w-4 h-4" /> Choose Image & Upload</>}
                </button>
                <p className="text-xs text-gray-500">
                  Recommended <span className="text-gray-300 font-medium">1170×534 px</span> (2.19∶1) · JPG or PNG · &lt; 500 KB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Banner list ────────────────────────────────────────────────────── */}
      {sortedBanners.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <ImageIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No banners yet — add one above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBanners.map(banner => {
            const isEditing = editingId === banner.id;
            const ef = editForm as UploadForm;

            return (
              <div
                key={banner.id}
                className={`bg-gray-800 border rounded-xl overflow-hidden transition-opacity ${
                  banner.is_active ? 'border-gray-700' : 'border-gray-700 opacity-60'
                }`}>

                <div className="flex gap-0">
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-32 h-24 sm:w-40 sm:h-28 group">
                    <img
                      src={banner.image_url}
                      alt={banner.caption ?? 'Banner'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1.5 left-1.5 flex gap-1 flex-wrap">
                      {!banner.is_active && (
                        <span className="text-xs bg-gray-900/90 text-gray-400 px-1.5 py-0.5 rounded-full">
                          Inactive
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
                        title="Replace image"
                        className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 hover:bg-black/55 text-white text-xs font-medium opacity-0 hover:opacity-100 transition-all disabled:opacity-100 disabled:bg-black/55">
                        {replacingId === banner.id
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/> Uploading…</>
                          : <><Upload className="w-3.5 h-3.5"/> Replace image</>}
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
                            placeholder="Caption"
                            className="bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          />
                          <input
                            value={ef.sortOrder}
                            onChange={e => setEditForm(f => ({ ...f, sortOrder: e.target.value }))}
                            type="number"
                            placeholder="Sort order"
                            className="bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <textarea
                          value={ef.description}
                          onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Description"
                          rows={2}
                          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            value={ef.tag}
                            onChange={e => setEditForm(f => ({ ...f, tag: e.target.value }))}
                            placeholder="Tag label (optional)"
                            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="text-xs text-gray-400 whitespace-nowrap">Color</label>
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
                              // Clear all variant-specific fields so toggling
                              // sponsor → external → sponsor doesn't re-surface
                              // stale promo code / URL / terms.
                              actionValue: '',
                              sponsorPromoCode: '',
                              sponsorExternalUrl: '',
                              sponsorTerms: '',
                            }))}
                            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500">
                            {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                          {ef.actionType === 'external_link' && (
                            <input
                              value={ef.actionValue}
                              onChange={e => setEditForm(f => ({ ...f, actionValue: e.target.value }))}
                              placeholder="https://…"
                              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                            />
                          )}
                          {ef.actionType === 'internal' && (
                            <select
                              value={ef.actionValue}
                              onChange={e => setEditForm(f => ({ ...f, actionValue: e.target.value }))}
                              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500">
                              <option value="">Select screen…</option>
                              {INTERNAL_SCREENS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {ef.actionType === 'sponsor' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg border border-purple-700/40 bg-purple-900/10">
                            <input
                              value={ef.sponsorPromoCode ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, sponsorPromoCode: e.target.value }))}
                              placeholder="Promo code"
                              className="bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                            />
                            <input
                              value={ef.sponsorExternalUrl ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, sponsorExternalUrl: e.target.value }))}
                              placeholder="External URL"
                              className="bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                            />
                            <input
                              value={ef.sponsorTerms ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, sponsorTerms: e.target.value }))}
                              placeholder="Terms"
                              className="bg-gray-900 border border-gray-600 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 sm:col-span-2"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-white truncate">
                          {banner.caption || <span className="text-gray-500 italic">No caption</span>}
                        </p>
                        {banner.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{banner.description}</p>
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
                          <ActionBadge type={banner.action_type as ActionType} value={banner.action_value} />
                          <span className="text-xs text-gray-500">Order: {banner.sort_order ?? 0}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-center justify-center gap-1.5 px-3 border-l border-gray-700">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(banner)}
                          disabled={savingId === banner.id}
                          title="Save"
                          className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/40 text-green-400 transition-colors">
                          {savingId === banner.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          title="Cancel"
                          className="p-1.5 rounded-lg bg-gray-600/40 hover:bg-gray-600 text-gray-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {can(permissions, 'content', 'edit') && (
                          <button
                            onClick={() => startEdit(banner)}
                            title="Edit"
                            className="p-1.5 rounded-lg bg-gray-600/40 hover:bg-gray-600 text-gray-300 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {can(permissions, 'content', 'edit') && (
                          <button
                            onClick={() => toggleActive(banner)}
                            disabled={togglingId === banner.id}
                            title={banner.is_active ? 'Deactivate' : 'Activate'}
                            className="p-1.5 rounded-lg bg-gray-600/40 hover:bg-gray-600 text-gray-300 transition-colors">
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
                            title="Delete"
                            className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors">
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

function ActionBadge({ type, value }: { type: ActionType; value: string | null }) {
  if (type === 'external_link') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
        <ExternalLink className="w-3 h-3" />
        {value ? (
          <span className="max-w-[120px] truncate">{value}</span>
        ) : 'URL not set'}
      </span>
    );
  }
  if (type === 'internal') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20">
        <Smartphone className="w-3 h-3" />
        {value || 'Screen not set'}
      </span>
    );
  }
  if (type === 'sponsor') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20">
        <Tag className="w-3 h-3" />
        Sponsor
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-600">No action</span>
  );
}
