'use client';

import { useState, useRef } from 'react';
import { X, Loader2, Camera, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymBranch } from '@/app/dashboard/branches/page';

export interface TrainerProfile {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  specialisations: string[];
  trainer_type: 'personal_trainer' | 'nutritionist' | 'physiotherapist';
  is_active: boolean;
  upcoming_sessions: number;
  branch_ids: string[];  // defaults to [] if table not yet migrated
}

interface Props {
  existing?: TrainerProfile;
  defaultType?: TrainerProfile['trainer_type'];
  branches: GymBranch[];
  onClose: () => void;
  onSaved: (trainer: TrainerProfile) => void;
}

export default function TrainerModal({ existing, defaultType, branches = [], onClose, onSaved }: Props) {
  const [name,            setName]            = useState(existing?.name ?? '');
  const [bio,             setBio]             = useState(existing?.bio ?? '');
  const [specialisations, setSpecialisations] = useState<string[]>(existing?.specialisations ?? []);
  const [trainerType,     setTrainerType]     = useState<TrainerProfile['trainer_type']>(existing?.trainer_type ?? defaultType ?? 'personal_trainer');
  const [tagInput,        setTagInput]        = useState('');
  const [photoUrl,        setPhotoUrl]        = useState(existing?.photo_url ?? '');
  const [photoPreview,    setPhotoPreview]    = useState(existing?.photo_url ?? '');
  const [uploadingPhoto,  setUploadingPhoto]  = useState(false);
  const [saving,          setSaving]          = useState(false);
  // Branch assignment — auto-select single branch if gym has only one
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(
    (existing?.branch_ids ?? []).length > 0
      ? (existing!.branch_ids ?? [])
      : branches.length === 1 ? [branches[0].id] : []
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleBranch = (id: string) => {
    setSelectedBranchIds(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to server
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/trainers/photo', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Photo upload failed'); return; }
      setPhotoUrl(data.url);
    } catch { toast.error('Photo upload failed'); }
    finally { setUploadingPhoto(false); }
  };

  const addTag = (value: string) => {
    const tag = value.trim();
    if (tag && !specialisations.includes(tag)) {
      setSpecialisations(prev => [...prev, tag]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput) {
      setSpecialisations(prev => prev.slice(0, -1));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (uploadingPhoto) { toast.error('Photo still uploading, please wait'); return; }
    if (branches.length > 1 && selectedBranchIds.length === 0) {
      toast.error('Select at least one branch');
      return;
    }

    setSaving(true);
    try {
      const body = {
        name:            name.trim(),
        photoUrl:        photoUrl || null,
        bio:             bio.trim() || null,
        specialisations,
        trainerType:     trainerType,
        isActive:        existing?.is_active ?? true,
        branchIds:       selectedBranchIds,
      };

      const res = existing
        ? await fetch(`/api/trainers/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/trainers',                { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }

      toast.success(existing ? 'Trainer updated' : 'Trainer added');
      onSaved({
        ...(existing ?? { upcoming_sessions: 0 }),
        id:              existing?.id ?? data.id,
        name:            name.trim(),
        photo_url:       photoUrl || null,
        bio:             bio.trim() || null,
        specialisations,
        trainer_type:    trainerType,
        is_active:       existing?.is_active ?? true,
        branch_ids:      selectedBranchIds,
      } as TrainerProfile);
      onClose();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const inp = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{existing ? 'Edit Trainer' : 'Add Trainer'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => fileRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-gray-700 border-2 border-dashed border-gray-600 hover:border-purple-500 cursor-pointer overflow-hidden flex items-center justify-center group transition-colors">
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-purple-400 transition-colors">
                  {uploadingPhoto
                    ? <Loader2 className="w-6 h-6 animate-spin" />
                    : <Camera className="w-6 h-6" />}
                  <span className="text-xs">Photo</span>
                </div>
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">Click to upload photo</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Trainer name" className={inp} />
          </div>

          {/* Trainer Type */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Type <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              {([
                ['personal_trainer', 'Personal Trainer'],
                ['nutritionist',     'Nutritionist'],
                ['physiotherapist',  'Physiotherapist'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTrainerType(val)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    trainerType === val
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Bio <span className="text-gray-600">(optional)</span></label>
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              rows={3} placeholder="Short trainer bio…"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none" />
          </div>

          {/* Specialisations */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Specialisations <span className="text-gray-600">(optional)</span></label>
            <div className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 focus-within:border-purple-500 transition-colors min-h-[42px] flex flex-wrap gap-1.5">
              {specialisations.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-purple-600/20 border border-purple-600/30 text-purple-300 text-xs px-2 py-0.5 rounded-full">
                  {tag}
                  <button onClick={() => setSpecialisations(prev => prev.filter(t => t !== tag))}
                    className="hover:text-white transition-colors">×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
                placeholder={specialisations.length === 0 ? 'e.g. Boxing, HIIT, Yoga — press Enter' : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-gray-500 outline-none" />
            </div>
            <p className="text-xs text-gray-600 mt-1">Press Enter or comma to add</p>
          </div>

          {/* Branch assignment (multi-branch gyms only) */}
          {branches.length > 1 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Branches <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-col gap-2">
                {branches.map(b => (
                  <label key={b.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedBranchIds.includes(b.id)}
                      onChange={() => toggleBranch(b.id)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                      selectedBranchIds.includes(b.id)
                        ? 'bg-purple-600 border-purple-600'
                        : 'border-gray-500 group-hover:border-purple-500'
                    }`}>
                      {selectedBranchIds.includes(b.id) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{b.name}</span>
                  </label>
                ))}
              </div>
              {selectedBranchIds.length === 0 && (
                <p className="text-xs text-red-400 mt-1.5">Select at least one branch</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || uploadingPhoto}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : (existing ? 'Save Changes' : 'Add Trainer')}
          </button>
        </div>
      </div>
    </div>
  );
}
