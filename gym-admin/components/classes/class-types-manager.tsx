'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus, Loader2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, Input } from '@/components/ui';

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
        <h1 className="text-xl font-bold text-fg">Class Types</h1>
        <p className="text-sm text-fg-muted mt-1">Manage the class type options available when creating classes</p>
      </div>

      {/* Add new */}
      <div className="bg-surface-2 border border-line rounded-xl p-5">
        <h2 className="text-sm font-semibold text-fg mb-4">Add New Type</h2>
        <div className="flex gap-3">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Zumba, CrossFit, Calisthenics…"
            className="flex-1"
          />
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!newName.trim()}
            isLoading={saving}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 text-fg-faint animate-spin mx-auto" />
          </div>
        ) : types.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-fg-muted text-sm">No class types yet. Add one above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {types.map(t => (
                <tr key={t.id} className="hover:bg-surface-3/30 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="brand" className="capitalize">{t.name}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      disabled={deletingId === t.id}
                      className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40"
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
