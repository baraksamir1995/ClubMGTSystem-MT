'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, UserX, UserCheck, X, User, Dumbbell } from 'lucide-react';
import toast from 'react-hot-toast';
import TrainerModal, { type TrainerProfile } from '@/components/trainers/trainer-modal';
import { can, type Permission } from '@/lib/get-permissions';
import type { GymBranch } from '@/app/dashboard/branches/page';

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
  const [name,         setName]         = useState(existing?.name ?? '');
  const [sessions,     setSessions]     = useState(String(existing?.session_count ?? ''));
  const [price,        setPrice]        = useState(String(existing?.price ?? ''));
  const [currency,     setCurrency]     = useState(existing?.currency ?? 'EGP');
  const [description,  setDescription]  = useState(existing?.description ?? '');
  const [saving,       setSaving]       = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    const parsedSessions = parseInt(sessions);
    const parsedPrice    = parseFloat(price);
    if (!parsedSessions || parsedSessions < 1) { toast.error('Enter a valid session count'); return; }
    if (isNaN(parsedPrice) || parsedPrice < 0)  { toast.error('Enter a valid price'); return; }

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
      if (!res.ok) { toast.error(data.error ?? 'Failed to save package'); return; }

      const saved: SessionPackage = existing
        ? { ...existing, ...body }
        : { id: data.id, ...body, is_active: true };
      toast.success(existing ? 'Package updated' : 'Package created');
      onSaved(saved);
      onClose();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors';
  const labelCls = 'block text-xs text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">{existing ? 'Edit Package' : 'Add Package'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>Package name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 10-session pack" className={inputCls} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Sessions *</label>
              <input type="number" min="1" value={sessions} onChange={e => setSessions(e.target.value)} placeholder="10" className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Price *</label>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className={inputCls} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
              {['EGP','USD','EUR','GBP','SAR','AED'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Description <span className="text-gray-600">(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. 600 min · Save 15%" className={inputCls} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-40">
              {saving ? 'Saving…' : (existing ? 'Save changes' : 'Add package')}
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
  const [trainers,       setTrainers]       = useState<TrainerProfile[]>(initialTrainers);
  const [packages,       setPackages]       = useState<SessionPackage[]>(initialPackages);
  const [trainerModal,   setTrainerModal]   = useState<{ open: boolean; existing?: TrainerProfile }>({ open: false });
  const [packageModal,   setPackageModal]   = useState<{ open: boolean; existing?: SessionPackage }>({ open: false });
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
      if (!res.ok) { toast.error('Failed to update'); return; }
      setTrainers(prev => prev.map(t => t.id === trainer.id ? { ...t, is_active: !t.is_active } : t));
      toast.success(trainer.is_active ? 'Specialist deactivated' : 'Specialist reactivated');
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

  const handleTrainerSaved = (saved: TrainerProfile) => {
    if (saved.trainer_type !== serviceType) return; // ignore if type was changed
    setTrainers(prev => {
      const idx = prev.findIndex(t => t.id === saved.id);
      return idx >= 0 ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved];
    });
  };

  // ── Packages ─────────────────────────────────────────────────────────────

  const handlePackageSaved = (saved: SessionPackage) => {
    setPackages(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
  };

  const deletePackage = async (pkg: SessionPackage) => {
    if (!confirm(`Delete "${pkg.name}"? This cannot be undone.`)) return;
    setDeletingId(pkg.id);
    try {
      const res = await fetch(`/api/service-packages/${pkg.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete package'); return; }
      setPackages(prev => prev.filter(p => p.id !== pkg.id));
      toast.success('Package deleted');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  const activeTrainers   = trainers.filter(t => t.is_active);
  const inactiveTrainers = trainers.filter(t => !t.is_active);

  const fmtPrice = (price: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(price);

  return (
    <div className="space-y-8">
      {/* ── Specialists ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Specialists</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeTrainers.length} active
              {inactiveTrainers.length > 0 && ` · ${inactiveTrainers.length} inactive`}
            </p>
          </div>
          {can(permissions, 'classes', 'create') && (
            <button
              onClick={() => setTrainerModal({ open: true })}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Specialist
            </button>
          )}
        </div>

        {trainers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-gray-800/50 border border-gray-700 rounded-xl">
            <User className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No specialists added yet</p>
            {can(permissions, 'classes', 'create') && (
              <button onClick={() => setTrainerModal({ open: true })}
                className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                + Add your first specialist
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trainers.map(trainer => (
              <div key={trainer.id}
                className={`bg-gray-800 border rounded-xl p-4 transition-opacity ${trainer.is_active ? 'border-gray-700' : 'border-gray-700/50 opacity-60'}`}>
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-purple-600/20 flex-shrink-0 flex items-center justify-center">
                    {trainer.photo_url ? (
                      <img src={trainer.photo_url} alt={trainer.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-purple-400">
                        {trainer.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{trainer.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        trainer.is_active ? 'bg-emerald-400/10 text-emerald-400' : 'bg-gray-400/10 text-gray-400'
                      }`}>
                        {trainer.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {(trainer.specialisations ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(trainer.specialisations ?? []).slice(0, 3).map(s => (
                          <span key={s} className="text-[10px] text-gray-400 bg-gray-700 px-1.5 py-0.5 rounded-full">
                            {s}
                          </span>
                        ))}
                        {(trainer.specialisations ?? []).length > 3 && (
                          <span className="text-[10px] text-gray-500">+{(trainer.specialisations ?? []).length - 3}</span>
                        )}
                      </div>
                    )}
                    {branches.length > 1 && (trainer.branch_ids ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(trainer.branch_ids ?? []).map(bid => {
                          const branch = branches.find(b => b.id === bid);
                          return branch ? (
                            <span key={bid} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600/15 border border-blue-600/25 text-blue-300">
                              {branch.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {can(permissions, 'classes', 'update') && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
                    <button onClick={() => setTrainerModal({ open: true, existing: trainer })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => toggleTrainer(trainer)}
                      disabled={togglingId === trainer.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
                      {trainer.is_active
                        ? <><UserX className="w-3 h-3" /> Deactivate</>
                        : <><UserCheck className="w-3 h-3" /> Reactivate</>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Packages ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Session Packages</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {packages.length} package{packages.length !== 1 ? 's' : ''} · shown in mobile app
            </p>
          </div>
          {can(permissions, 'plans', 'create') && (
            <button
              onClick={() => setPackageModal({ open: true })}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Package
            </button>
          )}
        </div>

        {packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 bg-gray-800/50 border border-gray-700 rounded-xl">
            <Dumbbell className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No packages for this service yet</p>
            {can(permissions, 'plans', 'create') && (
              <button onClick={() => setPackageModal({ open: true })}
                className="mt-3 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                + Add your first package
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Package</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Sessions</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Price</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Per session</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg, i) => {
                  const perSession = pkg.session_count && pkg.session_count > 1
                    ? fmtPrice(pkg.price / pkg.session_count, pkg.currency)
                    : '—';
                  return (
                    <tr key={pkg.id} className={`${i > 0 ? 'border-t border-gray-700/50' : ''} hover:bg-gray-700/30 transition-colors`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{pkg.name}</p>
                        {pkg.description && <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {pkg.session_count ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        {fmtPrice(pkg.price, pkg.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{perSession}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'plans', 'update') && (
                            <button onClick={() => setPackageModal({ open: true, existing: pkg })}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can(permissions, 'plans', 'delete') && (
                            <button onClick={() => deletePackage(pkg)} disabled={deletingId === pkg.id}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors disabled:opacity-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
    </div>
  );
}
