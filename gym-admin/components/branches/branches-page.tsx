'use client';

import { useRef, useState } from 'react';
import { Plus, Pencil, Trash2, GitBranch, Check, X, ToggleLeft, ToggleRight, AlertCircle, MapPin, Image as ImageIcon, Upload, ExternalLink, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useRefresh } from '@/lib/use-refresh';
import type { GymBranch } from '@/app/dashboard/branches/page';
import type { GymStudio } from '@/app/dashboard/classes/page';
import { can, type Permission } from '@/lib/get-permissions';
import StudiosPageClient from '@/components/studios/studios-page';
import { Badge, Tabs } from '@/components/ui';

interface Props {
  initialBranches: GymBranch[];
  initialStudios: GymStudio[];
  maxBranches: number;
  pricePerBranch: number | null;
  gymId: string;
  permissions: Permission[] | null;
  hideHeader?: boolean;
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function BranchesPage({ initialBranches, initialStudios, maxBranches, pricePerBranch, gymId, permissions, hideHeader = false }: Props) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');

  const refresh = useRefresh();
  const [activeTab, setActiveTab] = useState<'branches' | 'studios'>('branches');
  const [branches, setBranches]     = useState<GymBranch[]>(initialBranches);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId]     = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Inline edit state
  const [editName, setEditName]       = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editMapsUrl, setEditMapsUrl] = useState('');

  // Create form
  const [showCreate, setShowCreate]       = useState(false);
  const [creating, setCreating]           = useState(false);
  const [createName, setCreateName]       = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createMapsUrl, setCreateMapsUrl] = useState('');

  const atLimit = branches.length >= maxBranches;

  // Per-row file input refs (keyed by branch id)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* ── Helpers ── */
  const startEdit = (b: GymBranch) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditAddress(b.address ?? '');
    setEditMapsUrl(b.maps_url ?? '');
  };
  const cancelEdit = () => setEditingId(null);

  /* ── Save edit ── */
  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) { toast.error(t('branches.nameRequired')); return; }
    setSavingId(id);
    try {
      const res = await fetch(`/api/branches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address: editAddress.trim() || null,
          mapsUrl: editMapsUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        toast.error(error ?? t('failedSave')); return;
      }
      const { branch } = await res.json();
      setBranches(prev => prev.map(b => b.id === id ? { ...b, ...branch } : b));
      setEditingId(null);
      toast.success(t('branches.branchUpdated'));
      refresh();
    } catch {
      toast.error(t('networkError'));
    } finally {
      setSavingId(null);
    }
  };

  /* ── Upload image ── */
  const uploadImage = async (branchId: string, file: File) => {
    setUploadingId(branchId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/branches/${branchId}/upload-image`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        toast.error(error ?? t('failedUpload')); return;
      }
      const { image_url } = await res.json();
      setBranches(prev => prev.map(b => b.id === branchId ? { ...b, image_url } : b));
      toast.success(t('branches.imageUploaded'));
    } catch {
      toast.error(t('networkError'));
    } finally {
      setUploadingId(null);
    }
  };

  /* ── Toggle active ── */
  const toggleActive = async (b: GymBranch) => {
    setTogglingId(b.id);
    try {
      const res = await fetch(`/api/branches/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.is_active }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        toast.error(error ?? t('failedUpdate')); return;
      }
      const { branch } = await res.json();
      setBranches(prev => prev.map(x => x.id === b.id ? { ...x, ...branch } : x));
    } catch {
      toast.error(t('networkError'));
    } finally {
      setTogglingId(null);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (b: GymBranch) => {
    if (!confirm(t('branches.deleteConfirm', { name: b.name }))) return;
    setDeletingId(b.id);
    try {
      const res = await fetch(`/api/branches/${b.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        toast.error(error ?? t('failedDelete')); return;
      }
      setBranches(prev => prev.filter(x => x.id !== b.id));
      toast.success(t('branches.branchDeleted'));
      refresh();
    } catch {
      toast.error(t('networkError'));
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Create ── */
  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) { toast.error(t('branches.nameRequired')); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address: createAddress.trim() || null,
          mapsUrl: createMapsUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        toast.error(error ?? t('failedCreate')); return;
      }
      const { branch } = await res.json();
      setBranches(prev => [...prev, { ...branch, session_count: 0 }]);
      setCreateName('');
      setCreateAddress('');
      setCreateMapsUrl('');
      setShowCreate(false);
      toast.success(t('branches.branchCreated'));
      refresh();
    } catch {
      toast.error(t('networkError'));
    } finally {
      setCreating(false);
    }
  };

  const inputCls = 'bg-surface border border-line text-fg text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand transition-colors';

  return (
    <div className="space-y-5">

      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">{t('branches.title')}</h1>
            <p className="text-sm text-fg-muted mt-0.5">{t('branches.subtitle')}</p>
          </div>
          {activeTab === 'branches' && can(permissions, 'settings', 'create') && !atLimit && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('branches.addBranch')}
            </button>
          )}
        </div>
      )}
      {hideHeader && activeTab === 'branches' && can(permissions, 'settings', 'create') && !atLimit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> {t('branches.addBranch')}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'branches' | 'studios')}>
        <Tabs.List>
          <Tabs.Trigger value="branches" icon={GitBranch}>
            {t('branches.tabBranches')}
            <Badge variant="neutral" size="sm" className="ms-1">{initialBranches.length}</Badge>
          </Tabs.Trigger>
          <Tabs.Trigger value="studios" icon={Building2}>
            {t('branches.tabStudios')}
            <Badge variant="neutral" size="sm" className="ms-1">{initialStudios.length}</Badge>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {/* Studios tab */}
      {activeTab === 'studios' && (
        <StudiosPageClient
          initialStudios={initialStudios}
          branches={initialBranches}
          gymId={gymId}
          permissions={permissions}
          hideHeader
        />
      )}

      {/* Branches tab content below */}
      {activeTab === 'branches' && (<>

      {/* Usage bar */}
      <div className="bg-surface-2 border border-line rounded-xl p-4 flex items-center gap-4">
        <GitBranch className="w-5 h-5 text-brand flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-medium text-fg">{t('branches.branchUsage')}</span>
            <span className="text-sm text-fg-muted">{branches.length} / {maxBranches}</span>
          </div>
          <div className="w-full bg-surface-3 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${atLimit ? 'bg-danger' : 'bg-brand'}`}
              style={{ width: `${Math.min(100, (branches.length / maxBranches) * 100)}%` }}
            />
          </div>
        </div>
        {pricePerBranch != null && (
          <span className="text-xs text-fg-faint flex-shrink-0">
            {t('branches.perExtraBranch', { price: pricePerBranch })}
          </span>
        )}
      </div>

      {/* At-limit notice */}
      {atLimit && (
        <div className="flex items-center gap-3 bg-warning-soft border border-warning/40 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" aria-hidden />
          <span className="text-warning text-sm">
            {t('branches.limitReached', { max: maxBranches })}
          </span>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-2 border border-brand/50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-fg">{t('branches.newBranch')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-fg-muted">{tc('name')} *</label>
              <input
                autoFocus
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                placeholder={t('branches.namePlaceholder')}
                className={`${inputCls} w-full`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-fg-muted">{t('branches.addressOptional')}</label>
              <input
                type="text"
                value={createAddress}
                onChange={e => setCreateAddress(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                placeholder={t('branches.addressPlaceholder')}
                className={`${inputCls} w-full`}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-fg-muted flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {t('branches.mapsLink')}
            </label>
            <input
              type="url"
              value={createMapsUrl}
              onChange={e => setCreateMapsUrl(e.target.value)}
              placeholder={t('branches.mapsPlaceholder')}
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => { setShowCreate(false); setCreateName(''); setCreateAddress(''); setCreateMapsUrl(''); }}
              className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
            >
              {tc('cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {creating ? t('branches.creating') : <><Check className="w-3.5 h-3.5" /> {t('branches.create')}</>}
            </button>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {branches.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <GitBranch className="w-10 h-10 text-fg-faint mx-auto mb-3" />
          <p className="text-fg-muted text-sm">{t('branches.noBranches')}</p>
          {can(permissions, 'settings', 'create') && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('branches.addBranch')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {branches.map(b => {
            const isEditing = editingId === b.id;
            return (
              <div key={b.id} className="bg-surface-2 border border-line rounded-xl overflow-hidden">

                {/* Image area */}
                <div className="relative h-40 bg-surface group">
                  {b.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={b.image_url}
                      alt={b.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-fg-faint">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs">{t('branches.noImage')}</span>
                    </div>
                  )}

                  {/* Upload overlay */}
                  {can(permissions, 'settings', 'edit') && (
                    <>
                      <input
                        ref={el => { fileInputRefs.current[b.id] = el; }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) uploadImage(b.id, file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        onClick={() => fileInputRefs.current[b.id]?.click()}
                        disabled={uploadingId === b.id}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-sm font-medium"
                        aria-label={b.image_url ? t('branches.changeImage') : t('branches.uploadImage')}
                      >
                        {uploadingId === b.id ? (
                          <span className="text-xs">{t('branches.uploading')}</span>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            {b.image_url ? t('branches.changeImage') : t('branches.uploadImage')}
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* Status badge */}
                  <Badge variant={b.is_active ? 'success' : 'neutral'} size="sm" className="absolute top-2 end-2">
                    {b.is_active ? tc('active') : tc('inactive')}
                  </Badge>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs text-fg-faint">{tc('name')} *</label>
                        <input
                          autoFocus
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(b.id); if (e.key === 'Escape') cancelEdit(); }}
                          className={`${inputCls} w-full`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-fg-faint">{t('profile.address')}</label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={e => setEditAddress(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(b.id); if (e.key === 'Escape') cancelEdit(); }}
                          placeholder={t('branches.addressEditPlaceholder')}
                          className={`${inputCls} w-full`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-fg-faint flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {t('branches.mapsLinkLabel')}
                        </label>
                        <input
                          type="url"
                          value={editMapsUrl}
                          onChange={e => setEditMapsUrl(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(b.id); if (e.key === 'Escape') cancelEdit(); }}
                          placeholder={t('branches.mapsPlaceholder')}
                          className={`${inputCls} w-full`}
                        />
                      </div>
                      <div className="flex items-center gap-2 justify-end pt-1">
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded-lg text-fg-faint hover:text-fg hover:bg-surface-3 transition-colors"
                          aria-label={tc('cancel')}
                        >
                          <X className="w-4 h-4" aria-hidden />
                        </button>
                        <button
                          onClick={() => saveEdit(b.id)}
                          disabled={savingId === b.id}
                          className="p-1.5 rounded-lg text-success hover:bg-success-soft transition-colors disabled:opacity-40"
                          aria-label={tc('save')}
                        >
                          <Check className="w-4 h-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-semibold text-fg text-base">{b.name}</p>
                        {b.address && (
                          <p className="text-xs text-fg-muted mt-0.5 truncate">{b.address}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-end text-xs text-fg-faint">
                        <span>{fmt(b.created_at)}</span>
                      </div>

                      {/* Maps link preview */}
                      {b.maps_url && (
                        <a
                          href={b.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dim transition-colors truncate"
                        >
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{t('branches.mapsLinkText')}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 pt-1 border-t border-line">
                        {can(permissions, 'settings', 'edit') && (
                          <>
                            <button
                              onClick={() => toggleActive(b)}
                              disabled={togglingId === b.id}
                              title={b.is_active ? t('branches.deactivate') : t('branches.activate')}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-fg-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors disabled:opacity-40"
                            >
                              {b.is_active
                                ? <><ToggleRight className="w-3.5 h-3.5" /> {t('branches.deactivate')}</>
                                : <><ToggleLeft  className="w-3.5 h-3.5" /> {t('branches.activate')}</>
                              }
                            </button>
                            <button
                              onClick={() => startEdit(b)}
                              title={tc('edit')}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-fg-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" /> {tc('edit')}
                            </button>
                          </>
                        )}
                        {can(permissions, 'settings', 'delete') && (
                          <button
                            onClick={() => handleDelete(b)}
                            disabled={deletingId === b.id}
                            title={tc('delete')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-fg-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> {tc('delete')}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}
    </div>
  );
}
