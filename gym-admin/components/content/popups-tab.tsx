'use client';

import { useState, useRef } from 'react';
import {
  Plus, Trash2, Loader2, Eye, EyeOff, Pencil, Check, X,
  Smartphone, ExternalLink, ChevronDown, ChevronUp, ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymPopup } from '@/app/dashboard/content/page';
import { can, type Permission } from '@/lib/get-permissions';
import { Button } from '@/components/ui';

interface Props {
  initialPopups: GymPopup[];
  permissions: Permission[] | null;
}

type ActionType = 'none' | 'internal' | 'external_link';

const ACTION_LABELS: Record<ActionType, string> = {
  none:          'No action',
  external_link: 'Open URL',
  internal:      'Deep link to screen',
};

const INTERNAL_SCREENS = [
  { value: 'schedule',    label: 'Classes / Schedule' },
  { value: 'membership',  label: 'Memberships' },
  { value: 'trainers',    label: 'Trainers' },
  { value: 'billing',     label: 'Payments' },
  { value: 'offers',      label: 'Offers' },
  { value: 'checkin',     label: 'Check-in' },
  { value: 'profile',     label: 'Profile' },
];

interface PopupForm {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaActionType: ActionType;
  ctaActionValue: string;
  priority: string;
}

const emptyForm = (): PopupForm => ({
  title: '', subtitle: '', ctaLabel: '',
  ctaActionType: 'none', ctaActionValue: '', priority: '0',
});

export default function PopupsTab({ initialPopups, permissions }: Props) {
  const [popups,     setPopups]     = useState<GymPopup[]>(initialPopups);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState<PopupForm>(emptyForm());
  const [showForm,   setShowForm]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editForm,   setEditForm]   = useState<Partial<PopupForm>>({});
  const [savingId,   setSavingId]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // ─── Create ────────────────────────────────────────────────────────────────
  const create = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title',          form.title.trim());
      fd.append('subtitle',       form.subtitle);
      fd.append('ctaLabel',       form.ctaLabel);
      fd.append('ctaActionType',  form.ctaActionType);
      fd.append('ctaActionValue', form.ctaActionType === 'none' ? '' : form.ctaActionValue);
      fd.append('priority',       form.priority);
      if (pendingFile) fd.append('file', pendingFile);

      const res  = await fetch('/api/content/popups', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create'); return; }
      setPopups(prev => [data.popup, ...prev]);
      setForm(emptyForm());
      setPendingFile(null);
      setShowForm(false);
      toast.success('Pop-up created');
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  // ─── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (popup: GymPopup) => {
    setTogglingId(popup.id);
    try {
      const res  = await fetch(`/api/content/popups/${popup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !popup.is_active }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setPopups(prev => prev.map(p => p.id === popup.id ? data.popup : p));
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

  // ─── Inline edit ──────────────────────────────────────────────────────────
  const startEdit = (popup: GymPopup) => {
    setEditingId(popup.id);
    setEditForm({
      title:          popup.title,
      subtitle:       popup.subtitle        ?? '',
      ctaLabel:       popup.cta_label       ?? '',
      ctaActionType:  (popup.cta_action_type as ActionType) ?? 'none',
      ctaActionValue: popup.cta_action_value ?? '',
      priority:       String(popup.priority ?? 0),
    });
  };

  const saveEdit = async (popup: GymPopup) => {
    const ef = editForm as PopupForm;
    if (!ef.title?.trim()) { toast.error('Title is required'); return; }
    setSavingId(popup.id);
    try {
      const res = await fetch(`/api/content/popups/${popup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:          ef.title.trim(),
          subtitle:       ef.subtitle       || null,
          ctaLabel:       ef.ctaLabel       || null,
          ctaActionType:  ef.ctaActionType,
          ctaActionValue: ef.ctaActionType === 'none' ? null : (ef.ctaActionValue || null),
          priority:       parseInt(ef.priority ?? '0', 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      setPopups(prev => prev.map(p => p.id === popup.id ? data.popup : p));
      setEditingId(null);
      toast.success('Pop-up updated');
    } catch { toast.error('Network error'); }
    finally { setSavingId(null); }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const deletePopup = async (popup: GymPopup) => {
    if (!confirm('Delete this pop-up?')) return;
    setDeletingId(popup.id);
    try {
      const res = await fetch(`/api/content/popups/${popup.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setPopups(prev => prev.filter(p => p.id !== popup.id));
      toast.success('Pop-up deleted');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  const sortedPopups = [...popups].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return (
    <div className="space-y-6">

      {/* ── Create form ────────────────────────────────────────────────────── */}
      {can(permissions, 'content', 'create') && (
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          <button
            onClick={() => setShowForm(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-fg hover:bg-surface-3 transition-colors">
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand" />
              Add New Pop-up
            </span>
            {showForm ? <ChevronUp className="w-4 h-4 text-fg-muted" /> : <ChevronDown className="w-4 h-4 text-fg-muted" />}
          </button>

          {showForm && (
            <div className="px-5 pb-5 space-y-3 border-t border-line pt-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title *"
                  className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand"
                />
                <input
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  type="number"
                  placeholder="Priority (higher = shown first)"
                  className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand"
                />
              </div>

              <textarea
                value={form.subtitle}
                onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                placeholder="Subtitle / description (optional)"
                rows={2}
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand resize-none"
              />

              <input
                value={form.ctaLabel}
                onChange={e => setForm(f => ({ ...f, ctaLabel: e.target.value }))}
                placeholder="CTA button text (e.g. Claim offer, Book now)"
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={form.ctaActionType}
                  onChange={e => setForm(f => ({ ...f, ctaActionType: e.target.value as ActionType, ctaActionValue: '' }))}
                  className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand">
                  {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>

                {form.ctaActionType === 'external_link' && (
                  <input
                    value={form.ctaActionValue}
                    onChange={e => setForm(f => ({ ...f, ctaActionValue: e.target.value }))}
                    placeholder="https://example.com"
                    className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand"
                  />
                )}
                {form.ctaActionType === 'internal' && (
                  <select
                    value={form.ctaActionValue}
                    onChange={e => setForm(f => ({ ...f, ctaActionValue: e.target.value }))}
                    className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand">
                    <option value="">Select screen…</option>
                    {INTERNAL_SCREENS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Image picker */}
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.target.value = ''; }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-3 hover:bg-surface-4 text-fg-muted text-sm rounded-lg transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  {pendingFile ? pendingFile.name : 'Choose image (optional)'}
                </button>
                {pendingFile && (
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    className="text-fg-faint hover:text-fg-muted transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <Button variant="primary" onClick={create} isLoading={saving} leftIcon={<Plus className="w-4 h-4" />}>
                Create Pop-up
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Pop-up list ────────────────────────────────────────────────────── */}
      {sortedPopups.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <Smartphone className="w-10 h-10 text-fg-faint mx-auto mb-3" />
          <p className="text-sm text-fg-muted">No pop-ups yet — add one above</p>
          <p className="text-xs text-fg-faint mt-1">
            Active pop-ups appear on app open after the splash screen
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPopups.map(popup => {
            const isEditing = editingId === popup.id;
            const ef = editForm as PopupForm;

            return (
              <div
                key={popup.id}
                className={`bg-surface-2 border rounded-xl overflow-hidden transition-opacity ${
                  popup.is_active ? "border-line" : "border-line opacity-60"
                }`}>
                <div className="flex gap-0">

                  {/* Thumbnail or placeholder */}
                  <div className="relative flex-shrink-0 w-28 h-24 sm:w-36 sm:h-28 bg-surface flex items-center justify-center">
                    {popup.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded popup image on external host
                      <img
                        src={popup.image_url}
                        alt={popup.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Smartphone className="w-8 h-8 text-fg-faint" />
                    )}
                    {popup.is_active && (
                      <span className="absolute top-1.5 left-1.5 text-xs bg-green-500/90 text-fg px-1.5 py-0.5 rounded-full font-medium">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={ef.title}
                            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Title *"
                            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand"
                          />
                          <input
                            value={ef.priority}
                            onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                            type="number"
                            placeholder="Priority"
                            className="bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand"
                          />
                        </div>
                        <textarea
                          value={ef.subtitle}
                          onChange={e => setEditForm(f => ({ ...f, subtitle: e.target.value }))}
                          placeholder="Subtitle (optional)"
                          rows={2}
                          className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand resize-none"
                        />
                        <input
                          value={ef.ctaLabel}
                          onChange={e => setEditForm(f => ({ ...f, ctaLabel: e.target.value }))}
                          placeholder="CTA button text"
                          className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand"
                        />
                        <div className="flex gap-2">
                          <select
                            value={ef.ctaActionType}
                            onChange={e => setEditForm(f => ({ ...f, ctaActionType: e.target.value as ActionType, ctaActionValue: '' }))}
                            className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-brand">
                            {(Object.entries(ACTION_LABELS) as [ActionType, string][]).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                          {ef.ctaActionType === 'external_link' && (
                            <input
                              value={ef.ctaActionValue}
                              onChange={e => setEditForm(f => ({ ...f, ctaActionValue: e.target.value }))}
                              placeholder="https://…"
                              className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand"
                            />
                          )}
                          {ef.ctaActionType === 'internal' && (
                            <select
                              value={ef.ctaActionValue}
                              onChange={e => setEditForm(f => ({ ...f, ctaActionValue: e.target.value }))}
                              className="flex-1 bg-surface border border-line rounded-lg px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:border-brand">
                              <option value="">Select screen…</option>
                              {INTERNAL_SCREENS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-fg truncate">{popup.title}</p>
                        {popup.subtitle && (
                          <p className="text-xs text-fg-muted mt-0.5 line-clamp-2">{popup.subtitle}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {popup.cta_label && (
                            <span className="text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                              {popup.cta_label}
                            </span>
                          )}
                          <CtaActionBadge type={popup.cta_action_type as ActionType} value={popup.cta_action_value} />
                          <span className="text-xs text-fg-faint">Priority: {popup.priority ?? 0}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col items-center justify-center gap-1.5 px-3 border-l border-line">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(popup)}
                          disabled={savingId === popup.id}
                          title="Save"
                          className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/40 text-green-400 transition-colors">
                          {savingId === popup.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          title="Cancel"
                          className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {can(permissions, 'content', 'edit') && (
                          <button
                            onClick={() => startEdit(popup)}
                            title="Edit"
                            className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {can(permissions, 'content', 'edit') && (
                          <button
                            onClick={() => toggleActive(popup)}
                            disabled={togglingId === popup.id}
                            title={popup.is_active ? 'Deactivate' : 'Activate'}
                            className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-muted transition-colors">
                            {togglingId === popup.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : popup.is_active
                                ? <EyeOff className="w-4 h-4" />
                                : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                        {can(permissions, 'content', 'delete') && (
                          <button
                            onClick={() => deletePopup(popup)}
                            disabled={deletingId === popup.id}
                            title="Delete"
                            className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors">
                            {deletingId === popup.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </>
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

function CtaActionBadge({ type, value }: { type: ActionType; value: string | null }) {
  if (type === 'external_link') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
        <ExternalLink className="w-3 h-3" />
        {value ? <span className="max-w-[100px] truncate">{value}</span> : 'URL not set'}
      </span>
    );
  }
  if (type === 'internal') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-brand/15 text-brand px-2 py-0.5 rounded-full border border-brand/20">
        <Smartphone className="w-3 h-3" />
        {value || 'Screen not set'}
      </span>
    );
  }
  return <span className="text-xs text-fg-faint">No action</span>;
}
