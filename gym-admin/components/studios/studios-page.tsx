'use client';

import { useState, useMemo } from 'react';
import { Plus, Building2, QrCode, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRefresh } from '@/lib/use-refresh';
import type { GymStudio } from '@/app/dashboard/classes/page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { can, type Permission } from '@/lib/get-permissions';
import StudioQRModal from './studio-qr-modal';

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
  const [studios, setStudios] = useState<GymStudio[]>(initialStudios);
  const [form, setForm]       = useState<StudioForm | null>(null); // null = closed, object = open
  const [editId, setEditId]   = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [qrStudio, setQrStudio] = useState<GymStudio | null>(null);
  const [branchFilter, setBranchFilter] = useState('all');

  const inputCls = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';
  const selectCls = 'bg-gray-700 border border-gray-600 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 transition-colors';

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
    if (!form || !form.name.trim()) { toast.error('Studio name is required'); return; }
    if (!form.branchId) { toast.error('Please select a branch'); return; }
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
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }

      const saved: GymStudio = {
        id:        editId ?? data.id,
        name:      body.name,
        branch_id: body.branchId,
        capacity:  null,
      };

      setStudios(prev =>
        editId ? prev.map(s => s.id === editId ? saved : s) : [saved, ...prev]
      );
      toast.success(editId ? 'Studio updated' : 'Studio created');
      refresh();
      closeForm();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (studio: GymStudio) => {
    if (!window.confirm(`Delete studio "${studio.name}"? Active sessions will lose their studio assignment.`)) return;
    try {
      const res = await fetch(`/api/studios/${studio.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setStudios(prev => prev.filter(s => s.id !== studio.id));
      toast.success('Studio deleted');
      refresh();
    } catch { toast.error('Network error'); }
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
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Studios</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage studio spaces and their static QR codes</p>
            </div>
            {can(permissions, 'classes', 'create') && (
              <button onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> New Studio
              </button>
            )}
          </div>
        )}
        {hideHeader && can(permissions, 'classes', 'create') && (
          <div className="flex justify-end">
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New Studio
            </button>
          </div>
        )}

        {/* Branch filter */}
        {branches.length > 1 && (
          <div className="flex gap-3 items-center">
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className={selectCls}>
              <option value="all">All branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="text-xs text-gray-500">{studios.length} studio{studios.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Studios grouped by branch */}
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {studios.length === 0 ? 'No studios yet — create one to assign sessions and generate QR codes' : 'No studios match the filter'}
            </p>
            {studios.length === 0 && can(permissions, 'classes', 'create') && (
              <button onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> Create first studio
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([branchId, branchStudios]) => (
              <div key={branchId}>
                {branches.length > 1 && (
                  <h2 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
                    {branchMap[branchId] ?? 'Unknown branch'}
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {branchStudios.map(studio => (
                    <div key={studio.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <Building2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                          <p className="text-white font-semibold leading-tight">{studio.name}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {can(permissions, 'classes', 'edit') && (
                            <button onClick={() => openEdit(studio)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can(permissions, 'classes', 'delete') && (
                            <button onClick={() => handleDelete(studio)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <button onClick={() => setQrStudio(studio)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-sm font-medium transition-colors">
                        <QrCode className="w-4 h-4" /> View QR Code
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                <h2 className="text-base font-semibold text-white">{editId ? 'Edit Studio' : 'New Studio'}</h2>
              </div>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {branches.length > 1 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Branch <span className="text-red-400">*</span></label>
                  <select value={form.branchId} onChange={e => setForm(f => f && ({ ...f, branchId: e.target.value }))}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                    <option value="">Select branch…</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Studio name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(f => f && ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Studio A"
                  className={inputCls} />
              </div>

            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
              <button onClick={closeForm} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40">
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Studio'}
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
