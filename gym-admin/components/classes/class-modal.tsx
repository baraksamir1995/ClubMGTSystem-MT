'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Dumbbell, ImagePlus, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymClass } from '@/app/dashboard/classes/page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';

export interface StaffMember {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
}

interface TrainerOption {
  id: string;
  name: string;
  branch_ids: string[];
}

interface Props {
  existing?: GymClass;
  branches: GymBranch[];
  defaultBranchId?: string;
  onClose: () => void;
  onSaved: (c: GymClass) => void;
}

const COLORS = ['#7c3aed','#2563eb','#dc2626','#d97706','#059669','#db2777','#0891b2','#65a30d'];

export default function ClassModal({ existing, branches, defaultBranchId, onClose, onSaved }: Props) {
  const [name, setName]               = useState(existing?.name ?? '');
  const [classType, setClassType]     = useState(existing?.class_type ?? '');
  const [location, setLocation]       = useState(existing?.location ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [color, setColor]             = useState(existing?.color ?? '#7c3aed');
  const [imageUrl, setImageUrl]       = useState<string | null>(existing?.image_url ?? null);
  const [uploading, setUploading]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [classTypes, setClassTypes]   = useState<{ id: string; name: string }[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [addingType, setAddingType]   = useState(false);
  const [allTrainers, setAllTrainers] = useState<TrainerOption[]>([]);
  const [trainerId, setTrainerId]     = useState<string | null>(existing?.trainer_id ?? null);
  // Branch: auto-select for single-branch gyms, pre-fill from prop for multi-branch
  const [branchId, setBranchId]       = useState<string>(
    existing?.branch_id ?? defaultBranchId ?? (branches.length === 1 ? branches[0].id : '')
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trainers visible for the currently selected branch (only filter when multi-branch).
  // Trainers with no branch assignment (branch_ids=[]) are shown in all branches as a fallback.
  const visibleTrainers = (branches.length > 1 && branchId)
    ? allTrainers.filter(t => t.branch_ids.length === 0 || t.branch_ids.includes(branchId))
    : allTrainers;


  useEffect(() => {
    fetch('/api/class-types')
      .then(r => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        setClassTypes(data);
        if (!existing?.class_type && data.length > 0) setClassType(data[0].name);
      })
      .catch(() => {});

    // Fetch all trainers with branch_ids for client-side filtering
    fetch('/api/trainers')
      .then(r => r.json())
      .then((data: any) => {
        if (Array.isArray(data?.trainers)) {
          setAllTrainers(
            data.trainers
              .filter((t: any) => t.is_active !== false)
              .map((t: any) => ({ id: t.id, name: t.name, branch_ids: t.branch_ids ?? [] }))
          );
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset trainer when branch changes and selected trainer is not in new branch (multi-branch only)
  useEffect(() => {
    if (branches.length > 1 && trainerId && branchId) {
      const trainer = allTrainers.find(t => t.id === trainerId);
      if (trainer && !trainer.branch_ids.includes(branchId)) {
        setTrainerId(null);
      }
    }
  }, [branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddType = async () => {
    const name = newTypeName.trim().toLowerCase();
    if (!name) return;
    setAddingType(true);
    try {
      const res = await fetch('/api/class-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to add type'); return; }
      setClassTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setClassType(data.name);
      setNewTypeName('');
    } catch { toast.error('Network error'); }
    finally { setAddingType(false); }
  };

  const handleDeleteType = async (id: string, typeName: string) => {
    const res = await fetch(`/api/class-types/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete type'); return; }
    setClassTypes(prev => prev.filter(t => t.id !== id));
    if (classType === typeName) setClassType(classTypes.find(t => t.id !== id)?.name ?? '');
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/classes/image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return; }
      setImageUrl(data.url);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Class name is required'); return; }
    if (branches.length > 1 && !branchId) { toast.error('Please select a branch'); return; }
    setSaving(true);
    try {
      const selectedTrainer = allTrainers.find(t => t.id === trainerId) ?? null;
      const body = {
        name: name.trim(),
        classType,
        instructor: selectedTrainer?.name ?? null,
        trainerId: trainerId ?? null,
        location: location.trim() || null,
        description: description.trim() || null,
        color,
        imageUrl: imageUrl ?? null,
        branchId: branchId || null,
      };
      const res = await fetch(existing ? `/api/classes/${existing.id}` : '/api/classes', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }
      toast.success(existing ? 'Class updated' : 'Class created');
      onSaved({
        ...(existing ?? { id: data.id, is_active: true, created_at: new Date().toISOString() }),
        name: name.trim(), class_type: classType,
        instructor: selectedTrainer?.name ?? null,
        trainer_id: trainerId ?? null,
        location: location.trim() || null,
        description: description.trim() || null,
        color,
        image_url: imageUrl ?? null,
        branch_id: branchId || null,
      } as GymClass);
      onClose();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><Dumbbell className="w-4 h-4 text-brand" /> {existing ? 'Edit Class' : 'New Class'}</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Branch (multi-branch only — first field) */}
        {branches.length > 1 && (
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">Branch <span className="text-danger">*</span></label>
            <Select value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">Select branch…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">Class Name <span className="text-danger">*</span></label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Yoga" />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">Class Type</label>
          <div className="flex flex-wrap gap-2">
            {classTypes.map(t => (
              <div key={t.id} className={`group flex items-center gap-1 rounded-lg text-xs font-medium capitalize transition-colors ${classType === t.name ? 'bg-brand text-brand-ink' : 'bg-surface-3 text-fg-muted'}`}>
                <button onClick={() => setClassType(t.name)} className="px-3 py-1.5">{t.name}</button>
                <button onClick={() => handleDeleteType(t.id, t.name)}
                  className="pr-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {/* Inline add */}
            <div className="flex items-center gap-1">
              <input
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddType()}
                placeholder="New type…"
                className="w-24 bg-surface border border-line rounded-lg px-2 py-1.5 text-xs text-fg placeholder-fg-faint focus:outline-none focus:border-brand"
              />
              <button onClick={handleAddType} disabled={addingType || !newTypeName.trim()}
                className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted disabled:opacity-40 transition-colors">
                {addingType ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Specialist / Trainer — filtered by branch */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">Specialist</label>
          <Select value={trainerId ?? ''} onChange={e => setTrainerId(e.target.value || null)}>
            <option value="">No specialist assigned</option>
            {visibleTrainers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">Location / Room</label>
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Studio A" />
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface-2 scale-110' : 'opacity-70 hover:opacity-100'}`} />
            ))}
          </div>
        </div>

        {/* Image */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">
            Class Image
            <span className="ml-2 text-fg-faint font-normal">Recommended: 800×500 px · JPG/PNG/WEBP · max 2 MB</span>
          </label>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
          {imageUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-line" style={{ height: 120 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Class" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-end justify-between p-2 bg-gradient-to-t from-black/60 to-transparent">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-white bg-black/50 hover:bg-black/70 px-2 py-1 rounded-md transition-colors">
                  Change
                </button>
                <button type="button" onClick={() => setImageUrl(null)}
                  className="text-xs text-danger bg-black/50 hover:bg-black/70 px-2 py-1 rounded-md transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-line hover:border-brand text-fg-muted hover:text-brand transition-colors disabled:opacity-50">
              {uploading
                ? <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs">Uploading…</span></>
                : <><ImagePlus className="w-5 h-5" /><span className="text-xs">Click to upload image</span></>}
            </button>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">Description</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={3} placeholder="Optional description..." className="resize-none" />
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={!name.trim()} isLoading={saving}>
          {existing ? 'Save Changes' : 'Create Class'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
