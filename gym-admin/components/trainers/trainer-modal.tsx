'use client';

import { useState, useRef } from 'react';
import { Loader2, Camera, Hash, Lock, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { Button, Field, Input, Modal, PasswordInput, Textarea } from '@/components/ui';

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
  // Coachesapp-login bits — populated by /api/trainers when the
  // specialist has a linked profiles row. Older trainer_profiles
  // without a login have `has_login=false` and `username=null`.
  username?: string | null;
  has_login?: boolean;
}

interface Props {
  existing?: TrainerProfile;
  defaultType?: TrainerProfile['trainer_type'];
  branches: GymBranch[];
  onClose: () => void;
  onSaved: (trainer: TrainerProfile) => void;
}

export default function TrainerModal({ existing, defaultType, branches = [], onClose, onSaved }: Props) {
  const isCreate = !existing;
  const [name,            setName]            = useState(existing?.name ?? '');
  const [bio,             setBio]             = useState(existing?.bio ?? '');
  const [specialisations, setSpecialisations] = useState<string[]>(existing?.specialisations ?? []);
  const [trainerType,     setTrainerType]     = useState<TrainerProfile['trainer_type']>(existing?.trainer_type ?? defaultType ?? 'personal_trainer');
  const [tagInput,        setTagInput]        = useState('');
  const [photoUrl,        setPhotoUrl]        = useState(existing?.photo_url ?? '');
  const [photoPreview,    setPhotoPreview]    = useState(existing?.photo_url ?? '');
  const [uploadingPhoto,  setUploadingPhoto]  = useState(false);
  const [saving,          setSaving]          = useState(false);

  // Coachesapp login.
  // - Create mode: Username (optional, auto-assigned if blank) + Password (required).
  // - Edit mode: existing Username (editable input — admin can change it
  //   if not taken) + Password (blank = leave unchanged).
  const existingUsername = existing?.username ?? '';
  const existingHasLogin = existing?.has_login ?? false;
  const [username,        setUsername]        = useState(existingUsername);
  const [password,        setPassword]        = useState('');
  // Controlled visibility so the Generate button can reveal the
  // freshly-generated password (otherwise the admin can't see what
  // they just produced). PasswordInput renders the eye toggle for the
  // user; we drive it from outside via the controlled `visible` prop.
  const [showPw, setShowPw] = useState(false);
  const [createdCreds,    setCreatedCreds]    = useState<{ username: string; password: string } | null>(null);

  const generatePw = () => {
    const digits = '0123456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += digits[Math.floor(Math.random() * digits.length)];
    setPassword(out);
    setShowPw(true);
  };
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
    // Mobile-number-style username (digits only, 4–15). Admin supplies
    // the specialist's mobile; uniqueness is enforced server-side by
    // the partial unique index on profiles.username.
    const mobilePattern = /^[0-9]{4,15}$/;
    if (isCreate) {
      if (!username) { toast.error('Mobile number is required'); return; }
      if (!mobilePattern.test(username)) {
        toast.error('Mobile number must be digits only (4–15)'); return;
      }
      if (!password) { toast.error('Password is required'); return; }
      if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    } else {
      // Edit mode: validate creds only when the admin actually touched
      // them (blank password = no change).
      if (password && password.length < 6) {
        toast.error('New password must be at least 6 characters'); return;
      }
      if (username && username !== existingUsername && !mobilePattern.test(username)) {
        toast.error('Mobile number must be digits only (4–15)'); return;
      }
    }

    setSaving(true);
    try {
      // One endpoint for both create + edit. Camel-case keys; the
      // /api/trainers proxy maps them to snake_case before forwarding.
      const body: Record<string, unknown> = {
        name:            name.trim(),
        photoUrl:        photoUrl || null,
        bio:             bio.trim() || null,
        specialisations,
        trainerType:     trainerType,
        isActive:        existing?.is_active ?? true,
        branchIds:       selectedBranchIds,
      };
      // Forward credentials only when the admin actually filled them in:
      // - Create: password required (validated above), username optional.
      // - Edit:   blank password = leave unchanged; blank username = no change.
      if (password) body.password = password;
      if (username && username !== existingUsername) body.username = username;

      const res = isCreate
        ? await fetch('/api/trainers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/trainers/${existing!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }

      // The API returns the saved trainer at the root (or under `data`).
      const d = data?.data ?? data;
      const savedUsername: string | null = d.username ?? existing?.username ?? null;
      const savedHasLogin: boolean = d.has_login ?? existing?.has_login ?? !!savedUsername;

      toast.success(isCreate ? 'Specialist added' : 'Specialist updated');
      onSaved({
        id:                d.id ?? existing!.id,
        name:              name.trim(),
        photo_url:         photoUrl || null,
        bio:               bio.trim() || null,
        specialisations,
        trainer_type:      trainerType,
        is_active:         existing?.is_active ?? true,
        upcoming_sessions: existing?.upcoming_sessions ?? 0,
        branch_ids:        selectedBranchIds,
        username:          savedUsername,
        has_login:         savedHasLogin,
      } as TrainerProfile);

      if (isCreate) {
        // Show the assigned credentials once before letting the admin close.
        setCreatedCreds({ username: d.username, password });
        return;
      }
      onClose();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const copy = (s: string, label: string) => {
    navigator.clipboard.writeText(s);
    toast.success(`${label} copied`);
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        {createdCreds ? 'Login credentials' : (existing ? 'Edit Specialist' : 'Add Specialist')}
      </Modal.Header>

        {/* Post-create credentials view — shown once after a successful
            specialist provision so the admin can copy/share them. */}
        {createdCreds && (
          <Modal.Body className="space-y-4">
            <p className="text-sm text-fg-muted">
              Share these with the specialist. The password is shown once —
              copy it now.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface border border-line">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-fg-faint">Username</div>
                  <div className="font-mono text-sm text-fg truncate">{createdCreds.username}</div>
                </div>
                <button onClick={() => copy(createdCreds.username, 'Username')}
                  className="p-2 rounded-md hover:bg-surface-3 text-fg-muted">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface border border-line">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-fg-faint">Password</div>
                  <div className="font-mono text-sm text-fg truncate">{createdCreds.password}</div>
                </div>
                <button onClick={() => copy(createdCreds.password, 'Password')}
                  className="p-2 rounded-md hover:bg-surface-3 text-fg-muted">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-fg-faint">
              <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-400 flex-shrink-0" />
              <span>The specialist can sign in to the Coachesapp with these.</span>
            </div>
            <div className="pt-2">
              <Button variant="primary" size="md" fullWidth onClick={onClose}>
                Done
              </Button>
            </div>
          </Modal.Body>
        )}

        {!createdCreds && (
        <Modal.Body>
          {/* Photo */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => fileRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-surface-3 border-2 border-dashed border-line hover:border-brand cursor-pointer overflow-hidden flex items-center justify-center group transition-colors">
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-fg" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-fg-faint group-hover:text-brand transition-colors">
                  {uploadingPhoto
                    ? <Loader2 className="w-6 h-6 animate-spin" />
                    : <Camera className="w-6 h-6" />}
                  <span className="text-xs">Photo</span>
                </div>
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-fg animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-fg-faint">Click to upload photo</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          <Field label="Name" required>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Trainer name" />
          </Field>

          {/* Trainer Type */}
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">Type <span className="text-red-400">*</span></label>
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
                      ? 'bg-brand border-brand text-brand-ink'
                      : 'border-line text-fg-muted hover:border-gray-500 hover:text-fg'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Coachesapp login.
              - Create: numeric username (auto-assigned if blank) +
                required password.
              - Edit (specialist has a login): username editable, password
                blank = leave unchanged.
              - Edit (legacy trainer, no login yet): show a hint instead
                of fields, since /api/trainers/{id} can't add a login. */}
          {(isCreate || existingHasLogin) && (
            <div className="rounded-lg border border-line bg-surface/40 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-fg-muted">
                <Hash className="w-3.5 h-3.5" />
                Coachesapp login
              </div>

              <Field label="Username" required={isCreate}>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  inputMode="tel"
                  placeholder="Mobile number"
                  className="font-mono"
                />
              </Field>

              <Field
                label="Password"
                required={isCreate}
                hint={!isCreate ? 'Leave blank to keep current.' : undefined}
              >
                <div className="flex gap-2">
                  <PasswordInput
                    className="flex-1"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    inputMode="numeric"
                    visible={showPw}
                    onVisibleChange={setShowPw}
                    leftIcon={<Lock className="w-4 h-4" />}
                    placeholder={isCreate ? 'At least 6 characters' : 'New password (optional)'}
                  />
                  <Button type="button" variant="secondary" size="md" onClick={generatePw}>
                    Generate
                  </Button>
                </div>
              </Field>
            </div>
          )}

          {/* Legacy specialist with no login row — the existing edit
              endpoint can't attach a new login. Surface this rather
              than silently dropping the input fields. */}
          {!isCreate && !existingHasLogin && (
            <div className="rounded-lg border border-dashed border-line bg-surface/40 px-3 py-2.5 flex items-start gap-2">
              <Hash className="w-3.5 h-3.5 mt-0.5 text-fg-faint flex-shrink-0" />
              <p className="text-[12px] text-fg-muted leading-snug">
                This specialist was added before login support. They
                can&rsquo;t sign in to the Coachesapp yet — re-create them
                with a password to enable it.
              </p>
            </div>
          )}

          <Field label={<>Bio <span className="text-fg-faint font-normal">(optional)</span></>}>
            <Textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              placeholder="Short trainer bio…"
            />
          </Field>

          {/* Specialisations */}
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">Specialisations <span className="text-fg-faint">(optional)</span></label>
            <div className="bg-surface border border-line rounded-lg px-3 py-2 focus-within:border-brand transition-colors min-h-[42px] flex flex-wrap gap-1.5">
              {specialisations.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-brand/20 border border-brand/30 text-brand text-xs px-2 py-0.5 rounded-full">
                  {tag}
                  <button onClick={() => setSpecialisations(prev => prev.filter(t => t !== tag))}
                    className="hover:text-fg transition-colors">×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
                placeholder={specialisations.length === 0 ? 'e.g. Boxing, HIIT, Yoga — press Enter' : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-fg placeholder-gray-500 outline-none" />
            </div>
            <p className="text-xs text-fg-faint mt-1">Press Enter or comma to add</p>
          </div>

          {/* Branch assignment (multi-branch gyms only) */}
          {branches.length > 1 && (
            <div>
              <label className="block text-xs text-fg-muted mb-1.5">
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
                        ? 'bg-brand border-brand'
                        : 'border-gray-500 group-hover:border-brand'
                    }`}>
                      {selectedBranchIds.includes(b.id) && (
                        <svg className="w-2.5 h-2.5 text-fg" fill="none" viewBox="0 0 10 8">
                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-fg-muted group-hover:text-fg transition-colors">{b.name}</span>
                  </label>
                ))}
              </div>
              {selectedBranchIds.length === 0 && (
                <p className="text-xs text-red-400 mt-1.5">Select at least one branch</p>
              )}
            </div>
          )}
        </Modal.Body>
        )}

        {!createdCreds && (
        <Modal.Footer>
          <Button variant="secondary" size="md" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleSave}
            disabled={!name.trim() || uploadingPhoto}
            isLoading={saving}
          >
            {saving ? 'Saving…' : (existing ? 'Save Changes' : 'Add Specialist')}
          </Button>
        </Modal.Footer>
        )}
    </Modal>
  );
}
