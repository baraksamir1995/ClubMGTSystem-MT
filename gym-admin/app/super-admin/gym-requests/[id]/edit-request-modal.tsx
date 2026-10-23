'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';

/** Must match GymRequestController::CATEGORIES. */
const CATEGORIES = ['gym', 'crossfit', 'martial_arts', 'yoga_pilates', 'boxing', 'dance', 'swimming', 'sports_club', 'other'];

export interface EditableRequest {
  id: string;
  gym_name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  city: string;
  country: string;
  phone: string;
  business_email: string;
  category: string | null;
  services: string[] | null;
  branches_count: number;
  timezone: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
}

type Form = {
  gym_name: string; description: string; address: string; city: string; country: string;
  phone: string; business_email: string; category: string; services: string;
  branches_count: string; timezone: string; owner_name: string; owner_email: string; owner_phone: string;
};

const toForm = (r: EditableRequest): Form => ({
  gym_name: r.gym_name, description: r.description ?? '', address: r.address ?? '',
  city: r.city, country: r.country, phone: r.phone, business_email: r.business_email,
  category: r.category ?? 'gym', services: (r.services ?? []).join(', '),
  branches_count: String(r.branches_count), timezone: r.timezone,
  owner_name: r.owner_name, owner_email: r.owner_email, owner_phone: r.owner_phone,
});

/**
 * Super-admin correction of a pending gym request before approval — e.g.
 * the owner's phone already belongs to another account. Only changed fields
 * are sent; the API re-checks owner email/phone conflicts and audits the
 * change (gym_request_events "edited").
 */
export default function EditRequestModal({ request, onClose, onSaved }: {
  request: EditableRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = useRef(toForm(request));
  const [form, setForm] = useState<Form>(initial.current);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(request.logo_url);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving && !uploading) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving, uploading]);

  const set = (k: keyof Form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  };

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be 2 MB or smaller'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('logo', file);
      const res = await fetch(`/api/super-admin/gym-requests/${request.id}/logo`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(json?.errors?.logo?.[0] ?? apiErrorMessage(json, res.status)); return; }
      setLogoUrl(json.data.logo_url);
      toast.success('Logo updated');
      onSaved();
    } catch { toast.error(networkErrorMessage()); }
    finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const save = async () => {
    if (saving) return;
    const changed: Record<string, unknown> = {};
    (Object.keys(form) as (keyof Form)[]).forEach(k => {
      if (form[k] === initial.current[k]) return;
      if (k === 'services') {
        changed.services = form.services.split(',').map(s => s.trim()).filter(Boolean);
      } else if (k === 'branches_count') {
        changed.branches_count = parseInt(form.branches_count) || 0;
      } else if (k === 'description' || k === 'address') {
        changed[k] = form[k].trim() || null;
      } else {
        changed[k] = form[k].trim();
      }
    });
    if (Object.keys(changed).length === 0) { onClose(); return; }

    setSaving(true);
    setErrors({});
    try {
      const res = await fetch(`/api/super-admin/gym-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 422 && json?.errors) {
          const fe: Record<string, string> = {};
          for (const [k, v] of Object.entries(json.errors as Record<string, string[]>)) fe[k.split('.')[0]] = v[0];
          setErrors(fe);
          toast.error('Fix the highlighted fields');
        } else {
          toast.error(json?.message ?? apiErrorMessage(json, res.status));
        }
        return;
      }
      toast.success('Request updated');
      onSaved();
      onClose();
    } catch { toast.error(networkErrorMessage()); }
    finally { setSaving(false); }
  };

  const inp = (k: string) =>
    `w-full px-3 py-2 bg-surface-3 border rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors ${errors[k] ? 'border-danger' : 'border-line-strong'}`;

  const F = ({ k, label, type = 'text', wide = false }: { k: keyof Form; label: string; type?: string; wide?: boolean }) => (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={`edit-${k}`} className="block text-xs font-medium text-fg-muted mb-1.5">{label}</label>
      <input id={`edit-${k}`} type={type} value={form[k]} onChange={e => set(k, e.target.value)}
        aria-invalid={!!errors[k]} className={inp(k)} />
      {errors[k] && <p className="text-xs text-danger mt-1">{errors[k]}</p>}
    </div>
  );

  const Heading = ({ children }: { children: React.ReactNode }) => (
    <h3 className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-fg-faint pt-2">{children}</h3>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !saving && !uploading && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Edit request" onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-surface-2 border border-line rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-lg font-semibold text-fg">Edit request</h2>
          <button onClick={onClose} disabled={saving || uploading} aria-label="Close" className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Heading>Logo (app splash screen)</Heading>
            <div className="sm:col-span-2 flex items-center gap-4">
              {logoUrl
                ? <img src={logoUrl} alt="Gym logo" className="w-16 h-16 rounded-xl object-cover bg-surface-3 border border-line" />
                : <div className="w-16 h-16 rounded-xl bg-danger-soft border border-danger/40 flex items-center justify-center text-[10px] text-danger text-center px-1">No logo</div>}
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2 bg-surface-3 border border-line hover:border-line-strong text-sm text-fg rounded-lg disabled:opacity-50">
                {uploading ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden /> : <ImagePlus className="w-4 h-4" aria-hidden />}
                {logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                aria-label="Upload logo" onChange={e => uploadLogo(e.target.files?.[0])} />
              <p className="text-xs text-fg-faint">Uploads immediately. PNG/JPG/WebP, max 2 MB.</p>
            </div>

            <Heading>Gym</Heading>
            {F({ k: 'gym_name', label: 'Name', wide: true })}
            <div>
              <label htmlFor="edit-category" className="block text-xs font-medium text-fg-muted mb-1.5">Category</label>
              <select id="edit-category" value={form.category} onChange={e => set('category', e.target.value)} className={inp('category')}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            {F({ k: 'branches_count', label: 'Branches', type: 'number' })}
            <div className="sm:col-span-2">
              <label htmlFor="edit-description" className="block text-xs font-medium text-fg-muted mb-1.5">Description</label>
              <textarea id="edit-description" rows={3} value={form.description} onChange={e => set('description', e.target.value)} className={inp('description')} />
              {errors.description && <p className="text-xs text-danger mt-1">{errors.description}</p>}
            </div>
            {F({ k: 'services', label: 'Services (comma-separated)', wide: true })}

            <Heading>Location</Heading>
            {F({ k: 'address', label: 'Address', wide: true })}
            {F({ k: 'city', label: 'City' })}
            {F({ k: 'country', label: 'Country' })}
            {F({ k: 'timezone', label: 'Timezone (e.g. Africa/Cairo)', wide: true })}

            <Heading>Business contact</Heading>
            {F({ k: 'phone', label: 'Phone', type: 'tel' })}
            {F({ k: 'business_email', label: 'Email', type: 'email' })}

            <Heading>Owner</Heading>
            {F({ k: 'owner_name', label: 'Full name', wide: true })}
            {F({ k: 'owner_email', label: 'Email (dashboard username)', type: 'email' })}
            {F({ k: 'owner_phone', label: 'Mobile', type: 'tel' })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">Cancel</button>
          <button onClick={save} disabled={saving || uploading}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-semibold rounded-lg disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
