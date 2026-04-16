'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Check, Loader2, Megaphone, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymAnnouncement } from '@/app/dashboard/content/page';
import { can, type Permission } from '@/lib/get-permissions';

interface Props { initialAnnouncements: GymAnnouncement[]; permissions: Permission[] | null }

const emptyForm = { title: '', body: '', visibleFrom: '', visibleUntil: '' };

function announcementStatus(a: GymAnnouncement): 'active' | 'scheduled' | 'expired' | 'hidden' {
  if (!a.is_visible) return 'hidden';
  const today = new Date().toISOString().slice(0, 10);
  if (a.visible_from && a.visible_from > today) return 'scheduled';
  if (a.visible_until && a.visible_until < today) return 'expired';
  return 'active';
}

const statusStyle: Record<string, string> = {
  active:    'bg-emerald-400/10 text-emerald-400',
  scheduled: 'bg-blue-400/10 text-blue-400',
  expired:   'bg-red-400/10 text-red-400',
  hidden:    'bg-gray-600/30 text-gray-400',
};

export default function AnnouncementsTab({ initialAnnouncements, permissions }: Props) {
  const [announcements, setAnnouncements] = useState<GymAnnouncement[]>(initialAnnouncements);
  const [showForm,      setShowForm]      = useState(false);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [form,          setForm]          = useState(emptyForm);
  const [saving,        setSaving]        = useState(false);
  const [togglingId,    setTogglingId]    = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  const inp = 'w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

  const openCreate = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit   = (a: GymAnnouncement) => {
    setEditId(a.id);
    setForm({ title: a.title, body: a.body, visibleFrom: a.visible_from ?? '', visibleUntil: a.visible_until ?? '' });
    setShowForm(true);
  };
  const cancel = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title and body are required'); return; }
    setSaving(true);
    try {
      const isEdit = !!editId;
      const res = await fetch(isEdit ? `/api/content/announcements/${editId}` : '/api/content/announcements', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        form.title.trim(),
          body:         form.body.trim(),
          visibleFrom:  form.visibleFrom  || null,
          visibleUntil: form.visibleUntil || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setAnnouncements(prev => isEdit
        ? prev.map(a => a.id === editId ? data.announcement : a)
        : [data.announcement, ...prev]
      );
      toast.success(isEdit ? 'Announcement updated' : 'Announcement created');
      cancel();
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const toggleVisible = async (a: GymAnnouncement) => {
    setTogglingId(a.id);
    try {
      const res = await fetch(`/api/content/announcements/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: !a.is_visible }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setAnnouncements(prev => prev.map(x => x.id === a.id ? data.announcement : x));
      toast.success(a.is_visible ? 'Announcement hidden' : 'Announcement visible');
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

  const deleteAnnouncement = async (a: GymAnnouncement) => {
    if (!confirm('Delete this announcement?')) return;
    setDeletingId(a.id);
    try {
      const res = await fetch(`/api/content/announcements/${a.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setAnnouncements(prev => prev.filter(x => x.id !== a.id));
      toast.success('Announcement deleted');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</p>
        {can(permissions, 'content', 'create') && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Announcement
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-gray-800 border border-purple-600/40 rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-white">{editId ? 'Edit Announcement' : 'New Announcement'}</p>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Title <span className="text-red-400">*</span></label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Gym closed on public holiday" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Body <span className="text-red-400">*</span></label>
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              placeholder="Announcement details…" rows={4}
              className={inp + ' resize-none'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                <CalendarDays className="inline w-3 h-3 mr-1" />Visible From <span className="text-gray-600">(optional)</span>
              </label>
              <input type="date" value={form.visibleFrom} onChange={e => setForm(p => ({ ...p, visibleFrom: e.target.value }))}
                className={inp + ' [color-scheme:dark]'} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                <CalendarDays className="inline w-3 h-3 mr-1" />Visible Until <span className="text-gray-600">(optional)</span>
              </label>
              <input type="date" value={form.visibleUntil} onChange={e => setForm(p => ({ ...p, visibleUntil: e.target.value }))}
                className={inp + ' [color-scheme:dark]'} />
            </div>
          </div>
          <p className="text-xs text-gray-500">Leave dates empty to show the announcement indefinitely.</p>
          <div className="flex gap-2">
            <button onClick={cancel} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Check className="w-3.5 h-3.5" /> Save</>}
            </button>
          </div>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <Megaphone className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const status = announcementStatus(a);
            return (
              <div key={a.id}
                className={`bg-gray-800 border border-gray-700 rounded-xl p-5 ${status === 'expired' || status === 'hidden' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{a.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusStyle[status]}`}>
                        {status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{a.body}</p>
                    {(a.visible_from || a.visible_until) && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <CalendarDays className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {a.visible_from ? new Date(a.visible_from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '∞'}
                          {' — '}
                          {a.visible_until ? new Date(a.visible_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '∞'}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-1.5">
                      Created {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {can(permissions, 'content', 'edit') && (
                      <button onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {can(permissions, 'content', 'edit') && (
                      <button onClick={() => toggleVisible(a)} disabled={togglingId === a.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                        {a.is_visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {can(permissions, 'content', 'delete') && (
                      <button onClick={() => deleteAnnouncement(a)} disabled={deletingId === a.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
