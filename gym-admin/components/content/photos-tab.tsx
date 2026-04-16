'use client';

import { useState, useRef } from 'react';
import { Eye, EyeOff, Trash2, Loader2, Upload, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymPhoto } from '@/app/dashboard/content/page';
import { can, type Permission } from '@/lib/get-permissions';

interface Props { initialPhotos: GymPhoto[]; permissions: Permission[] | null }

export default function PhotosTab({ initialPhotos, permissions }: Props) {
  const [photos,     setPhotos]     = useState<GymPhoto[]>(initialPhotos);
  const [uploading,  setUploading]  = useState(false);
  const [caption,    setCaption]    = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('caption', caption);
      const res = await fetch('/api/content/photos', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return; }
      setPhotos(prev => [...prev, data.photo]);
      setCaption('');
      toast.success('Photo uploaded');
    } catch { toast.error('Network error'); }
    finally { setUploading(false); }
  };

  const toggleVisible = async (photo: GymPhoto) => {
    setTogglingId(photo.id);
    try {
      const res = await fetch(`/api/content/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: !photo.is_visible }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setPhotos(prev => prev.map(p => p.id === photo.id ? data.photo : p));
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

  const deletePhoto = async (photo: GymPhoto) => {
    if (!confirm('Delete this photo?')) return;
    setDeletingId(photo.id);
    try {
      const res = await fetch(`/api/content/photos/${photo.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      toast.success('Photo deleted');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      {/* Upload */}
      {can(permissions, 'content', 'create') && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-white">Upload New Photo</p>
          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              : <><Upload className="w-4 h-4" /> Choose & Upload Photo</>}
          </button>
        </div>
      )}

      {/* Gallery Grid */}
      {photos.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <ImageIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No photos uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map(photo => (
            <div key={photo.id}
              className={`relative group rounded-xl overflow-hidden border border-gray-700 ${
                !photo.is_visible ? 'opacity-50' : ''
              }`}>
              <img src={photo.url} alt={photo.caption ?? ''}
                className="w-full h-36 object-cover" />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {can(permissions, 'content', 'edit') && (
                  <button
                    onClick={() => toggleVisible(photo)}
                    disabled={togglingId === photo.id}
                    title={photo.is_visible ? 'Hide' : 'Show'}
                    className="p-1.5 rounded-lg bg-gray-600/60 hover:bg-gray-600 text-white transition-colors">
                    {photo.is_visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
                {can(permissions, 'content', 'delete') && (
                  <button
                    onClick={() => deletePhoto(photo)}
                    disabled={deletingId === photo.id}
                    title="Delete"
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors">
                    {deletingId === photo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {/* Badges */}
              {!photo.is_visible && (
                <div className="absolute top-2 left-2">
                  <span className="text-xs bg-gray-800/90 text-gray-400 px-1.5 py-0.5 rounded-full">Hidden</span>
                </div>
              )}
              {photo.caption && (
                <div className="px-2.5 py-2 bg-gray-900/80 backdrop-blur-sm">
                  <p className="text-xs text-gray-300 truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
