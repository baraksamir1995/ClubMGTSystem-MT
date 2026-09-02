'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, ImageIcon, RefreshCw, X, Check, ArrowUp, ArrowDown, Upload, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage, networkErrorMessage, responseErrorMessage } from '@/lib/api-error';

interface ClientLogo {
  id: string;
  name: string;
  logo_url: string;
  logo_path: string | null;
  website_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export default function ClientLogosPage() {
  const [logos, setLogos] = useState<ClientLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLogos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/client-logos');
      if (!res.ok) { toast.error(`Couldn't load client logos — ${await responseErrorMessage(res)}`); return; }
      const json = await res.json();
      setLogos(json.data ?? []);
    } catch { toast.error(networkErrorMessage()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogos(); }, [fetchLogos]);

  const resetForm = () => {
    setName(''); setWebsiteUrl(''); setLogoUrl(''); setLogoPath(null);
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (logo: ClientLogo) => {
    setName(logo.name);
    setWebsiteUrl(logo.website_url ?? '');
    setLogoUrl(logo.logo_url);
    setLogoPath(logo.logo_path);
    setEditingId(logo.id);
    setShowForm(true);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/super-admin/client-logos/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(`Couldn't upload image — ${apiErrorMessage(json, res.status)}`); return; }
      // A 200 without a usable url would blank the preview and then trip the
      // "Upload a logo image" guard on save, which reads as the upload
      // having silently done nothing. Fail loudly instead.
      if (typeof json?.url !== 'string' || !json.url) {
        toast.error("Couldn't upload image — the server did not return an image URL");
        return;
      }
      setLogoUrl(json.url);
      setLogoPath(typeof json.path === 'string' ? json.path : null);
    } catch { toast.error(networkErrorMessage()); }
    finally { setUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Enter the client name'); return; }
    if (!logoUrl) { toast.error('Upload a logo image'); return; }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        logo_url: logoUrl,
        logo_path: logoPath,
        website_url: websiteUrl.trim() || null,
      };

      const res = editingId
        ? await fetch(`/api/super-admin/client-logos/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/super-admin/client-logos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(`Couldn't ${editingId ? 'update' : 'add'} logo — ${apiErrorMessage(json, res.status)}`); return; }
      toast.success(editingId ? 'Logo updated' : 'Logo added');
      setShowForm(false);
      resetForm();
      fetchLogos();
    } catch { toast.error(networkErrorMessage()); }
    finally { setSaving(false); }
  };

  const deleteLogo = async (logo: ClientLogo) => {
    if (!confirm(`Remove "${logo.name}" from the carousel?`)) return;
    try {
      const res = await fetch(`/api/super-admin/client-logos/${logo.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(`Couldn't delete logo — ${apiErrorMessage(json, res.status)}`); return; }
      setLogos(prev => prev.filter(l => l.id !== logo.id));
      toast.success('Logo deleted');
    } catch { toast.error(networkErrorMessage()); }
  };

  /**
   * Show/hide a logo.
   *
   * `next` is computed once and used for both the request and the local
   * update — toggling `l.is_active` in the setter instead would apply a
   * second flip on a double-click and leave the badge disagreeing with the
   * database. `togglingId` blocks the overlapping request outright.
   */
  const toggleActive = async (logo: ClientLogo) => {
    if (togglingId) return;
    const next = !logo.is_active;
    setTogglingId(logo.id);
    try {
      const res = await fetch(`/api/super-admin/client-logos/${logo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      });
      if (!res.ok) { toast.error(`Couldn't update logo status — ${await responseErrorMessage(res)}`); return; }
      setLogos(prev => prev.map(l => l.id === logo.id ? { ...l, is_active: next } : l));
    } catch { toast.error(networkErrorMessage()); }
    finally { setTogglingId(null); }
  };

  /**
   * Move a logo one position and persist the whole order.
   *
   * The list is reordered optimistically so the arrows feel instant, and
   * rolled back if the save fails — otherwise the UI would show an order
   * the landing page isn't actually serving.
   */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= logos.length || reordering) return;

    const previous = logos;
    const next = [...logos];
    [next[index], next[target]] = [next[target], next[index]];
    setLogos(next);
    setReordering(true);

    try {
      const res = await fetch('/api/super-admin/client-logos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map(l => l.id) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setLogos(previous);
        toast.error(`Couldn't save the new order — ${apiErrorMessage(json, res.status)}`);
        return;
      }
      setLogos(json.data ?? next);
    } catch {
      setLogos(previous);
      toast.error(networkErrorMessage());
    } finally { setReordering(false); }
  };

  const inp = 'w-full px-3 py-2 bg-surface-3 border border-line-strong rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Client Logos</h1>
          <p className="text-sm text-fg-muted mt-0.5">Logos shown in the landing-page carousel, in display order</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" aria-hidden /> Add Logo
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 p-4">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-fg">{editingId ? 'Edit Logo' : 'New Logo'}</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} aria-label="Close" className="text-fg-muted hover:text-fg"><X className="w-5 h-5" aria-hidden /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Client Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Iron Strong" className={inp} required />
              </div>

              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Logo Image *</label>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-16 flex-shrink-0 bg-surface-3 border border-line-strong rounded-lg flex items-center justify-center overflow-hidden">
                    {logoUrl
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                      : <ImageIcon className="w-5 h-5 text-fg-faint" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" id="logo-file"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                    <label htmlFor="logo-file"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-surface-3 hover:bg-surface-3/70 border border-line-strong text-sm text-fg rounded-lg cursor-pointer transition-colors">
                      {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Upload className="w-3.5 h-3.5" aria-hidden />}
                      {logoUrl ? 'Replace image' : 'Choose image'}
                    </label>
                    <p className="text-xs text-fg-faint mt-1.5">PNG or SVG on a transparent background works best. Max 5MB.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Website</label>
                <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className={inp} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                <button type="submit" disabled={saving || uploading}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Check className="w-3.5 h-3.5" aria-hidden />}
                  {editingId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-brand animate-spin" />
        </div>
      )}

      {!loading && logos.length === 0 && (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <ImageIcon className="w-10 h-10 text-fg-faint mx-auto mb-3" aria-hidden />
          <p className="text-sm text-fg-muted">No client logos yet. Add your first one.</p>
        </div>
      )}

      {!loading && logos.length > 0 && (
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3 w-24">ORDER</th>
                <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">LOGO</th>
                <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">CLIENT</th>
                <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">STATUS</th>
                <th scope="col" className="text-right text-xs text-fg-muted font-medium px-5 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logos.map((logo, i) => (
                <tr key={logo.id} className="hover:bg-surface-3/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-fg-faint tabular-nums w-4">{i + 1}</span>
                      <button onClick={() => move(i, -1)} disabled={i === 0 || reordering}
                        aria-label={`Move ${logo.name} up`}
                        className="p-1 text-fg-muted hover:text-brand hover:bg-brand/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted">
                        <ArrowUp className="w-3.5 h-3.5" aria-hidden />
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === logos.length - 1 || reordering}
                        aria-label={`Move ${logo.name} down`}
                        className="p-1 text-fg-muted hover:text-brand hover:bg-brand/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted">
                        <ArrowDown className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="w-24 h-12 bg-surface-3 border border-line rounded-lg flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo.logo_url} alt={logo.name} className="max-w-full max-h-full object-contain" />
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-fg font-medium">{logo.name}</p>
                    {logo.website_url && (
                      <a href={logo.website_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-fg-faint hover:text-brand mt-0.5 transition-colors">
                        {logo.website_url.replace(/^https?:\/\//, '')}
                        <ExternalLink className="w-3 h-3" aria-hidden />
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(logo)} disabled={togglingId !== null}
                      aria-label={`${logo.is_active ? 'Hide' : 'Show'} ${logo.name}`}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${logo.is_active ? 'bg-success-soft text-success' : 'bg-surface-3 text-fg-muted'}`}>
                      {logo.is_active ? 'Visible' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(logo)} aria-label={`Edit ${logo.name}`} className="p-1.5 text-fg-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" aria-hidden />
                      </button>
                      <button onClick={() => deleteLogo(logo)} aria-label={`Delete ${logo.name}`} className="p-1.5 text-fg-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
