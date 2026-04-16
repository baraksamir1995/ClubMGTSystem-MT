'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus, Loader2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

interface ClassType {
  id: string;
  name: string;
}

interface Props {
  initial: ClassType[];
  onChanged?: (updated: ClassType[]) => void;
}

export default function ClassTypesManager({ initial, onChanged }: Props) {
  const [types, setTypes] = useState<ClassType[]>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTypes(initial);
  }, [initial]);

  const notify = (updated: ClassType[]) => {
    setTypes(updated);
    onChanged?.(updated);
  };
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/class-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create'); return; }
      const updated = [...types, data].sort((a, b) => a.name.localeCompare(b.name));
      notify(updated);
      setNewName('');
      toast.success(`"${data.name}" added`);
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete class type "${name}"? Classes using this type will keep their current type value.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/class-types/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed to delete'); return; }
      notify(types.filter(t => t.id !== id));
      toast.success(`"${name}" removed`);
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Class Types</h1>
        <p className="text-sm text-gray-400 mt-1">Manage the class type options available when creating classes</p>
      </div>

      {/* Add new */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Add New Type</h2>
        <div className="flex gap-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Zumba, CrossFit, Calisthenics…"
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin mx-auto" />
          </div>
        ) : types.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No class types yet. Add one above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {types.map(t => (
                <tr key={t.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium capitalize">
                      {t.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      disabled={deletingId === t.id}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                    >
                      {deletingId === t.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
