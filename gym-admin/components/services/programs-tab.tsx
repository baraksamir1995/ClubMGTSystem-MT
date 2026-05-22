'use client';

import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Loader2, ImageIcon, Upload, X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { can, type Permission } from '@/lib/get-permissions';
import type { GymProgram } from '@/app/dashboard/services/page';

interface Props {
  initialPrograms: GymProgram[];
  permissions: Permission[] | null;
  gymId: string;
}

interface ProgramForm {
  title: string;
  description: string;
  duration_weeks: string;
  status: 'draft' | 'published';
}

const emptyForm: ProgramForm = { title: '', description: '', duration_weeks: '', status: 'draft' };

const inp = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand transition-colors';

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-400/10 text-emerald-400',
  draft:     'bg-gray-400/10 text-fg-muted',
};

export default function ProgramsTab({ initialPrograms, permissions, gymId }: Props) {
  const [programs, setPrograms]         = useState<GymProgram[]>(initialPrograms);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [form, setForm]                 = useState<ProgramForm>(emptyForm);
  const [imageUrl, setImageUrl]         = useState('');
  const [storagePath, setStoragePath]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditingId(null); setForm(emptyForm); setImageUrl(''); setStoragePath(''); setModalOpen(true);
  };
  const openEdit = (p: GymProgram) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      description: p.description ?? '',
      duration_weeks: p.duration_weeks?.toString() ?? '',
      status: p.status,
    });
    setImageUrl(p.image_url ?? '');
    setStoragePath(p.storage_path ?? '');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); setImageUrl(''); setStoragePath(''); };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'program-images');
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error('Upload failed: ' + (data.error ?? 'Unknown error')); return; }
      setImageUrl(data.url);
      setStoragePath(data.path ?? '');
      toast.success('Image uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        duration_weeks: form.duration_weeks ? parseInt(form.duration_weeks) : null,
        status: form.status,
        image_url: imageUrl || null,
        storage_path: storagePath || null,
      };
      const res = await fetch(isEdit ? `/api/programs/${editingId}` : '/api/programs', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }
      setPrograms(prev => isEdit
        ? prev.map(p => p.id === editingId ? data : p)
        : [data, ...prev]
      );
      toast.success(isEdit ? 'Program updated' : 'Program created');
      closeModal();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const deleteProgram = async (p: GymProgram) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/programs/${p.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setPrograms(prev => prev.filter(x => x.id !== p.id));
      toast.success('Program deleted');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <>
      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-fg-muted">{programs.length} program{programs.length !== 1 ? 's' : ''}</p>
          {can(permissions, 'services', 'create') && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New Program
            </button>
          )}
        </div>

        {/* List */}
        {programs.length === 0 ? (
          <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
            <Layers className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-sm text-fg-muted">No programs yet. Create your first program.</p>
            {can(permissions, 'services', 'create') && (
              <button onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> Create first program
              </button>
            )}
          </div>
        ) : (
          <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Program</th>
                    <th className="text-left px-5 py-3">Duration</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {programs.map(p => (
                    <tr key={p.id} className="hover:bg-surface-3/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-lg bg-surface-3 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <Layers className="w-5 h-5 text-fg-faint" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-fg truncate">{p.title}</p>
                            {p.description && (
                              <p className="text-xs text-fg-faint mt-0.5 truncate max-w-xs">{p.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-fg-muted whitespace-nowrap">
                        {p.duration_weeks ? `${p.duration_weeks} weeks` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? 'bg-gray-400/10 text-fg-muted'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'services', 'edit') && (
                            <button onClick={() => openEdit(p)} title="Edit"
                              className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {can(permissions, 'services', 'delete') && (
                            <button onClick={() => deleteProgram(p)} disabled={deletingId === p.id} title="Delete"
                              className="p-1.5 rounded-lg text-fg-faint hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40">
                              {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-base font-semibold text-fg">{editingId ? 'Edit Program' : 'New Program'}</h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-fg-faint hover:text-fg hover:bg-surface-3 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['draft', 'published'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        form.status === s ? 'border-brand bg-brand/10' : 'border-line hover:border-line'
                      }`}>
                      <span className="text-sm font-medium text-fg capitalize">{s}</span>
                      <span className="text-xs text-fg-muted block mt-0.5">
                        {s === 'draft' ? 'Not visible on mobile' : 'Visible in Explore feed'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Title <span className="text-red-400">*</span></label>
                <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Fight Camp, Summer Shred" maxLength={120} />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-fg-muted">Description</label>
                  <span className={`text-xs ${form.description.length > 500 ? 'text-red-400' : 'text-fg-faint'}`}>
                    {form.description.length}/500
                  </span>
                </div>
                <textarea className={`${inp} resize-none`} rows={3}
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Boxing · Coach Islam · Mon/Wed/Fri" maxLength={500} />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Duration (weeks)</label>
                <input className={inp} type="number" min="1" max="52"
                  value={form.duration_weeks} onChange={e => setForm(f => ({ ...f, duration_weeks: e.target.value }))}
                  placeholder="e.g. 8" />
              </div>

              {/* Image */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Cover Image</label>
                {imageUrl ? (
                  <div className="relative rounded-xl overflow-hidden bg-surface border border-line">
                    <img src={imageUrl} alt="Preview" className="w-full h-36 object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <button type="button" onClick={() => { setImageUrl(''); setStoragePath(''); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-fg transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-fg text-xs rounded-lg disabled:opacity-50 transition-colors">
                      <Upload className="w-3 h-3" />{uploading ? 'Uploading…' : 'Replace'}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full flex flex-col items-center justify-center gap-2 h-28 bg-surface border border-dashed border-line hover:border-brand rounded-xl text-fg-faint hover:text-brand disabled:opacity-50 transition-colors">
                    {uploading ? <span className="text-sm">Uploading…</span> : (
                      <>
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-sm">Click to upload cover image</span>
                        <span className="text-xs text-fg-faint">JPEG, PNG, WebP · max 5 MB</span>
                      </>
                    )}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line">
              <button type="button" onClick={closeModal}
                className="px-4 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-3 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="button" onClick={save} disabled={saving || uploading}
                className="px-5 py-2 bg-brand hover:bg-brand disabled:opacity-50 text-brand-ink text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Program'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
