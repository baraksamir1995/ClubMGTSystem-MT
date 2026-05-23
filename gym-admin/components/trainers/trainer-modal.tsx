'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Camera, Hash, Lock, Copy, Check, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { Button, Field, Input, Modal, PasswordInput, Textarea } from '@/components/ui';
import SpecialistQRModal from './specialist-qr-modal';

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
  gymId?: string;
  onClose: () => void;
  onSaved: (trainer: TrainerProfile) => void;
}

export default function TrainerModal({ existing, defaultType, branches = [], gymId = '', onClose, onSaved }: Props) {
  const t = useTranslations('services');
  const tc = useTranslations('common');
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
  const existingUsername = existing?.username ?? '';
  const existingHasLogin = existing?.has_login ?? false;
  const [username,        setUsername]        = useState(existingUsername);
  const [password,        setPassword]        = useState('');
  const [showPw, setShowPw] = useState(false);
  const [createdCreds,    setCreatedCreds]    = useState<{ username: string; password: string } | null>(null);
  const [showQR,          setShowQR]          = useState(false);

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
      if (!res.ok) { toast.error(data.error ?? t('trainerModal.photoUploadFailed')); return; }
      setPhotoUrl(data.url);
    } catch { toast.error(t('trainerModal.photoUploadFailed')); }
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
    if (!name.trim()) { toast.error(t('trainerModal.nameRequired')); return; }
    if (uploadingPhoto) { toast.error(t('trainerModal.photoUploading')); return; }
    if (branches.length > 1 && selectedBranchIds.length === 0) {
      toast.error(t('trainerModal.selectBranch'));
      return;
    }
    const mobilePattern = /^[0-9]{4,15}$/;
    if (isCreate) {
      if (!username) { toast.error(t('trainerModal.mobileRequired')); return; }
      if (!mobilePattern.test(username)) {
        toast.error(t('trainerModal.mobileDigitsOnly')); return;
      }
      if (!password) { toast.error(t('trainerModal.passwordRequired')); return; }
      if (password.length < 6) { toast.error(t('trainerModal.passwordMinLength')); return; }
    } else {
      if (password && password.length < 6) {
        toast.error(t('trainerModal.passwordMinLengthEdit')); return;
      }
      if (username && username !== existingUsername && !mobilePattern.test(username)) {
        toast.error(t('trainerModal.mobileInvalidEdit')); return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name:            name.trim(),
        photoUrl:        photoUrl || null,
        bio:             bio.trim() || null,
        specialisations,
        trainerType:     trainerType,
        isActive:        existing?.is_active ?? true,
        branchIds:       selectedBranchIds,
      };
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
      if (!res.ok) { toast.error(data.error ?? t('trainerModal.failedSaveToast')); return; }

      const d = data?.data ?? data;
      const savedUsername: string | null = d.username ?? existing?.username ?? null;
      const savedHasLogin: boolean = d.has_login ?? existing?.has_login ?? !!savedUsername;

      toast.success(isCreate ? t('trainerModal.addedToast') : t('trainerModal.updatedToast'));
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
        setCreatedCreds({ username: d.username, password });
        return;
      }
      onClose();
    } catch { toast.error(tc('networkError')); }
    finally { setSaving(false); }
  };

  const copy = (s: string, label: string) => {
    navigator.clipboard.writeText(s);
    toast.success(t('trainerModal.copiedToast', { label }));
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        {createdCreds ? t('trainerModal.credentialsTitle') : (existing ? t('trainerModal.editTitle') : t('trainerModal.addTitle'))}
      </Modal.Header>

        {/* Post-create credentials view */}
        {createdCreds && (
          <Modal.Body className="space-y-4">
            <p className="text-sm text-fg-muted">
              {t('trainerModal.credentialsHint')}
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface border border-line">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-fg-faint">{t('trainerModal.usernameLabel')}</div>
                  <div className="font-mono text-sm text-fg truncate">{createdCreds.username}</div>
                </div>
                <button onClick={() => copy(createdCreds.username, t('trainerModal.usernameLabel'))}
                  className="p-2 rounded-md hover:bg-surface-3 text-fg-muted">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface border border-line">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-fg-faint">{t('trainerModal.passwordLabel')}</div>
                  <div className="font-mono text-sm text-fg truncate">{createdCreds.password}</div>
                </div>
                <button onClick={() => copy(createdCreds.password, t('trainerModal.passwordLabel'))}
                  className="p-2 rounded-md hover:bg-surface-3 text-fg-muted">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-fg-faint">
              <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-400 flex-shrink-0" />
              <span>{t('trainerModal.credentialsConfirm')}</span>
            </div>
            <div className="pt-2">
              <Button variant="primary" size="md" fullWidth onClick={onClose}>
                {t('trainerModal.doneBtn')}
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
                  <span className="text-xs">{t('trainerModal.photoLabel')}</span>
                </div>
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-fg animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-fg-faint">{t('trainerModal.photoHint')}</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          <Field label={t('trainerModal.nameField')} required>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('trainerModal.namePlaceholder')} />
          </Field>

          {/* Trainer Type */}
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('trainerModal.typeField')} <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              {([
                ['personal_trainer', t('trainerModal.typePT')],
                ['nutritionist',     t('trainerModal.typeNutritionist')],
                ['physiotherapist',  t('trainerModal.typePhysio')],
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

          {/* Coachesapp login */}
          {(isCreate || existingHasLogin) && (
            <div className="rounded-lg border border-line bg-surface/40 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-fg-muted">
                <Hash className="w-3.5 h-3.5" />
                {t('trainerModal.coachesappLogin')}
              </div>

              <Field label={t('trainerModal.usernameMobileLabel')} required={isCreate}>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  inputMode="tel"
                  placeholder={t('trainerModal.usernamePlaceholder')}
                  className="font-mono"
                />
              </Field>

              <Field
                label={t('trainerModal.passwordLabel')}
                required={isCreate}
                hint={!isCreate ? t('trainerModal.passwordHint') : undefined}
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
                    placeholder={isCreate ? t('trainerModal.passwordPlaceholder') : t('trainerModal.passwordEditPlaceholder')}
                  />
                  <Button type="button" variant="secondary" size="md" onClick={generatePw}>
                    {t('trainerModal.generateBtn')}
                  </Button>
                </div>
              </Field>
            </div>
          )}

          {/* Legacy specialist with no login row */}
          {!isCreate && !existingHasLogin && (
            <div className="rounded-lg border border-dashed border-line bg-surface/40 px-3 py-2.5 flex items-start gap-2">
              <Hash className="w-3.5 h-3.5 mt-0.5 text-fg-faint flex-shrink-0" />
              <p className="text-[12px] text-fg-muted leading-snug">
                {t('trainerModal.noLoginHint')}
              </p>
            </div>
          )}

          {/* Session QR */}
          {existing && (
            <div className="rounded-lg border border-line bg-surface/40 p-3 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <QrCode className="w-4 h-4 mt-0.5 text-brand flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{t('qr.sessionQrTitle')}</p>
                  <p className="text-xs text-fg-faint leading-snug">
                    {t('qr.sessionQrSubtitle')}
                  </p>
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowQR(true)}>
                {t('qr.showQrBtn')}
              </Button>
            </div>
          )}

          <Field label={<>{t('trainerModal.bioField')} <span className="text-fg-faint font-normal">{t('trainerModal.bioOptional')}</span></>}>
            <Textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              placeholder={t('trainerModal.bioPlaceholder')}
            />
          </Field>

          {/* Specialisations */}
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">{t('trainerModal.specialisationsField')} <span className="text-fg-faint">{t('trainerModal.specialisationsOptional')}</span></label>
            <div className="bg-surface border border-line rounded-lg px-3 py-2 focus-within:border-brand transition-colors min-h-[42px] flex flex-wrap gap-1.5">
              {specialisations.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-brand/20 border border-brand/30 text-brand text-xs px-2 py-0.5 rounded-full">
                  {tag}
                  <button onClick={() => setSpecialisations(prev => prev.filter(tg => tg !== tag))}
                    className="hover:text-fg transition-colors">×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
                placeholder={specialisations.length === 0 ? t('trainerModal.specialisationsPlaceholder') : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm text-fg placeholder-gray-500 outline-none" />
            </div>
            <p className="text-xs text-fg-faint mt-1">{t('trainerModal.specialisationsHint')}</p>
          </div>

          {/* Branch assignment (multi-branch gyms only) */}
          {branches.length > 1 && (
            <div>
              <label className="block text-xs text-fg-muted mb-1.5">
                {t('trainerModal.branchesField')} <span className="text-red-400">*</span>
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
                <p className="text-xs text-red-400 mt-1.5">{t('trainerModal.branchesRequired')}</p>
              )}
            </div>
          )}
        </Modal.Body>
        )}

        {!createdCreds && (
        <Modal.Footer>
          <Button variant="secondary" size="md" fullWidth onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleSave}
            disabled={!name.trim() || uploadingPhoto}
            isLoading={saving}
          >
            {saving ? tc('saving') : (existing ? tc('saveChanges') : t('trainerModal.addTitle'))}
          </Button>
        </Modal.Footer>
        )}

      {showQR && existing && (
        <SpecialistQRModal
          gymId={gymId}
          trainerId={existing.id}
          trainerName={existing.name}
          trainerType={existing.trainer_type}
          onClose={() => setShowQR(false)}
        />
      )}
    </Modal>
  );
}
