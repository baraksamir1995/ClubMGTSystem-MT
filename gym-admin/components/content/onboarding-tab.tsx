'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, GripVertical, Eye, EyeOff, Pencil, X, Check, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { can, type Permission } from '@/lib/get-permissions';

export interface OnboardingSlide {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface Props {
  permissions: Permission[] | null;
}

export default function OnboardingTab({ permissions }: Props) {
  const [slides, setSlides] = useState<OnboardingSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // New slide form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const canCreate = can(permissions, 'content', 'create');
  const canEdit   = can(permissions, 'content', 'edit');
  const canDelete = can(permissions, 'content', 'delete');

  const fetchSlides = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/content/onboarding');
    if (res.ok) {
      const data = await res.json();
      setSlides(data.slides);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSlides(); }, [fetchSlides]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleAdd = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setAdding(true);
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('description', description.trim());
    fd.append('sortOrder', String(slides.length));
    if (file) fd.append('file', file);

    const res = await fetch('/api/content/onboarding', { method: 'POST', body: fd });
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); setAdding(false); return; }
    toast.success('Slide added');
    setTitle(''); setDescription(''); setFile(null); setPreview(null); setShowForm(false);
    setAdding(false);
    fetchSlides();
  };

  const handleToggle = async (slide: OnboardingSlide) => {
    const fd = new FormData();
    fd.append('isActive', String(!slide.is_active));
    const res = await fetch(`/api/content/onboarding/${slide.id}`, { method: 'PATCH', body: fd });
    if (!res.ok) { toast.error('Failed to toggle'); return; }
    setSlides(prev => prev.map(s => s.id === slide.id ? { ...s, is_active: !s.is_active } : s));
  };

  const handleDelete = async (slide: OnboardingSlide) => {
    if (!confirm(`Delete slide "${slide.title}"?`)) return;
    const res = await fetch(`/api/content/onboarding/${slide.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    toast.success('Slide deleted');
    fetchSlides();
  };

  const handleEditSave = async (id: string) => {
    const fd = new FormData();
    fd.append('title', editTitle.trim());
    fd.append('description', editDesc.trim());
    const res = await fetch(`/api/content/onboarding/${id}`, { method: 'PATCH', body: fd });
    if (!res.ok) { toast.error('Failed to update'); return; }
    toast.success('Slide updated');
    setEditId(null);
    fetchSlides();
  };

  const handleImageReplace = async (id: string, newFile: File) => {
    const fd = new FormData();
    fd.append('file', newFile);
    const res = await fetch(`/api/content/onboarding/${id}`, { method: 'PATCH', body: fd });
    if (!res.ok) { toast.error('Failed to update image'); return; }
    toast.success('Image updated');
    fetchSlides();
  };

  const inp = 'bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 w-full';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">
            Customize the onboarding screens members see when they first open the app.
            {slides.length === 0 && ' Default screens will be shown until you add custom ones.'}
          </p>
        </div>
        {canCreate && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Slide
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">New Onboarding Slide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Title *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Access Your Gym, Your Way" className={inp} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Short description for this slide..." rows={3} className={inp} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Image (optional)</label>
              <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange} className="hidden" />
              {preview ? (
                <div className="relative group">
                  <img src={preview} alt="Preview" className="w-full h-40 object-cover rounded-lg border border-gray-700" />
                  <button onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-400 hover:border-gray-600 transition-colors">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-xs">Click to upload</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setTitle(''); setDescription(''); setFile(null); setPreview(null); }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={adding}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
              {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Slide
            </button>
          </div>
        </div>
      )}

      {/* Slides list */}
      {slides.length === 0 && !showForm ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <ImageIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No custom onboarding slides yet</p>
          <p className="text-xs text-gray-500 mt-1">Default slides will be shown to members</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, idx) => (
            <div key={slide.id}
              className={`bg-gray-800 border rounded-xl overflow-hidden transition-colors ${
                slide.is_active ? 'border-gray-700' : 'border-gray-700/50 opacity-60'
              }`}>
              <div className="flex items-stretch">
                {/* Image thumbnail */}
                <div className="w-32 h-28 flex-shrink-0 bg-gray-900 flex items-center justify-center">
                  {slide.image_url ? (
                    <div className="relative group w-full h-full">
                      <img src={slide.image_url} alt={slide.title}
                        className="w-full h-full object-cover" />
                      {canEdit && (
                        <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                          <Pencil className="w-5 h-5 text-white" />
                          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleImageReplace(slide.id, e.target.files[0]); }} />
                        </label>
                      )}
                    </div>
                  ) : (
                    canEdit ? (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-gray-600 hover:text-gray-500 transition-colors">
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-xs mt-1">Add image</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                          onChange={e => { if (e.target.files?.[0]) handleImageReplace(slide.id, e.target.files[0]); }} />
                      </label>
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-700" />
                    )
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-4 min-w-0">
                  {editId === slide.id ? (
                    <div className="space-y-2">
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        className={inp} />
                      <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description..." className={inp} />
                      <div className="flex gap-2">
                        <button onClick={() => handleEditSave(slide.id)}
                          className="p-1.5 bg-green-600 rounded-lg text-white"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditId(null)}
                          className="p-1.5 bg-gray-700 rounded-lg text-white"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">#{idx + 1}</span>
                        <h3 className="text-sm font-semibold text-white truncate">{slide.title}</h3>
                        {!slide.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">Hidden</span>
                        )}
                      </div>
                      {slide.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{slide.description}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 pr-3">
                  {canEdit && editId !== slide.id && (
                    <button onClick={() => { setEditId(slide.id); setEditTitle(slide.title); setEditDesc(slide.description ?? ''); }}
                      className="p-2 text-gray-500 hover:text-white transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => handleToggle(slide)}
                      className="p-2 text-gray-500 hover:text-white transition-colors"
                      title={slide.is_active ? 'Hide' : 'Show'}>
                      {slide.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(slide)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
