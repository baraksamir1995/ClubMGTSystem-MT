'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Layers, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRefresh } from '@/lib/use-refresh';
import ProgramModal from './program-modal';
import type { GymProgram } from '@/app/dashboard/services/page';
import { can, type Permission } from '@/lib/get-permissions';

type StatusFilter = 'all' | 'draft' | 'published';

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-400/10 text-emerald-400',
  draft:     'bg-gray-400/10 text-gray-400',
};

export default function ProgramsPage({
  initialPrograms, permissions, gymId,
}: {
  initialPrograms: GymProgram[];
  permissions: Permission[] | null;
  gymId: string;
}) {
  const refresh = useRefresh();
  const [programs, setPrograms]           = useState<GymProgram[]>(initialPrograms);
  const [modalOpen, setModalOpen]         = useState(false);
  const [editingProgram, setEditingProgram] = useState<GymProgram | undefined>(undefined);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all');

  const openCreate = () => { setEditingProgram(undefined); setModalOpen(true); };
  const openEdit   = (p: GymProgram) => { setEditingProgram(p); setModalOpen(true); };

  const filtered = useMemo(() => {
    let list = [...programs];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.trainer_name?.toLowerCase().includes(q) ||
        p.level?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
    return list;
  }, [programs, search, statusFilter]);

  const counts = useMemo(() => ({
    total:     programs.length,
    published: programs.filter(p => p.status === 'published').length,
    draft:     programs.filter(p => p.status === 'draft').length,
  }), [programs]);

  const handleSaved = (saved: GymProgram) => {
    setPrograms(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0
        ? prev.map(p => p.id === saved.id ? saved : p)
        : [saved, ...prev];
    });
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this program? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/programs/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete program'); return; }
      setPrograms(prev => prev.filter(p => p.id !== id));
      toast.success('Program deleted');
      refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Programs</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage training programs shown on the mobile app Explore feed</p>
          </div>
          {can(permissions, 'programs', 'create') && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> New Program
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {([
            { label: 'Total Programs', value: counts.total,     color: 'text-white',       filter: 'all' as StatusFilter },
            { label: 'Published',      value: counts.published, color: 'text-emerald-400', filter: 'published' as StatusFilter },
            { label: 'Draft',          value: counts.draft,     color: 'text-gray-300',    filter: 'draft' as StatusFilter },
          ] as const).map(s => (
            <button
              key={s.filter}
              onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
              className={`bg-gray-800 border rounded-xl p-4 text-left transition-colors ${
                statusFilter === s.filter ? 'border-purple-500' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, category, trainer or level…"
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-gray-700 border border-gray-600 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <span className="ml-auto text-xs text-gray-500">{filtered.length} of {programs.length} programs</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {programs.length === 0 ? 'No programs yet. Create your first program.' : 'No programs match your filters.'}
              </p>
              {programs.length === 0 && can(permissions, 'programs', 'create') && (
                <button
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create your first program
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Program</th>
                    <th className="text-left px-5 py-3">Details</th>
                    <th className="text-left px-5 py-3">Trainer</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Order</th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filtered.map(program => (
                    <tr key={program.id} className="hover:bg-gray-700/30 transition-colors">

                      {/* Program */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="flex items-start gap-3">
                          {program.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={program.image_url}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-700"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <Layers className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{program.title}</p>
                            {program.category && (
                              <p className="text-xs text-gray-500 mt-0.5">{program.category}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {program.duration_weeks && (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                              {program.duration_weeks}w
                            </span>
                          )}
                          {program.level && (
                            <span className="px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded text-xs">
                              {program.level}
                            </span>
                          )}
                          {program.session_duration_minutes && (
                            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                              {program.session_duration_minutes} min
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Trainer */}
                      <td className="px-5 py-3.5 text-gray-300 text-sm">
                        {program.trainer_name ?? <span className="text-gray-600">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[program.status] ?? 'bg-gray-400/10 text-gray-400'}`}>
                          {program.status}
                        </span>
                      </td>

                      {/* Order */}
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {program.display_order}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'programs', 'edit') && (
                            <button
                              onClick={() => openEdit(program)}
                              title="Edit program"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {can(permissions, 'programs', 'delete') && (
                            <button
                              onClick={() => handleDelete(program.id)}
                              disabled={deletingId === program.id}
                              title="Delete program"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <ProgramModal
          program={editingProgram}
          gymId={gymId}
          onClose={() => { setModalOpen(false); setEditingProgram(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
