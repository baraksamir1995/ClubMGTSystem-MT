'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Archive, ArchiveRestore, UserX, UserCheck, X, User, Dumbbell, QrCode } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui';
import toast from 'react-hot-toast';
import TrainerModal, { type TrainerProfile } from '@/components/trainers/trainer-modal';
import SpecialistQRModal from '@/components/trainers/specialist-qr-modal';
import { can, type Permission } from '@/lib/get-permissions';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { extractServerMessage } from '@/lib/api-error';

export interface SessionPackage {
  id: string;
  name: string;
  session_count: number | null;
  price: number;
  currency: string;
  description: string | null;
  is_active: boolean;
  trainer_type: string | null;
}

interface Props {
  serviceType: 'personal_trainer' | 'physiotherapist' | 'nutritionist';
  serviceName: string;
  trainers: TrainerProfile[];
  packages: SessionPackage[];
  gymId: string;
  permissions: Permission[] | null;
  branches?: GymBranch[];
}

// ── Package modal ─────────────────────────────────────────────────────────────

function PackageModal({
  existing,
  serviceType,
  gymId,
  onClose,
  onSaved,
}: {
  existing?: SessionPackage;
  serviceType: string;
  gymId: string;
  onClose: () => void;
  onSaved: (pkg: SessionPackage) => void;
}) {
  const t = useTranslations('services');
  const tc = useTranslations('common');
  const [name,         setName]         = useState(existing?.name ?? '');
  const [sessions,     setSessions]     = useState(String(existing?.session_count ?? ''));
  const [price,        setPrice]        = useState(String(existing?.price ?? ''));
  const [currency,     setCurrency]     = useState(existing?.currency ?? 'EGP');
  const [description,  setDescription]  = useState(existing?.description ?? '');
  const [saving,       setSaving]       = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error(t('packageModal.nameRequired')); return; }
    const parsedSessions = parseInt(sessions);
    const parsedPrice    = parseFloat(price);
    if (!parsedSessions || parsedSessions < 1) { toast.error(t('packageModal.invalidSessionCount')); return; }
    if (isNaN(parsedPrice) || parsedPrice < 0)  { toast.error(t('packageModal.invalidPrice')); return; }

    setSaving(true);
    try {
      const body = {
        name:          name.trim(),
        trainer_type:  serviceType,
        session_count: parsedSessions,
        price:         parsedPrice,
        currency,
        description:   description.trim() || null,
      };

      let res: Response;
      if (existing) {
        res = await fetch(`/api/service-packages/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/service-packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('packageModal.failedSaveToast')); return; }

      const saved: SessionPackage = existing
        ? { ...existing, ...body }
        : { id: data.id, ...body, is_active: true };
      toast.success(existing ? t('packageModal.packageUpdatedToast') : t('packageModal.packageCreatedToast'));
      onSaved(saved);
      onClose();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors';
  const labelCls = 'block text-xs text-fg-muted mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-base font-semibold text-fg">{existing ? t('packageModal.editTitle') : t('packageModal.addTitle')}</h2>
          <button onClick={onClose} aria-label={tc('cancel')} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>{t('packageModal.fieldName')}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('packageModal.fieldNamePlaceholder')} className={inputCls} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('packageModal.fieldSessions')}</label>
              <input type="number" min="1" value={sessions} onChange={e => setSessions(e.target.value)} placeholder="10" className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>{t('packageModal.fieldPrice')}</label>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className={inputCls} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('packageModal.fieldCurrency')}</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
              {['EGP','USD','EUR','GBP','SAR','AED'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('packageModal.fieldDescription')} <span className="text-fg-faint">{t('packageModal.fieldDescriptionOptional')}</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('packageModal.fieldDescriptionPlaceholder')} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg border border-line text-sm text-fg-muted hover:bg-surface-3 transition-colors disabled:opacity-50">
              {tc('cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-brand hover:bg-brand text-sm font-medium text-brand-ink transition-colors disabled:opacity-40">
              {saving ? tc('saving') : (existing ? tc('saveChanges') : t('packageModal.addPackageBtn'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function SessionServiceTab({
  serviceType, serviceName, trainers: initialTrainers, packages: initialPackages,
  gymId, permissions, branches = [],
}: Props) {
  const t = useTranslations('services');
  const tc = useTranslations('common');
  const [trainers,       setTrainers]       = useState<TrainerProfile[]>(initialTrainers);
  const [packages,       setPackages]       = useState<SessionPackage[]>(initialPackages);
  const [trainerModal,   setTrainerModal]   = useState<{ open: boolean; existing?: TrainerProfile }>({ open: false });
  const [packageModal,   setPackageModal]   = useState<{ open: boolean; existing?: SessionPackage }>({ open: false });
  const [qrTrainer,      setQrTrainer]      = useState<TrainerProfile | null>(null);
  const [togglingId,     setTogglingId]     = useState<string | null>(null);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);

  // ── Trainers ──────────────────────────────────────────────────────────────

  const toggleTrainer = async (trainer: TrainerProfile) => {
    setTogglingId(trainer.id);
    try {
      const res = await fetch(`/api/trainers/${trainer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:            trainer.name,
          photoUrl:        trainer.photo_url,
          bio:             trainer.bio,
          specialisations: trainer.specialisations,
          trainerType:     trainer.trainer_type,
          isActive:        !trainer.is_active,
        }),
      });
      if (!res.ok) { toast.error(t('specialists.failedUpdateToast')); return; }
      setTrainers(prev => prev.map(tr => tr.id === trainer.id ? { ...tr, is_active: !tr.is_active } : tr));
      toast.success(trainer.is_active ? t('specialists.deactivatedToast') : t('specialists.reactivatedToast'));
    } catch { toast.error(tc('networkError')); }
    finally { setTogglingId(null); }
  };

  const handleTrainerSaved = (saved: TrainerProfile) => {
    if (saved.trainer_type !== serviceType) return; // ignore if type was changed
    setTrainers(prev => {
      const idx = prev.findIndex(tr => tr.id === saved.id);
      return idx >= 0 ? prev.map(tr => tr.id === saved.id ? saved : tr) : [...prev, saved];
    });
  };

  // ── Packages ─────────────────────────────────────────────────────────────

  const handlePackageSaved = (saved: SessionPackage) => {
    setPackages(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
  };

  const archivePackage = async (pkg: SessionPackage) => {
    if (!confirm(t('packages.archiveConfirm', { name: pkg.name }))) return;
    setDeletingId(pkg.id);
    try {
      const res = await fetch(`/api/service-packages/${pkg.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(extractServerMessage(json) ?? t('packages.failedArchiveToast'));
        return;
      }
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, is_active: false } : p));
      toast.success(t('packages.archivedToast'));
    } catch { toast.error(tc('networkError')); }
    finally { setDeletingId(null); }
  };

  const reactivatePackage = async (pkg: SessionPackage) => {
    setDeletingId(pkg.id);
    try {
      const res = await fetch(`/api/service-packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(extractServerMessage(json) ?? t('packages.failedReactivateToast'));
        return;
      }
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, is_active: true } : p));
      toast.success(t('packages.reactivatedToast'));
    } catch { toast.error(tc('networkError')); }
    finally { setDeletingId(null); }
  };

  const activeTrainers   = trainers.filter(tr => tr.is_active);
  const inactiveTrainers = trainers.filter(tr => !tr.is_active);

  const fmtPrice = (price: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(price);

  return (
    <div className="space-y-8">
      {/* ── Specialists ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-fg">{t('specialists.heading')}</h3>
            <p className="text-xs text-fg-muted mt-0.5">
              {t('specialists.activeCount', { count: activeTrainers.length })}
              {inactiveTrainers.length > 0 && ` · ${t('specialists.inactiveCount', { count: inactiveTrainers.length })}`}
            </p>
          </div>
          {can(permissions, 'classes', 'create') && (
            <button
              onClick={() => setTrainerModal({ open: true })}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand hover:bg-brand-dim text-brand-ink text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> {t('specialists.addBtn')}
            </button>
          )}
        </div>

        {trainers.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={User}
              title={t('specialists.emptyTitle')}
              action={can(permissions, 'classes', 'create') ? (
                <Button variant="ghost" size="sm" onClick={() => setTrainerModal({ open: true })}>
                  {t('specialists.emptyAction')}
                </Button>
              ) : undefined}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trainers.map(trainer => (
              <div key={trainer.id}
                className={`bg-surface-2 border rounded-xl p-4 transition-opacity ${trainer.is_active ? 'border-line' : 'border-line/50 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-brand/20 flex-shrink-0 flex items-center justify-center">
                    {trainer.photo_url ? (
                      <img src={trainer.photo_url} alt={trainer.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-brand">
                        {trainer.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{trainer.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        trainer.is_active ? 'bg-success-soft text-success' : 'bg-surface-3 text-fg-muted'
                      }`}>
                        {trainer.is_active ? t('specialists.statusActive') : t('specialists.statusInactive')}
                      </span>
                    </div>
                    {(trainer.specialisations ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(trainer.specialisations ?? []).slice(0, 3).map(s => (
                          <span key={s} className="text-[10px] text-fg-muted bg-surface-3 px-1.5 py-0.5 rounded-full">
                            {s}
                          </span>
                        ))}
                        {(trainer.specialisations ?? []).length > 3 && (
                          <span className="text-[10px] text-fg-faint">+{(trainer.specialisations ?? []).length - 3}</span>
                        )}
                      </div>
                    )}
                    {branches.length > 1 && (trainer.branch_ids ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(trainer.branch_ids ?? []).map(bid => {
                          const branch = branches.find(b => b.id === bid);
                          return branch ? (
                            <span key={bid} className="text-[10px] px-1.5 py-0.5 rounded-full bg-info-soft border border-info/40 text-info">
                              {branch.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-line">
                  {can(permissions, 'classes', 'update') && (
                    <>
                      <button onClick={() => setTrainerModal({ open: true, existing: trainer })}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-fg-muted hover:text-fg hover:bg-surface-3 rounded-lg transition-colors">
                        <Pencil className="w-3 h-3" /> {t('specialists.editBtn')}
                      </button>
                      <button
                        onClick={() => toggleTrainer(trainer)}
                        disabled={togglingId === trainer.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-fg-muted hover:text-fg hover:bg-surface-3 rounded-lg transition-colors disabled:opacity-50">
                        {trainer.is_active
                          ? <><UserX className="w-3 h-3" /> {t('specialists.deactivateBtn')}</>
                          : <><UserCheck className="w-3 h-3" /> {t('specialists.reactivateBtn')}</>}
                      </button>
                    </>
                  )}
                  {/* Session QR — always shown (read/print action). Members
                      scan this to use a session with this specialist. */}
                  <button
                    onClick={() => setQrTrainer(trainer)}
                    title={t('qr.sessionQrTitle')}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs text-fg-muted hover:text-brand hover:bg-surface-3 rounded-lg transition-colors">
                    <QrCode className="w-3.5 h-3.5" /> QR
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Packages ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-fg">{t('packages.heading')}</h3>
            <p className="text-xs text-fg-muted mt-0.5">
              {packages.length === 1
                ? t('packages.countSingle', { count: packages.length })
                : t('packages.countPlural', { count: packages.length })}
            </p>
          </div>
          {can(permissions, 'plans', 'create') && (
            <button
              onClick={() => setPackageModal({ open: true })}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand hover:bg-brand-dim text-brand-ink text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> {t('packages.addBtn')}
            </button>
          )}
        </div>

        {packages.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={Dumbbell}
              title={t('packages.emptyTitle')}
              action={can(permissions, 'plans', 'create') ? (
                <Button variant="ghost" size="sm" onClick={() => setPackageModal({ open: true })}>
                  {t('packages.emptyAction')}
                </Button>
              ) : undefined}
            />
          </Card>
        ) : (
          <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="text-start text-xs text-fg-muted font-medium px-4 py-3">{t('packages.colPackage')}</th>
                  <th scope="col" className="text-start text-xs text-fg-muted font-medium px-4 py-3">{t('packages.colSessions')}</th>
                  <th scope="col" className="text-start text-xs text-fg-muted font-medium px-4 py-3">{t('packages.colPrice')}</th>
                  <th scope="col" className="text-start text-xs text-fg-muted font-medium px-4 py-3">{t('packages.colPerSession')}</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg, i) => {
                  const perSession = pkg.session_count && pkg.session_count > 1
                    ? fmtPrice(pkg.price / pkg.session_count, pkg.currency)
                    : '—';
                  const isArchived = !pkg.is_active;
                  return (
                    <tr key={pkg.id} className={`${i > 0 ? 'border-t border-line/50' : ''} hover:bg-surface-3/30 transition-colors ${isArchived ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-fg">{pkg.name}</p>
                          {isArchived && (
                            <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-warning-soft text-warning">
                              {t('packages.archived')}
                            </span>
                          )}
                        </div>
                        {pkg.description && <p className="text-xs text-fg-faint mt-0.5">{pkg.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-muted">
                        {pkg.session_count ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-fg">
                        {fmtPrice(pkg.price, pkg.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-fg-muted">{perSession}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'plans', 'update') && !isArchived && (
                            <button onClick={() => setPackageModal({ open: true, existing: pkg })} aria-label={tc('edit')}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-fg hover:bg-surface-3 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can(permissions, 'plans', 'delete') && (
                            isArchived ? (
                              <button onClick={() => reactivatePackage(pkg)} disabled={deletingId === pkg.id}
                                title={t('packages.reactivateTitle')}
                                aria-label={t('packages.reactivateTitle')}
                                className="p-1.5 rounded-lg text-fg-faint hover:text-success hover:bg-surface-3 transition-colors disabled:opacity-50">
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button onClick={() => archivePackage(pkg)} disabled={deletingId === pkg.id}
                                title={t('packages.archiveTitle')}
                                aria-label={t('packages.archiveTitle')}
                                className="p-1.5 rounded-lg text-fg-faint hover:text-warning hover:bg-surface-3 transition-colors disabled:opacity-50">
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {trainerModal.open && (
        <TrainerModal
          existing={trainerModal.existing}
          defaultType={serviceType}
          branches={branches}
          onClose={() => setTrainerModal({ open: false })}
          onSaved={handleTrainerSaved}
        />
      )}
      {packageModal.open && (
        <PackageModal
          existing={packageModal.existing}
          serviceType={serviceType}
          gymId={gymId}
          onClose={() => setPackageModal({ open: false })}
          onSaved={handlePackageSaved}
        />
      )}
      {qrTrainer && (
        <SpecialistQRModal
          gymId={gymId}
          trainerId={qrTrainer.id}
          trainerName={qrTrainer.name}
          trainerType={qrTrainer.trainer_type}
          onClose={() => setQrTrainer(null)}
        />
      )}
    </div>
  );
}
