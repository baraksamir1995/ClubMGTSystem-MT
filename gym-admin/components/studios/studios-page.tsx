'use client';

import { useState, useMemo } from 'react';
import { Plus, Building2, QrCode, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useRefresh } from '@/lib/use-refresh';
import type { GymStudio } from '@/app/dashboard/classes/page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { can, type Permission } from '@/lib/get-permissions';
import StudioQRModal from './studio-qr-modal';
import { extractServerMessage } from '@/lib/api-error';

interface Props {
  initialStudios: GymStudio[];
  branches: GymBranch[];
  gymId: string;
  permissions: Permission[] | null;
  hideHeader?: boolean;
}

interface StudioForm {
  name: string;
  branchId: string;
}

const EMPTY_FORM: StudioForm = { name: '', branchId: '' };

export default function StudiosPageClient({ initialStudios, branches, gymId, permissions, hideHeader = false }: Props) {
  const refresh = useRefresh();
  const t = useTranslations('classes');
  const tc = useTranslations('common');
  const [studios, setStudios] = useState<GymStudio[]>(initialStudios);
  const [form, setForm]       = useState<StudioForm | null>(null); // null = closed, object = open
  const [editId, setEditId]   = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [qrStudio, setQrStudio] = useState<GymStudio | null>(null);
  const [branchFilter, setBranchFilter] = useState('all');

  const inputCls = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand';
  const selectCls = 'bg-surface-3 border border-line text-sm text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors';

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, branchId: branches.length === 1 ? branches[0].id : '' });
  };

  const openEdit = (studio: GymStudio) => {
    setEditId(studio.id);
    setForm({ name: studio.name, branchId: studio.branch_id });
  };

  const closeForm = () => { setForm(null); setEditId(null); };

  const handleSave = async () => {
    if (!form || !form.name.trim()) { toast.error(t('studios.studioNameRequired')); return; }
    if (!form.branchId) { toast.error(t('studios.selectBranchRequired')); return; }
    setSaving(true);
    try {
      const body = {
        name:     form.name.trim(),
        branchId: form.branchId,
      };
      const res = await fetch(editId ? `/api/studios/${editId}` : '/api/studios', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('studios.failedToSave')); return; }

      const saved: GymStudio = {
        id:        editId ?? data.id,
        name:      body.name,
        branch_id: body.branchId,
        capacity:  null,
      };

      setStudios(prev =>
        editId ? prev.map(s => s.id === editId ? saved : s) : [saved, ...prev]
      );
      toast.success(editId ? t('studios.studioUpdated') : t('studios.studioCreated'));
      refresh();
      closeForm();
    } catch { toast.error(tc('networkError')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (studio: GymStudio) => {
    if (!window.confirm(t('studios.deleteConfirm', { name: studio.name }))) return;
    try {
      const res = await fetch(`/api/studios/${studio.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(extractServerMessage(json) ?? t('studios.failedToDelete'));
        return;
      }
      setStudios(prev => prev.filter(s => s.id !== studio.id));
      toast.success(t('studios.studioDeleted'));
      refresh();
    } catch { toast.error(tc('networkError')); }
  };

  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));

  const grouped = useMemo(() => {
    const filtered = branchFilter === 'all' ? studios : studios.filter(s => s.branch_id === branchFilter);
    const map: Record<string, GymStudio[]> = {};
    filtered.forEach(s => {
      if (!map[s.branch_id]) map[s.branch_id] = [];
      map[s.branch_id].push(s);
    });
    return map;
  }, [studios, branchFilter]);

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        {!hideHeader && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-fg">{t('studios.pageTitle')}</h1>
              <p className="text-sm text-fg-muted mt-0.5">{t('studios.pageSubtitle')}</p>
            </div>
            {can(permissions, 'classes', 'create') && (
              <button onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> {t('studios.newStudio')}
              </button>
            )}
          </div>
        )}
        {hideHeader && can(permissions, 'classes', 'create') && (
          <div className="flex justify-end">
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> {t('studios.newStudio')}
            </button>
          </div>
        )}

        {/* Branch filter */}
        {branches.length > 1 && (
          <div className="flex gap-3 items-center">
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className={selectCls}>
              <option value="all">{t('studios.allBranches')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="text-xs text-fg-faint">
              {studios.length !== 1
                ? t('studios.studioCountPlural', { count: studios.length })
                : t('studios.studioCount', { count: studios.length })}
            </span>
          </div>
        )}

        {/* Studios grouped by branch */}
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
            <Building2 className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-fg-muted text-sm">
              {studios.length === 0 ? t('studios.noStudiosYet') : t('studios.noStudiosMatch')}
            </p>
            {studios.length === 0 && can(permissions, 'classes', 'create') && (
              <button onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> {t('studios.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([bId, branchStudios]) => (
              <div key={bId}>
                {branches.length > 1 && (
                  <h2 className="text-xs text-fg-faint uppercase tracking-wider font-semibold mb-3">
                    {branchMap[bId] ?? t('studios.unknownBranch')}
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {branchStudios.map(studio => (
                    <div key={studio.id} className="bg-surface-2 border border-line rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <Building2 className="w-5 h-5 text-brand flex-shrink-0" />
                          <p className="text-fg font-semibold leading-tight">{studio.name}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {can(permissions, 'classes', 'edit') && (
                            <button onClick={() => openEdit(studio)} aria-label={t('studios.editStudio')}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors">
                              <Pencil className="w-3.5 h-3.5" aria-hidden />
                            </button>
                          )}
                          {can(permissions, 'classes', 'delete') && (
                            <button onClick={() => handleDelete(studio)} aria-label={tc('delete')}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors">
                              <Trash2 className="w-3.5 h-3.5" aria-hidden />
                            </button>
                          )}
                        </div>
                      </div>

                      <button onClick={() => setQrStudio(studio)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-brand/20 hover:bg-brand/30 text-brand text-sm font-medium transition-colors">
                        <QrCode className="w-4 h-4" /> {t('studios.viewQrCode')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {form !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/60 backdrop-blur-sm">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand" />
                <h2 className="text-base font-semibold text-fg">{editId ? t('studios.editStudio') : t('studios.newStudioTitle')}</h2>
              </div>
              <button onClick={closeForm} aria-label={tc('cancel')} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {branches.length > 1 && (
                <div>
                  <label className="block text-xs text-fg-muted mb-1.5">{t('studios.labelBranch')} <span className="text-danger">*</span></label>
                  <select value={form.branchId} onChange={e => setForm(f => f && ({ ...f, branchId: e.target.value }))}
                    className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand">
                    <option value="">{t('studios.selectBranch')}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-fg-muted mb-1.5">{t('studios.labelStudioName')} <span className="text-danger">*</span></label>
                <input value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))}
                  placeholder={t('studios.studioNamePlaceholder')}
                  className={inputCls} />
              </div>

            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-line">
              <button onClick={closeForm} className="flex-1 py-2 rounded-lg border border-line text-fg-muted text-sm hover:bg-surface-3 transition-colors">{tc('cancel')}</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 rounded-lg bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium transition-colors disabled:opacity-40">
                {saving ? tc('saving') : editId ? t('studios.saveChanges') : t('studios.createStudio')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrStudio && (
        <StudioQRModal studio={qrStudio} gymId={gymId} onClose={() => setQrStudio(null)} />
      )}
    </>
  );
}
