'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Layers, Plus, Trash2, Upload, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymProgram } from '@/app/dashboard/services/page';

interface Props {
  program?: GymProgram;
  gymId: string;
  onClose: () => void;
  onSaved: (program: GymProgram) => void;
}

const LEVEL_PRESETS = ['Beginner friendly', 'All levels', 'Intermediate', 'Advanced'];
const CATEGORY_PRESETS = ['Boxing', 'HIIT', 'Yoga', 'Strength', 'Cardio', 'Pilates', 'Cycling', 'CrossFit', 'Functional'];
const FOCUS_PRESETS = ['Cardio conditioning', 'Core strength', 'Strength building', 'Flexibility', 'Fat loss', 'Muscle gain', 'Mobility', 'Mental resilience', 'Footwork & movement', 'Technique'];

const inputCls = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand transition-colors';
const labelCls = 'block text-xs font-medium text-fg-muted mb-1.5';

export default function ProgramModal({ program, gymId, onClose, onSaved }: Props) {
  const isEdit = !!program;

  const [title, setTitle]                     = useState(program?.title ?? '');
  const [description, setDescription]         = useState(program?.description ?? '');
  const [imageUrl, setImageUrl]               = useState(program?.image_url ?? '');
  const [storagePath, setStoragePath]         = useState(program?.storage_path ?? '');
  const [price, setPrice]                     = useState<string>(program?.price?.toString() ?? '');
  const [durationWeeks, setDurationWeeks]     = useState<string>(program?.duration_weeks?.toString() ?? '');
  const [totalSessions, setTotalSessions]     = useState<string>(program?.total_sessions?.toString() ?? '');
  const [sessionMinutes, setSessionMinutes]   = useState<string>(program?.session_duration_minutes?.toString() ?? '');
  const [level, setLevel]                     = useState(program?.level ?? '');
  const [category, setCategory]               = useState(program?.category ?? '');
  const [trainerName, setTrainerName]         = useState(program?.trainer_name ?? '');
  const [scheduleText, setScheduleText]       = useState(program?.schedule_text ?? '');
  const [focusAreas, setFocusAreas]           = useState<string[]>(program?.focus_areas ?? []);
  const [focusInput, setFocusInput]           = useState('');
  const [displayOrder, setDisplayOrder]       = useState<string>(program?.display_order?.toString() ?? '0');
  const [status, setStatus]                   = useState<'draft' | 'published'>(program?.status ?? 'draft');
  const [saving, setSaving]                   = useState(false);
  const [uploading, setUploading]             = useState(false);
  const [trainers, setTrainers]               = useState<{ id: string; name: string }[]>([]);

  const fileRef     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/trainers')
      .then(r => r.json())
      .then(d => setTrainers(d.trainers ?? []))
      .catch(() => {});
  }, []);
  const focusRef    = useRef<HTMLInputElement>(null);

  // ── Focus areas ─────────────────────────────────────────────────────────

  const addFocusArea = (val?: string) => {
    const v = (val ?? focusInput).trim();
    if (!v || focusAreas.includes(v)) return;
    setFocusAreas(prev => [...prev, v]);
    setFocusInput('');
    focusRef.current?.focus();
  };

  const removeFocusArea = (i: number) =>
    setFocusAreas(prev => prev.filter((_, idx) => idx !== i));

  // ── Image upload ─────────────────────────────────────────────────────────

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) { toast.error('Only JPEG, PNG, WebP or GIF allowed'); return; }
    if (file.size > 5 * 1024 * 1024)  { toast.error('Image must be under 5 MB'); return; }

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
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl || null,
      storage_path: storagePath || null,
      price: price ? parseFloat(price) : null,
      duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
      total_sessions: totalSessions ? parseInt(totalSessions) : null,
      session_duration_minutes: sessionMinutes ? parseInt(sessionMinutes) : null,
      level: level.trim() || null,
      category: category.trim() || null,
      trainer_name: trainerName.trim() || null,
      schedule_text: scheduleText.trim() || null,
      focus_areas: focusAreas,
      display_order: parseInt(displayOrder) || 0,
      status,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/programs/${program.id}` : '/api/programs',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Failed to save program'); return; }
      toast.success(isEdit ? 'Program updated' : 'Program created');
      onSaved(json as GymProgram);
      onClose();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-brand" />
            </div>
            <h2 className="text-base font-semibold text-fg">
              {isEdit ? 'Edit Program' : 'New Program'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-fg-faint hover:text-fg hover:bg-surface-3 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form id="program-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'draft',     label: 'Draft',     hint: 'Not visible on mobile' },
                { value: 'published', label: 'Published', hint: 'Visible in Explore feed' },
              ] as const).map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    status === s.value
                      ? 'border-brand bg-brand/10'
                      : 'border-line hover:border-line'
                  }`}
                >
                  <span className="text-sm font-medium text-fg">{s.label}</span>
                  <span className="text-xs text-fg-muted mt-0.5">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label className={labelCls}>Cover Image</label>
            {imageUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-surface border border-line">
                <img src={imageUrl} alt="Cover" className="w-full h-44 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <button type="button"
                  onClick={() => { setImageUrl(''); setStoragePath(''); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg text-fg transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 disabled:opacity-50 text-fg text-xs rounded-lg transition-colors">
                  <Upload className="w-3 h-3" />
                  {uploading ? 'Uploading…' : 'Replace'}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-2 h-36 bg-surface border border-dashed border-line hover:border-brand rounded-xl text-fg-faint hover:text-brand disabled:opacity-50 transition-colors">
                {uploading ? <span className="text-sm">Uploading…</span> : (
                  <>
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-sm">Click to upload cover image</span>
                    <span className="text-xs text-fg-faint">JPEG, PNG, WebP · max 5 MB</span>
                  </>
                )}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageChange} />
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Title <span className="text-red-400">*</span></label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Fight Camp" maxLength={120} required />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls.replace('mb-1.5', '')}>Description</label>
              <span className={`text-xs ${description.length > 600 ? 'text-red-400' : 'text-fg-faint'}`}>
                {description.length}/600
              </span>
            </div>
            <textarea className={`${inputCls} resize-none`} rows={4} value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Shown on the program detail screen" maxLength={600} />
          </div>

          {/* Price */}
          <div>
            <label className={labelCls}>Programme Price (EGP)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-faint">EGP</span>
              <input
                className={`${inputCls} pl-12`}
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 2400"
              />
            </div>
          </div>

          {/* Duration · Sessions · Min/class */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Duration (weeks)</label>
              <input className={inputCls} type="number" min={1} max={52} value={durationWeeks}
                onChange={e => setDurationWeeks(e.target.value)} placeholder="e.g. 8" />
            </div>
            <div>
              <label className={labelCls}>Total Sessions</label>
              <input className={inputCls} type="number" min={1} value={totalSessions}
                onChange={e => setTotalSessions(e.target.value)} placeholder="e.g. 24" />
            </div>
            <div>
              <label className={labelCls}>Min / Class</label>
              <input className={inputCls} type="number" min={1} value={sessionMinutes}
                onChange={e => setSessionMinutes(e.target.value)} placeholder="e.g. 90" />
            </div>
          </div>

          {/* Level */}
          <div>
            <label className={labelCls}>Level</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {LEVEL_PRESETS.map(l => (
                <button key={l} type="button" onClick={() => setLevel(level === l ? '' : l)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    level === l ? 'border-brand bg-brand/20 text-brand' : 'border-line text-fg-muted hover:border-gray-500'
                  }`}>{l}</button>
              ))}
            </div>
            <input className={inputCls} value={level} onChange={e => setLevel(e.target.value)}
              placeholder="Or type a custom level" />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CATEGORY_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setCategory(category === c ? '' : c)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    category === c ? 'border-brand bg-brand/20 text-brand' : 'border-line text-fg-muted hover:border-gray-500'
                  }`}>{c}</button>
              ))}
            </div>
            <input className={inputCls} value={category} onChange={e => setCategory(e.target.value)}
              placeholder="Or type a custom category" />
          </div>

          {/* Trainer + Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Lead Trainer</label>
              <select
                className={inputCls}
                value={trainerName}
                onChange={e => setTrainerName(e.target.value)}
              >
                <option value="">— No trainer —</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Schedule</label>
              <input className={inputCls} value={scheduleText} onChange={e => setScheduleText(e.target.value)}
                placeholder="e.g. Mon / Wed / Fri" />
            </div>
          </div>

          {/* Focus areas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls.replace('mb-1.5', '')}>What You&apos;ll Work On</label>
              <span className="text-xs text-fg-faint">{focusAreas.length} areas</span>
            </div>
            {/* Presets */}
            <div className="flex flex-wrap gap-2 mb-2">
              {FOCUS_PRESETS.filter(f => !focusAreas.includes(f)).map(f => (
                <button key={f} type="button" onClick={() => addFocusArea(f)}
                  className="px-2.5 py-1 rounded-lg border border-dashed border-line text-xs text-fg-faint hover:border-brand hover:text-brand transition-colors">
                  + {f}
                </button>
              ))}
            </div>
            {/* Tags */}
            {focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {focusAreas.map((area, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-3 rounded-lg text-xs text-fg">
                    {area}
                    <button type="button" onClick={() => removeFocusArea(i)} className="text-fg-faint hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Custom input */}
            <div className="flex gap-2">
              <input ref={focusRef} className={`${inputCls} flex-1`} value={focusInput}
                onChange={e => setFocusInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFocusArea(); } }}
                placeholder="Add a focus area and press Enter" />
              <button type="button" onClick={() => addFocusArea()} disabled={!focusInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-surface-3 hover:bg-surface-4 disabled:opacity-40 text-fg text-sm rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Display order */}
          <div>
            <label className={labelCls}>Display Order</label>
            <input className={inputCls} type="number" min={0} value={displayOrder}
              onChange={e => setDisplayOrder(e.target.value)}
              placeholder="0 = first" />
            <p className="text-xs text-fg-faint mt-1">Lower number = shown first in the Explore feed.</p>
          </div>

        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-3 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" form="program-form" disabled={saving || uploading}
            className="px-5 py-2 bg-brand hover:bg-brand disabled:opacity-50 text-brand-ink text-sm font-medium rounded-lg transition-colors">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Program'}
          </button>
        </div>
      </div>
    </div>
  );
}
