'use client';

import { useState, useEffect } from 'react';
import { Trash2, Plus, Loader2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('classes');
  const tc = useTranslations('common');
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
      if (!res.ok) { toast.error(data.error ?? t('classTypes.failedToCreate')); return; }
      const updated = [...types, data].sort((a, b) => a.name.localeCompare(b.name));
      notify(updated);
      setNewName('');
      toast.success(t('classTypes.added', { name: data.name }));
    } catch { toast.error(tc('networkError')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('classTypes.deleteConfirm', { name }))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/class-types/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? t('classTypes.failedToDelete')); return; }
      notify(types.filter(tp => tp.id !== id));
      toast.success(t('classTypes.removed', { name }));
    } catch { toast.error(tc('networkError')); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg">{t('classTypes.title')}</h1>
        <p className="text-sm text-fg-muted mt-1">{t('classTypes.subtitle')}</p>
      </div>

      {/* Add new */}
      <div className="bg-surface-2 border border-line rounded-xl p-5">
        <h2 className="text-sm font-semibold text-fg mb-4">{t('classTypes.addNewType')}</h2>
        <div className="flex gap-3">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder={t('classTypes.namePlaceholder')}
            className="flex-1"
          />
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!newName.trim()}
            isLoading={saving}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {tc('add')}
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
            <p className="text-fg-muted text-sm">{t('classTypes.noTypesYet')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-start px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">{t('classTypes.colName')}</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {types.map(tp => (
                <tr key={tp.id} className="hover:bg-surface-3/30 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="brand" className="capitalize">{tp.name}</Badge>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => handleDelete(tp.id, tp.name)}
                      disabled={deletingId === tp.id}
                      className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40"
                    >
                      {deletingId === tp.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
