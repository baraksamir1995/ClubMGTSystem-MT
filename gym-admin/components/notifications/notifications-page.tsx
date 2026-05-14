'use client';

import { useState } from 'react';
import { Bell, Send, Clock, History, Plus, Pencil, X, Trash2, Loader2, Users, Filter, CalendarClock, CheckCircle2, Zap, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymNotification, PlanOption } from '@/app/dashboard/notifications/page';
import { can, type Permission } from '@/lib/get-permissions';

interface Props {
  initialNotifications: GymNotification[];
  plans: PlanOption[];
  permissions: Permission[] | null;
}

const STATUSES = ['active', 'expired', 'suspended', 'cancelled'] as const;
const STATUS_LABELS: Record<string, string> = { active: 'Active', expired: 'Expired', suspended: 'Suspended', cancelled: 'Cancelled' };

const emptyForm = () => ({
  title: '', body: '',
  recipientType: 'all' as 'all' | 'filtered',
  filterStatuses: ['active'] as string[],
  filterPlanIds:  [] as string[],
  sendMode: 'now' as 'now' | 'schedule',
  scheduledAt: '',
});

function fmtDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function NotificationsPage({ initialNotifications, plans, permissions }: Props) {
  const [activeTab,      setActiveTab]      = useState<'compose' | 'scheduled' | 'sent'>('compose');
  const [notifications,  setNotifications]  = useState<GymNotification[]>(initialNotifications);
  const [form,           setForm]           = useState(emptyForm());
  const [sending,        setSending]        = useState(false);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [cancellingId,   setCancellingId]   = useState<string | null>(null);

  const scheduled = notifications.filter(n => n.status === 'scheduled');
  const sent      = notifications.filter(n => n.status === 'sent');

  const inp = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

  const toggleStatus = (s: string) => setForm(p => ({
    ...p,
    filterStatuses: p.filterStatuses.includes(s)
      ? p.filterStatuses.filter(x => x !== s)
      : [...p.filterStatuses, s],
  }));

  const togglePlan = (id: string) => setForm(p => ({
    ...p,
    filterPlanIds: p.filterPlanIds.includes(id)
      ? p.filterPlanIds.filter(x => x !== id)
      : [...p.filterPlanIds, id],
  }));

  const openEdit = (n: GymNotification) => {
    setEditingId(n.id);
    setForm({
      title:          n.title,
      body:           n.body,
      recipientType:  n.recipient_type === 'all' ? 'all' : 'filtered',
      filterStatuses: n.recipient_filter?.statuses ?? ['active'],
      filterPlanIds:  n.recipient_filter?.plan_ids ?? [],
      sendMode:       'schedule',
      scheduledAt:    n.scheduled_at ? n.scheduled_at.slice(0, 16) : '',
    });
    setActiveTab('compose');
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm()); };

  const send = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.body.trim())  { toast.error('Message body is required'); return; }
    if (form.sendMode === 'schedule' && !form.scheduledAt) { toast.error('Select a date and time'); return; }
    if (form.recipientType === 'filtered' && form.filterStatuses.length === 0 && form.filterPlanIds.length === 0) {
      toast.error('Select at least one filter'); return;
    }

    setSending(true);
    try {
      const payload = {
        title:           form.title.trim(),
        body:            form.body.trim(),
        recipientType:   form.recipientType,
        recipientFilter: form.recipientType === 'filtered'
          ? { statuses: form.filterStatuses, plan_ids: form.filterPlanIds }
          : null,
        scheduledAt: form.sendMode === 'schedule' ? new Date(form.scheduledAt).toISOString() : null,
      };

      const isEdit = !!editingId;
      const res = await fetch(isEdit ? `/api/notifications/${editingId}` : '/api/notifications', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit
          ? { ...payload, status: form.sendMode === 'now' ? 'sent' : 'scheduled' }
          : payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }

      const notif = (data.notification ?? data.data ?? data) as Partial<GymNotification>;
      if (!isEdit && !notif.id) {
        toast.error('Notification sent, but the response was incomplete. Refresh to see it.');
        return;
      }

      const saved = notif as GymNotification;
      setNotifications(prev => isEdit
        ? prev.map(n => n.id === editingId ? { ...n, ...payload, ...notif } as GymNotification : n)
        : [saved, ...prev]
      );

      if (form.sendMode === 'now') {
        const count = saved.recipient_count ?? 0;
        toast.success(`Notification sent to ${count} member${count !== 1 ? 's' : ''}!`);
        setActiveTab('sent');
      } else {
        toast.success('Notification scheduled');
        setActiveTab('scheduled');
      }
      setEditingId(null);
      setForm(emptyForm());
    } catch { toast.error('Network error'); }
    finally { setSending(false); }
  };

  const cancelNotification = async (id: string) => {
    if (!confirm('Cancel this scheduled notification?')) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) { toast.error('Failed'); return; }
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'cancelled' as const } : n));
      toast.success('Notification cancelled');
    } catch { toast.error('Network error'); }
    finally { setCancellingId(null); }
  };

  const tabCls = (t: string) =>
    `flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Communications</h1>
          <p className="text-sm text-gray-400 mt-0.5">Send notifications and announcements to members</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab('compose')} className={tabCls('compose')}>
          <Send className="w-4 h-4" /> Compose
        </button>
        <button onClick={() => setActiveTab('scheduled')} className={tabCls('scheduled')}>
          <Clock className="w-4 h-4" /> Scheduled
          {scheduled.length > 0 && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{scheduled.length}</span>
          )}
        </button>
        <button onClick={() => setActiveTab('sent')} className={tabCls('sent')}>
          <History className="w-4 h-4" /> Sent History
        </button>
      </div>

      {/* ── COMPOSE ── */}
      {activeTab === 'compose' && (
        <div className="space-y-4">
          {editingId && (
            <div className="flex items-center justify-between bg-blue-400/10 border border-blue-400/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400">Editing scheduled notification</span>
              </div>
              <button onClick={cancelEdit} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Left: Message */}
            <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white">Message</h2>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Title <span className="text-red-400">*</span></label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Holiday Schedule Change" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Message <span className="text-red-400">*</span></label>
                <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="Write your message to members…" rows={8}
                  className={inp + ' resize-none'} />
                <p className="text-xs text-gray-600 mt-1">{form.body.length} characters</p>
              </div>
            </div>

            {/* Right: Recipients + Send Time + Button */}
            <div className="space-y-4">
              {/* Recipients */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-semibold text-white">Recipients</h2>
                </div>
                <div className="flex flex-col gap-2">
                  {(['all', 'filtered'] as const).map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, recipientType: t }))}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${
                        form.recipientType === t
                          ? 'bg-purple-600/20 border-purple-600/40 text-purple-400'
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                      }`}>
                      {t === 'all' ? <Users className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                      {t === 'all' ? 'All Active Members' : 'Filter Members'}
                    </button>
                  ))}
                </div>

                {form.recipientType === 'filtered' && (
                  <div className="space-y-4 pt-1">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Filter className="w-3.5 h-3.5 text-gray-400" />
                        <label className="text-xs font-medium text-gray-400">By Status</label>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map(s => (
                          <button key={s} onClick={() => toggleStatus(s)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                              form.filterStatuses.includes(s)
                                ? 'bg-purple-600/20 border-purple-600/40 text-purple-300'
                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                            }`}>
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {plans.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Filter className="w-3.5 h-3.5 text-gray-400" />
                          <label className="text-xs font-medium text-gray-400">By Plan</label>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {plans.map(p => (
                            <button key={p.id} onClick={() => togglePlan(p.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                form.filterPlanIds.includes(p.id)
                                  ? 'bg-blue-600/20 border-blue-600/40 text-blue-300'
                                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                              }`}>
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Send Time */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-semibold text-white">Send Time</h2>
                </div>
                <div className="flex flex-col gap-2">
                  {(['now', 'schedule'] as const).map(m => (
                    <button key={m} onClick={() => setForm(p => ({ ...p, sendMode: m }))}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${
                        form.sendMode === m
                          ? 'bg-purple-600/20 border-purple-600/40 text-purple-400'
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                      }`}>
                      {m === 'now' ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      {m === 'now' ? 'Send Now' : 'Schedule'}
                    </button>
                  ))}
                </div>
                {form.sendMode === 'schedule' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Date & Time <span className="text-red-400">*</span></label>
                    <input type="datetime-local" value={form.scheduledAt}
                      onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                      className={inp + ' [color-scheme:dark]'} />
                  </div>
                )}
              </div>

              {/* Send button */}
              {can(permissions, 'notifications', 'create') && (
                <button onClick={send} disabled={sending}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {sending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {form.sendMode === 'now' ? 'Sending…' : 'Scheduling…'}</>
                    : form.sendMode === 'now'
                      ? <><Send className="w-4 h-4" /> Send Notification</>
                      : <><Clock className="w-4 h-4" /> Schedule Notification</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULED ── */}
      {activeTab === 'scheduled' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scheduled.length === 0 ? (
            <div className="col-span-full bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
              <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No scheduled notifications</p>
              {can(permissions, 'notifications', 'create') && (
                <button onClick={() => setActiveTab('compose')}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Compose New
                </button>
              )}
            </div>
          ) : scheduled.map(n => (
            <div key={n.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded-full">Scheduled</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {n.scheduled_at ? fmtDt(n.scheduled_at) : '—'}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{n.title}</h3>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">{n.body}</p>
                  <RecipientBadge n={n} plans={plans} />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {can(permissions, 'notifications', 'edit') && (
                    <button onClick={() => openEdit(n)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {can(permissions, 'notifications', 'delete') && (
                    <button onClick={() => cancelNotification(n.id)} disabled={cancellingId === n.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Cancel">
                      {cancellingId === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SENT HISTORY ── */}
      {activeTab === 'sent' && (
        <div className="space-y-3">
          {sent.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
              <History className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No notifications sent yet</p>
            </div>
          ) : sent.map(n => (
            <div key={n.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-white">{n.title}</h3>
                    <span className="text-xs text-gray-500">{n.sent_at ? fmtDt(n.sent_at) : '—'}</span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{n.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <RecipientBadge n={n} plans={plans} />
                    {n.recipient_count != null && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {n.recipient_count} member{n.recipient_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipientBadge({ n, plans }: { n: GymNotification; plans: PlanOption[] }) {
  if (n.recipient_type === 'all') {
    return <span className="text-xs text-gray-500 mt-1.5 block">→ All active members</span>;
  }
  const parts: string[] = [];
  if (n.recipient_filter?.statuses?.length) parts.push(n.recipient_filter.statuses.join(', '));
  if (n.recipient_filter?.plan_ids?.length) {
    const names = n.recipient_filter.plan_ids.map(id => plans.find(p => p.id === id)?.name ?? id);
    parts.push(names.join(', '));
  }
  return <span className="text-xs text-gray-500 mt-1.5 block">→ Filtered: {parts.join(' · ') || '—'}</span>;
}
