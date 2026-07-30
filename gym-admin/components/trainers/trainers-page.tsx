'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, UserX, UserCheck, CalendarDays, Search, X, User, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import TrainerModal, { type TrainerProfile } from './trainer-modal';
import TrainerSessionsModal from './trainer-sessions-modal';
import SpecialistQRModal from './specialist-qr-modal';
import { can, type Permission } from '@/lib/get-permissions';
import { useRefresh } from '@/lib/use-refresh';
import type { GymBranch } from '@/app/dashboard/branches/page';

interface Props {
  initialTrainers: TrainerProfile[];
  branches: GymBranch[];
  permissions: Permission[] | null;
  gymId: string;
}

export default function TrainersPage({ initialTrainers, branches = [], permissions, gymId }: Props) {
  const t = useTranslations('services');
  const tc = useTranslations('common');
  const refresh = useRefresh();
  const [trainers,       setTrainers]       = useState<TrainerProfile[]>(initialTrainers);
  const [filter,         setFilter]         = useState<'active' | 'inactive' | 'all'>('active');
  const [search,         setSearch]         = useState('');
  const [trainerModal,   setTrainerModal]   = useState<{ open: boolean; existing?: TrainerProfile }>({ open: false });
  const [sessionsTrainer, setSessionsTrainer] = useState<TrainerProfile | null>(null);
  const [qrTrainer,      setQrTrainer]      = useState<TrainerProfile | null>(null);
  const [togglingId,     setTogglingId]     = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...trainers];
    if (filter === 'active')   list = list.filter(tr => tr.is_active);
    if (filter === 'inactive') list = list.filter(tr => !tr.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(tr =>
        tr.name.toLowerCase().includes(q) ||
        tr.specialisations.some(s => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [trainers, filter, search]);

  const toggleActive = async (trainer: TrainerProfile) => {
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
      if (!res.ok) { toast.error(t('trainersPage.failedUpdateToast')); return; }
      setTrainers(prev => prev.map(tr => tr.id === trainer.id ? { ...tr, is_active: !tr.is_active } : tr));
      toast.success(trainer.is_active ? t('trainersPage.deactivatedToast') : t('trainersPage.reactivatedToast'));
    } catch { toast.error(tc('networkError')); }
    finally { setTogglingId(null); }
  };

  const trainerTypeLabel = (type: string): string => {
    switch (type) {
      case 'nutritionist':     return t('trainerModal.typeNutritionist');
      case 'physiotherapist':  return t('trainerModal.typePhysio');
      default:                 return t('trainerModal.typePT');
    }
  };

  const counts = {
    active:   trainers.filter(tr => tr.is_active).length,
    inactive: trainers.filter(tr => !tr.is_active).length,
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">{t('trainersPage.title')}</h1>
            <p className="text-sm text-fg-muted mt-0.5">{t('trainersPage.subtitle')}</p>
          </div>
          {can(permissions, 'classes', 'create') && (
            <button onClick={() => setTrainerModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> {t('trainersPage.addBtn')}
            </button>
          )}
        </div>

        {/* Filter + Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-surface-2 border border-line rounded-xl p-1">
            {([
              ['active',   t('trainersPage.filterActive'),   counts.active],
              ['inactive', t('trainersPage.filterInactive'), counts.inactive],
              ['all',      t('trainersPage.filterAll'),      trainers.length],
            ] as const).map(([val, label, count]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === val ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'}`}>
                {label}
                <span className="text-xs bg-surface-4 text-fg-muted px-1.5 py-0.5 rounded-full">{count}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('trainersPage.searchPlaceholder')}
              className="w-full ps-9 pe-8 py-2 bg-surface-2 border border-line rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute end-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg"><X className="w-3.5 h-3.5" aria-hidden /></button>}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
            <User className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-fg-muted text-sm">
              {trainers.length === 0 ? t('trainersPage.emptyNoTrainers') : t('trainersPage.emptyNoMatch')}
            </p>
            {trainers.length === 0 && can(permissions, 'classes', 'create') && (
              <button onClick={() => setTrainerModal({ open: true })}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> {t('trainersPage.addFirstBtn')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(trainer => (
              <div key={trainer.id}
                className={`bg-surface-2 border rounded-xl p-5 flex flex-col gap-4 transition-colors ${trainer.is_active ? 'border-line' : 'border-line opacity-60'}`}>

                {/* Top: photo + name + status */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-surface-3 flex-shrink-0 overflow-hidden">
                    {trainer.photo_url ? (
                      <img src={trainer.photo_url} alt={trainer.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand/20">
                        <span className="text-lg font-bold text-brand">
                          {trainer.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-fg font-semibold truncate">{trainer.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        trainer.is_active
                          ? 'bg-success-soft text-success'
                          : 'bg-surface-4/30 text-fg-muted'
                      }`}>
                        {trainer.is_active ? t('specialists.statusActive') : t('specialists.statusInactive')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        trainer.trainer_type === 'nutritionist'
                          ? 'bg-success-soft text-success'
                          : trainer.trainer_type === 'physiotherapist'
                          ? 'bg-info-soft text-info'
                          : 'bg-brand/10 text-brand'
                      }`}>
                        {trainerTypeLabel(trainer.trainer_type)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {trainer.bio && (
                  <p className="text-xs text-fg-muted line-clamp-2 leading-relaxed">{trainer.bio}</p>
                )}

                {/* Specialisations */}
                {(trainer.specialisations ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(trainer.specialisations ?? []).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-brand/15 border border-brand/25 text-brand">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Branch tags (multi-branch only) */}
                {branches.length > 1 && (trainer.branch_ids ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(trainer.branch_ids ?? []).map(bid => {
                      const branch = branches.find(b => b.id === bid);
                      return branch ? (
                        <span key={bid} className="text-xs px-2 py-0.5 rounded-full bg-info-soft border border-info/40 text-info">
                          {branch.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Sessions count */}
                <button
                  onClick={() => setSessionsTrainer(trainer)}
                  className="flex items-center gap-2 text-xs text-fg-muted hover:text-brand transition-colors group">
                  <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    <span className="text-fg font-medium group-hover:text-brand">{trainer.upcoming_sessions}</span>
                    {' '}
                    {trainer.upcoming_sessions !== 1
                      ? t('trainersPage.sessionsSuffix')
                      : t('trainersPage.sessionSuffix')}
                  </span>
                  <span className="text-brand opacity-0 group-hover:opacity-100 transition-opacity ms-auto text-xs">{t('trainersPage.viewArrow')}</span>
                </button>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-line">
                  {can(permissions, 'classes', 'edit') && (
                    <button
                      onClick={() => setTrainerModal({ open: true, existing: trainer })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-line text-fg-muted text-xs hover:bg-surface-3 transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> {t('trainersPage.editBtn')}
                    </button>
                  )}
                  {can(permissions, 'classes', 'edit') && (
                    <button
                      onClick={() => toggleActive(trainer)}
                      disabled={togglingId === trainer.id}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        trainer.is_active
                          ? 'border border-danger/40 text-danger hover:bg-danger-soft'
                          : 'border border-success/40 text-success hover:bg-success-soft'
                      }`}>
                      {trainer.is_active
                        ? <><UserX className="w-3.5 h-3.5" /> {t('trainersPage.deactivateBtn')}</>
                        : <><UserCheck className="w-3.5 h-3.5" /> {t('trainersPage.activateBtn')}</>}
                    </button>
                  )}
                  {/* Session QR — members scan this to use a session with
                      this specialist. Icon-only to keep the row compact. */}
                  <button
                    onClick={() => setQrTrainer(trainer)}
                    title={t('trainersPage.sessionQrTitle')}
                    aria-label={t('qr.ariaLabel')}
                    className="flex-shrink-0 flex items-center justify-center w-8 py-1.5 rounded-lg border border-line text-fg-muted hover:text-brand hover:border-brand/40 hover:bg-surface-3 transition-colors">
                    <QrCode className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {trainerModal.open && (
        <TrainerModal
          existing={trainerModal.existing}
          branches={branches}
          gymId={gymId}
          onClose={() => setTrainerModal({ open: false })}
          onSaved={tr => {
            setTrainers(prev => trainerModal.existing
              ? prev.map(x => x.id === tr.id ? tr : x)
              : [tr, ...prev]
            );
            refresh();
          }}
        />
      )}

      {sessionsTrainer && (
        <TrainerSessionsModal
          trainer={sessionsTrainer}
          onClose={() => setSessionsTrainer(null)}
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
    </>
  );
}
