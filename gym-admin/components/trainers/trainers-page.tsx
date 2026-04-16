'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, UserX, UserCheck, CalendarDays, Search, X, User } from 'lucide-react';
import toast from 'react-hot-toast';
import TrainerModal, { type TrainerProfile } from './trainer-modal';
import TrainerSessionsModal from './trainer-sessions-modal';
import { can, type Permission } from '@/lib/get-permissions';
import { useRefresh } from '@/lib/use-refresh';
import type { GymBranch } from '@/app/dashboard/branches/page';

interface Props {
  initialTrainers: TrainerProfile[];
  branches: GymBranch[];
  permissions: Permission[] | null;
}

export default function TrainersPage({ initialTrainers, branches = [], permissions }: Props) {
  const refresh = useRefresh();
  const [trainers,       setTrainers]       = useState<TrainerProfile[]>(initialTrainers);
  const [filter,         setFilter]         = useState<'active' | 'inactive' | 'all'>('active');
  const [search,         setSearch]         = useState('');
  const [trainerModal,   setTrainerModal]   = useState<{ open: boolean; existing?: TrainerProfile }>({ open: false });
  const [sessionsTrainer, setSessionsTrainer] = useState<TrainerProfile | null>(null);
  const [togglingId,     setTogglingId]     = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...trainers];
    if (filter === 'active')   list = list.filter(t => t.is_active);
    if (filter === 'inactive') list = list.filter(t => !t.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.specialisations.some(s => s.toLowerCase().includes(q))
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
      if (!res.ok) { toast.error('Failed to update'); return; }
      setTrainers(prev => prev.map(t => t.id === trainer.id ? { ...t, is_active: !t.is_active } : t));
      toast.success(trainer.is_active ? 'Trainer deactivated' : 'Trainer reactivated');
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

  const counts = {
    active:   trainers.filter(t => t.is_active).length,
    inactive: trainers.filter(t => !t.is_active).length,
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Trainers</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage trainer profiles assigned to classes</p>
          </div>
          {can(permissions, 'classes', 'create') && (
            <button onClick={() => setTrainerModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Add Trainer
            </button>
          )}
        </div>

        {/* Filter + Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
            {([['active', 'Active', counts.active], ['inactive', 'Inactive', counts.inactive], ['all', 'All', trainers.length]] as const).map(([val, label, count]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === val ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                {label}
                <span className="text-xs bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full">{count}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search trainers…"
              className="w-full pl-9 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
            <User className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {trainers.length === 0 ? 'No trainers yet' : 'No trainers match your search'}
            </p>
            {trainers.length === 0 && can(permissions, 'classes', 'create') && (
              <button onClick={() => setTrainerModal({ open: true })}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> Add first trainer
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(trainer => (
              <div key={trainer.id}
                className={`bg-gray-800 border rounded-xl p-5 flex flex-col gap-4 transition-colors ${trainer.is_active ? 'border-gray-700' : 'border-gray-700 opacity-60'}`}>

                {/* Top: photo + name + status */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden">
                    {trainer.photo_url ? (
                      <img src={trainer.photo_url} alt={trainer.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-purple-600/20">
                        <span className="text-lg font-bold text-purple-400">
                          {trainer.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{trainer.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        trainer.is_active
                          ? 'bg-emerald-400/10 text-emerald-400'
                          : 'bg-gray-600/30 text-gray-400'
                      }`}>
                        {trainer.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        trainer.trainer_type === 'nutritionist'
                          ? 'bg-teal-400/10 text-teal-400'
                          : trainer.trainer_type === 'physiotherapist'
                          ? 'bg-blue-400/10 text-blue-400'
                          : 'bg-purple-400/10 text-purple-400'
                      }`}>
                        {trainer.trainer_type === 'nutritionist'
                          ? 'Nutritionist'
                          : trainer.trainer_type === 'physiotherapist'
                          ? 'Physiotherapist'
                          : 'Personal Trainer'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {trainer.bio && (
                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{trainer.bio}</p>
                )}

                {/* Specialisations */}
                {(trainer.specialisations ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(trainer.specialisations ?? []).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-purple-600/15 border border-purple-600/25 text-purple-300">
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
                        <span key={bid} className="text-xs px-2 py-0.5 rounded-full bg-blue-600/15 border border-blue-600/25 text-blue-300">
                          {branch.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Sessions count */}
                <button
                  onClick={() => setSessionsTrainer(trainer)}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-purple-400 transition-colors group">
                  <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    <span className="text-white font-medium group-hover:text-purple-300">{trainer.upcoming_sessions}</span>
                    {' '}upcoming session{trainer.upcoming_sessions !== 1 ? 's' : ''}
                  </span>
                  <span className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-xs">View →</span>
                </button>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-700">
                  {can(permissions, 'classes', 'edit') && (
                    <button
                      onClick={() => setTrainerModal({ open: true, existing: trainer })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-xs hover:bg-gray-700 transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {can(permissions, 'classes', 'edit') && (
                    <button
                      onClick={() => toggleActive(trainer)}
                      disabled={togglingId === trainer.id}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        trainer.is_active
                          ? 'border border-red-500/30 text-red-400 hover:bg-red-400/10'
                          : 'border border-emerald-500/30 text-emerald-400 hover:bg-emerald-400/10'
                      }`}>
                      {trainer.is_active
                        ? <><UserX className="w-3.5 h-3.5" /> Deactivate</>
                        : <><UserCheck className="w-3.5 h-3.5" /> Activate</>}
                    </button>
                  )}
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
          onClose={() => setTrainerModal({ open: false })}
          onSaved={t => {
            setTrainers(prev => trainerModal.existing
              ? prev.map(x => x.id === t.id ? t : x)
              : [t, ...prev]
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
    </>
  );
}
