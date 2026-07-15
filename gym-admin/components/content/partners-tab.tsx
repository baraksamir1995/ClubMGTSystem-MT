'use client';

import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Check, Upload, Handshake } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { can, type Permission } from '@/lib/get-permissions';
import { Button } from '@/components/ui';

export interface GymPartner {
  id: string;
  name: string;
  image_url: string | null;
  storage_path: string | null;
  is_visible: boolean;
  display_order: number;
  created_at: string;
}

interface Props {
  initialPartners: GymPartner[];
  permissions: Permission[] | null;
  gymId: string;
}

const emptyForm = { name: '' };
const inp = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand';

export default function PartnersTab({ initialPartners, permissions, gymId }: Props) {
  const t = useTranslations('content');
  const tc = useTranslations('common');

  const [partners, setPartners]         = useState<GymPartner[]>(initialPartners);
  const [showForm, setShowForm]         = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [form, setForm]                 = useState(emptyForm);
  const [imageUrl, setImageUrl]         = useState('');
  const [storagePath, setStoragePath]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [togglingId, setTogglingId]     = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  // gymId is received as a prop and may be used in future API calls
  void gymId;

  const fileRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditId(null); setForm(emptyForm); setImageUrl(''); setStoragePath(''); setShowForm(true);
  };
  const openEdit = (p: GymPartner) => {
    setEditId(p.id); setForm({ name: p.name });
    setImageUrl(p.image_url ?? ''); setStoragePath(p.storage_path ?? ''); setShowForm(true);
  };
  const cancel = () => {
    setShowForm(false); setEditId(null); setForm(emptyForm); setImageUrl(''); setStoragePath('');
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error(t('partners.imageSizeError')); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'partner-logos');
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error(t('partners.uploadFailedMessage', { error: data.error ?? tc('somethingWrong') })); return; }
      setImageUrl(data.url);
      setStoragePath(data.path ?? '');
      toast.success(t('partners.logoUploaded'));
    } catch { toast.error(t('partners.uploadFailed')); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error(t('partners.nameRequired')); return; }
    setSaving(true);
    try {
      const isEdit = !!editId;
      const res = await fetch(isEdit ? `/api/content/partners/${editId}` : '/api/content/partners', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), image_url: imageUrl || null, storage_path: storagePath || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tc('somethingWrong')); return; }
      setPartners(prev => isEdit ? prev.map(p => p.id === editId ? data : p) : [...prev, data]);
      toast.success(isEdit ? t('partners.partnerUpdated') : t('partners.partnerAdded'));
      cancel();
    } catch { toast.error(tc('networkError')); }
    finally { setSaving(false); }
  };

  const toggleVisible = async (p: GymPartner) => {
    setTogglingId(p.id);
    try {
      const res = await fetch(`/api/content/partners/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_visible: !p.is_visible }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? tc('somethingWrong')); return; }
      setPartners(prev => prev.map(x => x.id === p.id ? data : x));
      toast.success(p.is_visible ? t('partners.partnerHidden') : t('partners.partnerVisible'));
    } catch { toast.error(tc('networkError')); }
    finally { setTogglingId(null); }
  };

  const deletePartner = async (p: GymPartner) => {
    if (!confirm(t('partners.deleteConfirm', { name: p.name }))) return;
    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/content/partners/${p.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(tc('somethingWrong')); return; }
      setPartners(prev => prev.filter(x => x.id !== p.id));
      toast.success(t('partners.partnerRemoved'));
    } catch { toast.error(tc('networkError')); }
    finally { setDeletingId(null); }
  };

  const countLabel = partners.length === 1
    ? t('partners.countSingular', { count: partners.length })
    : t('partners.countPlural', { count: partners.length });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">{countLabel}</p>
        {can(permissions, 'content', 'create') && (
          <Button variant="primary" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>{t('partners.addPartner')}</Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-surface-2 border border-brand/40 rounded-xl p-5 space-y-4">
          <p className="text-sm font-medium text-fg">{editId ? t('partners.editPartner') : t('partners.newPartner')}</p>
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('partners.nameLabel')} <span className="text-danger">*</span></label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder={t('partners.namePlaceholder')} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('partners.logoLabel')}</label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-line bg-surface flex items-center justify-center overflow-hidden p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                </div>
                <button type="button" onClick={() => { setImageUrl(''); setStoragePath(''); }}
                  className="text-xs text-fg-muted hover:text-danger transition-colors">{t('partners.remove')}</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-line text-fg-muted hover:text-fg hover:border-brand rounded-lg text-sm transition-colors disabled:opacity-50">
                <Upload className="w-4 h-4" aria-hidden />
                {uploading ? t('partners.uploading') : t('partners.uploadLogo')}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={cancel}>{tc('cancel')}</Button>
            <Button variant="primary" fullWidth onClick={save} disabled={uploading} isLoading={saving} leftIcon={<Check className="w-3.5 h-3.5" />}>{tc('save')}</Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {partners.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <Handshake className="w-10 h-10 text-fg-faint mx-auto mb-3" />
          <p className="text-sm text-fg-muted">{t('partners.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {partners.map(p => (
            <div key={p.id}
              className={`bg-surface-2 border border-line rounded-xl overflow-hidden transition-opacity ${!p.is_visible ? 'opacity-50' : ''}`}>
              <div className="w-full h-28 bg-surface flex items-center justify-center p-3">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <Handshake className="w-8 h-8 text-fg-faint" />
                )}
              </div>
              <div className="px-3 py-2 border-t border-line flex items-center gap-2">
                <p className="text-xs font-medium text-fg truncate flex-1">{p.name}</p>
                {can(permissions, 'content', 'edit') && (
                  <button onClick={() => openEdit(p)} aria-label={tc('edit')}
                    className="p-1 rounded text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {can(permissions, 'content', 'edit') && (
                  <button onClick={() => toggleVisible(p)} disabled={togglingId === p.id}
                    aria-label={p.is_visible ? 'Hide partner' : 'Show partner'}
                    className="p-1 rounded text-fg-faint hover:text-fg hover:bg-surface-3 transition-colors">
                    {p.is_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                )}
                {can(permissions, 'content', 'delete') && (
                  <button onClick={() => deletePartner(p)} disabled={deletingId === p.id}
                    aria-label={tc('delete')}
                    className="p-1 rounded text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors">
                    {deletingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
