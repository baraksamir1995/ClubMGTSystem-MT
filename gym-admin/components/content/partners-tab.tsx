'use client';

import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Check, Upload, Handshake } from 'lucide-react';
import toast from 'react-hot-toast';
import { can, type Permission } from '@/lib/get-permissions';

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
const inp = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

export default function PartnersTab({ initialPartners, permissions, gymId }: Props) {
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
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'partner-logos');
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error('Upload failed: ' + (data.error ?? 'Unknown error')); return; }
      setImageUrl(data.url);
      setStoragePath(data.path ?? '');
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const isEdit = !!editId;
      const res = await fetch(isEdit ? `/api/content/partners/${editId}` : '/api/content/partners', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), image_url: imageUrl || null, storage_path: storagePath || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setPartners(prev => isEdit ? prev.map(p => p.id === editId ? data : p) : [...prev, data]);
      toast.success(isEdit ? 'Partner updated' : 'Partner added');
      cancel();
    } catch { toast.error('Network error'); }
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
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setPartners(prev => prev.map(x => x.id === p.id ? data : x));
      toast.success(p.is_visible ? 'Partner hidden' : 'Partner visible');
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

  const deletePartner = async (p: GymPartner) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/content/partners/${p.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setPartners(prev => prev.filter(x => x.id !== p.id));
      toast.success('Partner removed');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{partners.length} partner{partners.length !== 1 ? 's' : ''}</p>
        {can(permissions, 'content', 'create') && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Partner
          </button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-gray-800 border border-purple-600/40 rounded-xl p-5 space-y-4">
          <p className="text-sm font-medium text-white">{editId ? 'Edit Partner' : 'New Partner'}</p>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Nike, Protein World" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Logo</label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-gray-700 bg-gray-900 flex items-center justify-center overflow-hidden p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                </div>
                <button type="button" onClick={() => { setImageUrl(''); setStoragePath(''); }}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors">Remove</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-purple-500 rounded-lg text-sm transition-colors disabled:opacity-50">
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading…' : 'Upload logo'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
          <div className="flex gap-2">
            <button onClick={cancel}
              className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving || uploading}
              className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Check className="w-3.5 h-3.5" /> Save</>}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {partners.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <Handshake className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No partners yet. Add your first partner.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {partners.map(p => (
            <div key={p.id}
              className={`bg-gray-800 border border-gray-700 rounded-xl overflow-hidden transition-opacity ${!p.is_visible ? 'opacity-50' : ''}`}>
              <div className="w-full h-28 bg-gray-900 flex items-center justify-center p-3">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <Handshake className="w-8 h-8 text-gray-600" />
                )}
              </div>
              <div className="px-3 py-2 border-t border-gray-700 flex items-center gap-2">
                <p className="text-xs font-medium text-white truncate flex-1">{p.name}</p>
                {can(permissions, 'content', 'edit') && (
                  <button onClick={() => openEdit(p)}
                    className="p-1 rounded text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {can(permissions, 'content', 'edit') && (
                  <button onClick={() => toggleVisible(p)} disabled={togglingId === p.id}
                    className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors">
                    {p.is_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                )}
                {can(permissions, 'content', 'delete') && (
                  <button onClick={() => deletePartner(p)} disabled={deletingId === p.id}
                    className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
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
