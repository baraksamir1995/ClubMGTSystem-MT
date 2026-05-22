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
  draft:     'bg-gray-400/10 text-fg-muted',
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
            <h1 className="text-2xl font-bold text-fg">Programs</h1>
            <p className="text-sm text-fg-muted mt-0.5">Manage training programs shown on the mobile app Explore feed</p>
          </div>
          {can(permissions, 'programs', 'create') && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> New Program
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {([
            { label: 'Total Programs', value: counts.total,     color: 'text-fg',       filter: 'all' as StatusFilter },
            { label: 'Published',      value: counts.published, color: 'text-emerald-400', filter: 'published' as StatusFilter },
            { label: 'Draft',          value: counts.draft,     color: 'text-fg-muted',    filter: 'draft' as StatusFilter },
          ] as const).map(s => (
            <button
              key={s.filter}
              onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
              className={`bg-surface-2 border rounded-xl p-4 text-left transition-colors ${
                statusFilter === s.filter ? 'border-brand' : 'border-line hover:border-line'
              }`}
            >
              <p className="text-xs text-fg-muted mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, category, trainer or level…"
              className="w-full pl-9 pr-4 py-2 bg-surface border border-line rounded-lg text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand transition-colors"
            />
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-surface-3 border border-line text-sm text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <span className="ml-auto text-xs text-fg-faint">{filtered.length} of {programs.length} programs</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Layers className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-fg-muted text-sm">
                {programs.length === 0 ? 'No programs yet. Create your first program.' : 'No programs match your filters.'}
              </p>
              {programs.length === 0 && can(permissions, 'programs', 'create') && (
                <button
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create your first program
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Program</th>
                    <th className="text-left px-5 py-3">Details</th>
                    <th className="text-left px-5 py-3">Trainer</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Order</th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map(program => (
                    <tr key={program.id} className="hover:bg-surface-3/30 transition-colors">

                      {/* Program */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="flex items-start gap-3">
                          {program.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={program.image_url}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-surface-3"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0">
                              <Layers className="w-5 h-5 text-fg-faint" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-fg truncate">{program.title}</p>
                            {program.category && (
                              <p className="text-xs text-fg-faint mt-0.5">{program.category}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {program.duration_weeks && (
                            <span className="px-2 py-0.5 bg-surface-3 text-fg-muted rounded text-xs">
                              {program.duration_weeks}w
                            </span>
                          )}
                          {program.level && (
                            <span className="px-2 py-0.5 bg-brand/20 text-brand rounded text-xs">
                              {program.level}
                            </span>
                          )}
                          {program.session_duration_minutes && (
                            <span className="px-2 py-0.5 bg-surface-3 text-fg-muted rounded text-xs">
                              {program.session_duration_minutes} min
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Trainer */}
                      <td className="px-5 py-3.5 text-fg-muted text-sm">
                        {program.trainer_name ?? <span className="text-fg-faint">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[program.status] ?? 'bg-gray-400/10 text-fg-muted'}`}>
                          {program.status}
                        </span>
                      </td>

                      {/* Order */}
                      <td className="px-5 py-3.5 text-fg-faint text-xs">
                        {program.display_order}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'programs', 'edit') && (
                            <button
                              onClick={() => openEdit(program)}
                              title="Edit program"
                              className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {can(permissions, 'programs', 'delete') && (
                            <button
                              onClick={() => handleDelete(program.id)}
                              disabled={deletingId === program.id}
                              title="Delete program"
                              className="p-1.5 rounded-lg text-fg-faint hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
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
