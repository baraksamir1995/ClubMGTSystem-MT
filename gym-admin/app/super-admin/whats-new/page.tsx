'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Eye, Send, EyeOff, Megaphone, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, DataTable, EmptyState, Modal } from '@/components/ui';
import { apiErrorMessage, networkErrorMessage, responseErrorMessage } from '@/lib/api-error';
import AnnouncementForm, { type GymOption } from '@/components/whats-new/announcement-form';
import AnnouncementDialog from '@/components/whats-new/announcement-dialog';
import type { AdminAnnouncement } from '@/lib/types/announcement';

/**
 * Super-admin "What's New" management.
 *
 * Publish/unpublish are their own endpoints rather than a status field on
 * the save payload, so toggling a live announcement off can't be confused
 * with an unsaved edit.
 */
export default function WhatsNewPage() {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [previewing, setPreviewing] = useState<AdminAnnouncement | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminAnnouncement | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/announcements');
      if (!res.ok) {
        toast.error(`Couldn't load updates — ${await responseErrorMessage(res)}`);
        return;
      }
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      toast.error(networkErrorMessage());
    } finally {
      setLoading(false);
    }
  }, []);

  // The gym list only feeds the targeting picker, so a failure here
  // shouldn't block the page — the form falls back to an empty list and
  // the "select at least one gym" guard still holds.
  const fetchGyms = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/gyms');
      if (!res.ok) return;
      const json = await res.json();
      const rows: GymOption[] = (json.data ?? []).map((g: { id: string; name: string }) => ({
        id: g.id, name: g.name,
      }));
      setGyms(rows);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { void fetchAll(); void fetchGyms(); }, [fetchAll, fetchGyms]);

  const gymNames = useMemo(
    () => new Map(gyms.map(g => [g.id, g.name])),
    [gyms],
  );

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (row: AdminAnnouncement) => { setEditing(row); setShowForm(true); };

  const handleSaved = (saved: AdminAnnouncement) => {
    setItems(prev => {
      const exists = prev.some(a => a.id === saved.id);
      return exists ? prev.map(a => a.id === saved.id ? saved : a) : [saved, ...prev];
    });
    setShowForm(false);
    setEditing(null);
  };

  const togglePublish = async (row: AdminAnnouncement) => {
    const action = row.status === 'published' ? 'unpublish' : 'publish';
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/super-admin/announcements/${row.id}/${action}`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(`Couldn't ${action} — ${apiErrorMessage(json, res.status)}`);
        return;
      }
      setItems(prev => prev.map(a => a.id === row.id ? json.data : a));
      toast.success(action === 'publish' ? 'Update published' : 'Update unpublished');
    } catch {
      toast.error(networkErrorMessage());
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: AdminAnnouncement) => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/super-admin/announcements/${row.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(`Couldn't delete — ${apiErrorMessage(json, res.status)}`);
        return;
      }
      setItems(prev => prev.filter(a => a.id !== row.id));
      toast.success('Update deleted');
      setConfirmDelete(null);
    } catch {
      toast.error(networkErrorMessage());
    } finally {
      setBusyId(null);
    }
  };

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : '—';

  const statusBadge = (row: AdminAnnouncement) => {
    if (row.status === 'draft') return <Badge variant="neutral">Draft</Badge>;
    if (row.is_scheduled) return <Badge variant="warning">Scheduled</Badge>;
    if (row.is_expired) return <Badge variant="danger">Expired</Badge>;
    return <Badge variant="success">Live</Badge>;
  };

  const audienceLabel = (row: AdminAnnouncement) => {
    if (row.audience === 'all') return 'All gyms';
    if (row.gym_ids.length === 1) {
      return gymNames.get(row.gym_ids[0]) ?? '1 gym';
    }
    return `${row.gym_ids.length} gyms`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">What&apos;s New</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            Product updates shown in gym admin dashboards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchAll()}
            leftIcon={<RefreshCw className="w-4 h-4" aria-hidden />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={openCreate}
            leftIcon={<Plus className="w-4 h-4" aria-hidden />}
          >
            Create Update
          </Button>
        </div>
      </header>

      <DataTable
        rows={items}
        rowKey={row => row.id}
        loading={loading}
        empty={
          <EmptyState
            icon={Megaphone}
            title="No updates yet"
            description="Create your first product update to announce a new feature to gyms."
            action={<Button variant="primary" onClick={openCreate}>Create Update</Button>}
          />
        }
        columns={[
          {
            key: 'title',
            header: 'Title',
            cell: row => (
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{row.title}</p>
                <p className="text-xs text-fg-faint truncate">{row.excerpt}</p>
              </div>
            ),
          },
          { key: 'status', header: 'Status', cell: statusBadge },
          {
            key: 'audience',
            header: 'Audience',
            hideOnMobile: true,
            cell: row => <span className="text-sm text-fg-muted">{audienceLabel(row)}</span>,
          },
          {
            key: 'published',
            header: 'Published',
            hideOnMobile: true,
            cell: row => <span className="text-sm text-fg-muted">{fmtDate(row.published_at)}</span>,
          },
          {
            key: 'expires',
            header: 'Expires',
            hideOnMobile: true,
            cell: row => <span className="text-sm text-fg-muted">{fmtDate(row.expires_at)}</span>,
          },
          {
            key: 'reads',
            header: 'Reads',
            align: 'right',
            hideOnMobile: true,
            cell: row => <span className="text-sm text-fg-muted tabular-nums">{row.reads_count}</span>,
          },
          {
            key: 'author',
            header: 'Created by',
            hideOnMobile: true,
            cell: row => <span className="text-sm text-fg-muted truncate">{row.author_name ?? '—'}</span>,
          },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right',
            cell: row => (
              <div className="flex items-center justify-end gap-1">
                <IconAction label="Preview" onClick={() => setPreviewing(row)}>
                  <Eye className="w-4 h-4" aria-hidden />
                </IconAction>
                <IconAction label="Edit" onClick={() => openEdit(row)}>
                  <Pencil className="w-4 h-4" aria-hidden />
                </IconAction>
                <IconAction
                  label={row.status === 'published' ? 'Unpublish' : 'Publish'}
                  disabled={busyId === row.id}
                  onClick={() => void togglePublish(row)}
                >
                  {row.status === 'published'
                    ? <EyeOff className="w-4 h-4" aria-hidden />
                    : <Send className="w-4 h-4" aria-hidden />}
                </IconAction>
                <IconAction
                  label="Delete"
                  danger
                  disabled={busyId === row.id}
                  onClick={() => setConfirmDelete(row)}
                >
                  <Trash2 className="w-4 h-4" aria-hidden />
                </IconAction>
              </div>
            ),
          },
        ]}
      />

      {/* Create / edit */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        size="xl"
        // A half-written announcement shouldn't vanish because a click
        // landed outside the panel.
        closeOnBackdrop={false}
      >
        <Modal.Header>{editing ? 'Edit update' : 'Create update'}</Modal.Header>
        <Modal.Body>
          <AnnouncementForm
            announcement={editing}
            gyms={gyms}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </Modal.Body>
      </Modal>

      {/* Preview — the same dialog gyms see */}
      {previewing && (
        <AnnouncementDialog
          preview
          onClose={() => setPreviewing(null)}
          announcement={{
            ...previewing,
            is_read: false,
            read_at: null,
            dismissed_at: null,
          }}
        />
      )}

      {/* Delete confirmation */}
      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} size="sm">
        <Modal.Header>Delete update</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-fg-muted">
            Delete <span className="text-fg font-medium">{confirmDelete?.title}</span>? This
            removes it from every gym&apos;s What&apos;s New history and cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="danger"
            fullWidth
            isLoading={busyId === confirmDelete?.id}
            onClick={() => confirmDelete && void handleDelete(confirmDelete)}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

/** Compact icon button for the actions column. */
function IconAction({
  label, onClick, children, danger, disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus
        ${danger
          ? 'text-fg-muted hover:text-danger hover:bg-danger-soft'
          : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}
    >
      {children}
    </button>
  );
}
