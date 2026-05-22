'use client';

import { useEffect, useState } from 'react';
import { Bell, Send, Clock, History, Plus, Pencil, X, Trash2, Loader2, Users, Filter, CalendarClock, CheckCircle2, Zap, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymNotification, PlanOption } from '@/app/dashboard/notifications/page';
import { can, type Permission } from '@/lib/get-permissions';
import { Badge, Button, Tabs } from '@/components/ui';

interface Props {
  // Notifications are fetched on demand per-tab inside the component (true
  // server-side pagination), so no initial blob is needed from the parent.
  plans: PlanOption[];
  permissions: Permission[] | null;
}

const STATUSES = ['active', 'expired', 'suspended', 'cancelled'] as const;
const PAGE_SIZE = 10;
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

export default function NotificationsPage({ plans, permissions }: Props) {
  const [activeTab,      setActiveTab]      = useState<'compose' | 'scheduled' | 'sent'>('compose');
  const [form,           setForm]           = useState(emptyForm());
  const [sending,        setSending]        = useState(false);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [cancellingId,   setCancellingId]   = useState<string | null>(null);

  // Per-tab server-paged state. Each tab maintains its own page cursor and
  // its own loading flag so switching tabs doesn't clobber the other's
  // data while a fetch is in flight.
  const [scheduledItems, setScheduledItems] = useState<GymNotification[]>([]);
  const [scheduledPage,  setScheduledPage]  = useState(1);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledPages, setScheduledPages] = useState(1);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  const [sentItems,      setSentItems]      = useState<GymNotification[]>([]);
  const [sentPage,       setSentPage]       = useState(1);
  const [sentTotal,      setSentTotal]      = useState(0);
  const [sentPages,      setSentPages]      = useState(1);
  const [sentLoading,    setSentLoading]    = useState(false);

  // Fetch one page for a given status. Caller decides whether to await.
  const loadPage = async (status: 'scheduled' | 'sent', page: number) => {
    const setLoading = status === 'scheduled' ? setScheduledLoading : setSentLoading;
    const setItems   = status === 'scheduled' ? setScheduledItems   : setSentItems;
    const setTotal   = status === 'scheduled' ? setScheduledTotal   : setSentTotal;
    const setPages   = status === 'scheduled' ? setScheduledPages   : setSentPages;
    setLoading(true);
    try {
      const res  = await fetch(`/api/notifications?status=${status}&page=${page}&per_page=${PAGE_SIZE}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? 'Failed to load');
        return;
      }
      const items: GymNotification[] = json?.data ?? [];
      const pag  = json?.pagination ?? {};
      setItems(items);
      setTotal(typeof pag.total === 'number' ? pag.total : items.length);
      setPages(Math.max(1, typeof pag.pages === 'number' ? pag.pages : Math.ceil(items.length / PAGE_SIZE)));
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Lazy-load each tab the first time it's opened, and re-fetch on page change.
  useEffect(() => { if (activeTab === 'scheduled') loadPage('scheduled', scheduledPage); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [activeTab, scheduledPage]);
  useEffect(() => { if (activeTab === 'sent')      loadPage('sent',      sentPage);      /* eslint-disable-line react-hooks/exhaustive-deps */ }, [activeTab, sentPage]);

  const inp = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand';

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
      const saved = notif as GymNotification;

      // Jump to the relevant tab and reset its page to 1 — the most-recent
      // item lives at the top of the list. Setting page to 1 also triggers
      // the lazy-load effect, so the list refetches and shows the new row
      // even on edit (where the existing row's content changed).
      if (form.sendMode === 'now') {
        const count = saved.recipient_count ?? 0;
        toast.success(`Notification sent to ${count} member${count !== 1 ? 's' : ''}!`);
        setActiveTab('sent');
        if (sentPage === 1) loadPage('sent', 1); else setSentPage(1);
      } else {
        toast.success('Notification scheduled');
        setActiveTab('scheduled');
        if (scheduledPage === 1) loadPage('scheduled', 1); else setScheduledPage(1);
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
      toast.success('Notification cancelled');
      // Refresh the scheduled tab — the cancelled row drops out of the
      // status='scheduled' filter so the page count + items both change.
      // The cancelled item ends up under status='cancelled' which we don't
      // currently render, so it just disappears from view (matches old
      // behaviour where the row stayed but greyed out).
      loadPage('scheduled', scheduledPage);
    } catch { toast.error('Network error'); }
    finally { setCancellingId(null); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Communications</h1>
          <p className="text-sm text-fg-muted mt-0.5">Send notifications and announcements to members</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'compose' | 'scheduled' | 'sent')}>
        <Tabs.List>
          <Tabs.Trigger value="compose" icon={Send}>Compose</Tabs.Trigger>
          <Tabs.Trigger value="scheduled" icon={Clock}>
            Scheduled
            {scheduledTotal > 0 && <Badge variant="neutral" size="sm" className="ml-1">{scheduledTotal}</Badge>}
          </Tabs.Trigger>
          <Tabs.Trigger value="sent" icon={History}>Sent History</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {/* ── COMPOSE ── */}
      {activeTab === 'compose' && (
        <div className="space-y-4">
          {editingId && (
            <div className="flex items-center justify-between bg-blue-400/10 border border-blue-400/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400">Editing scheduled notification</span>
              </div>
              <button onClick={cancelEdit} className="text-fg-muted hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Left: Message */}
            <div className="lg:col-span-2 bg-surface-2 border border-line rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-fg">Message</h2>
              </div>
              <div>
                <label className="block text-xs text-fg-muted mb-1.5">Title <span className="text-red-400">*</span></label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Holiday Schedule Change" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-fg-muted mb-1.5">Message <span className="text-red-400">*</span></label>
                <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="Write your message to members…" rows={8}
                  className={inp + ' resize-none'} />
                <p className="text-xs text-fg-faint mt-1">{form.body.length} characters</p>
              </div>
            </div>

            {/* Right: Recipients + Send Time + Button */}
            <div className="space-y-4">
              {/* Recipients */}
              <div className="bg-surface-2 border border-line rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand" />
                  <h2 className="text-sm font-semibold text-fg">Recipients</h2>
                </div>
                <div className="flex flex-col gap-2">
                  {(['all', 'filtered'] as const).map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, recipientType: t }))}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${
                        form.recipientType === t
                          ? 'bg-brand/15 border-brand/40 text-brand'
                          : 'bg-surface border-line text-fg-muted hover:text-fg'
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
                        <Filter className="w-3.5 h-3.5 text-fg-muted" />
                        <label className="text-xs font-medium text-fg-muted">By Status</label>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map(s => (
                          <button key={s} onClick={() => toggleStatus(s)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                              form.filterStatuses.includes(s)
                                ? 'bg-brand/15 border-brand/40 text-brand'
                                : 'bg-surface border-line text-fg-muted hover:text-fg'
                            }`}>
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {plans.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Filter className="w-3.5 h-3.5 text-fg-muted" />
                          <label className="text-xs font-medium text-fg-muted">By Plan</label>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {plans.map(p => (
                            <button key={p.id} onClick={() => togglePlan(p.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                form.filterPlanIds.includes(p.id)
                                  ? 'bg-blue-600/20 border-blue-600/40 text-blue-300'
                                  : 'bg-surface border-line text-fg-muted hover:text-fg'
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
              <div className="bg-surface-2 border border-line rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-brand" />
                  <h2 className="text-sm font-semibold text-fg">Send Time</h2>
                </div>
                <div className="flex flex-col gap-2">
                  {(['now', 'schedule'] as const).map(m => (
                    <button key={m} onClick={() => setForm(p => ({ ...p, sendMode: m }))}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${
                        form.sendMode === m
                          ? 'bg-brand/15 border-brand/40 text-brand'
                          : 'bg-surface border-line text-fg-muted hover:text-fg'
                      }`}>
                      {m === 'now' ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      {m === 'now' ? 'Send Now' : 'Schedule'}
                    </button>
                  ))}
                </div>
                {form.sendMode === 'schedule' && (
                  <div>
                    <label className="block text-xs text-fg-muted mb-1.5">Date & Time <span className="text-red-400">*</span></label>
                    <input type="datetime-local" value={form.scheduledAt}
                      onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                      className={inp + ' [color-scheme:dark]'} />
                  </div>
                )}
              </div>

              {/* Send button */}
              {can(permissions, 'notifications', 'create') && (
                <Button variant="primary" fullWidth onClick={send} isLoading={sending}
                  leftIcon={form.sendMode === 'now' ? <Send className="w-4 h-4" /> : <Clock className="w-4 h-4" />}>
                  {form.sendMode === 'now' ? 'Send Notification' : 'Schedule Notification'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULED ── */}
      {activeTab === 'scheduled' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {scheduledLoading && scheduledItems.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-fg-faint" />
            </div>
          ) : scheduledItems.length === 0 ? (
            <div className="col-span-full bg-surface-2 border border-line rounded-xl p-12 text-center">
              <Clock className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-sm text-fg-muted">No scheduled notifications</p>
              {can(permissions, 'notifications', 'create') && (
                <Button variant="primary" className="mt-4" onClick={() => setActiveTab('compose')} leftIcon={<Plus className="w-4 h-4" />}>Compose New</Button>
              )}
            </div>
          ) : scheduledItems.map(n => (
            <div key={n.id} className="bg-surface-2 border border-line rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded-full">Scheduled</span>
                    <span className="text-xs text-fg-faint flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {n.scheduled_at ? fmtDt(n.scheduled_at) : '—'}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-fg">{n.title}</h3>
                  <p className="text-sm text-fg-muted mt-1 line-clamp-2">{n.body}</p>
                  <RecipientBadge n={n} plans={plans} />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {can(permissions, 'notifications', 'edit') && (
                    <button onClick={() => openEdit(n)}
                      className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {can(permissions, 'notifications', 'delete') && (
                    <button onClick={() => cancelNotification(n.id)} disabled={cancellingId === n.id}
                      className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger-soft transition-colors" title="Cancel">
                      {cancellingId === n.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Pager total={scheduledTotal} page={scheduledPage} pages={scheduledPages} onChange={setScheduledPage} />
        </>
      )}

      {/* ── SENT HISTORY ── */}
      {activeTab === 'sent' && (
        <>
        <div className="space-y-3">
          {sentLoading && sentItems.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-fg-faint" />
            </div>
          ) : sentItems.length === 0 ? (
            <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
              <History className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-sm text-fg-muted">No notifications sent yet</p>
            </div>
          ) : sentItems.map(n => (
            <div key={n.id} className="bg-surface-2 border border-line rounded-xl p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-fg">{n.title}</h3>
                    <span className="text-xs text-fg-faint">{n.sent_at ? fmtDt(n.sent_at) : '—'}</span>
                  </div>
                  <p className="text-sm text-fg-muted line-clamp-2">{n.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <RecipientBadge n={n} plans={plans} />
                    {n.recipient_count != null && (
                      <span className="text-xs text-fg-faint flex items-center gap-1">
                        <Users className="w-3 h-3" /> {n.recipient_count} member{n.recipient_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Pager total={sentTotal} page={sentPage} pages={sentPages} onChange={setSentPage} />
        </>
      )}
    </div>
  );
}

/**
 * Compact pager — hidden when the list fits on a single page so the layout
 * stays clean for gyms with under PAGE_SIZE notifications. Renders prev /
 * next arrows + a "Page X of Y · N total" indicator.
 */
function Pager({ total, page, pages, onChange }: {
  total: number; page: number; pages: number; onChange: (p: number) => void;
}) {
  if (pages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end   = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-fg-faint">
        Showing <span className="text-fg-muted">{start}–{end}</span> of <span className="text-fg-muted">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-fg-muted px-2 tabular-nums">
          Page {page} of {pages}
        </span>
        <button
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RecipientBadge({ n, plans }: { n: GymNotification; plans: PlanOption[] }) {
  if (n.recipient_type === 'all') {
    return <span className="text-xs text-fg-faint mt-1.5 block">→ All active members</span>;
  }
  const parts: string[] = [];
  if (n.recipient_filter?.statuses?.length) parts.push(n.recipient_filter.statuses.join(', '));
  if (n.recipient_filter?.plan_ids?.length) {
    const names = n.recipient_filter.plan_ids.map(id => plans.find(p => p.id === id)?.name ?? id);
    parts.push(names.join(', '));
  }
  return <span className="text-xs text-fg-faint mt-1.5 block">→ Filtered: {parts.join(' · ') || '—'}</span>;
}
