'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { Modal, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { salesApi, SalesApiError, fmtDate, labelize, STAGE_LABELS } from './lib';

interface Props {
  context: any;                       // SalesContext — branches
  sources: Array<{ id: string; name: string }>;
  onClose: () => void;
  /** New lead was created (either normally or with force). */
  onCreated: (lead: any) => void;
  /** User chose "View existing" on the duplicate warning. */
  onViewExisting: (leadId: string) => void;
}

/**
 * Create-lead modal. On 409 the server returns the existing lead —
 * we surface an "already exists" panel offering View existing or
 * Create anyway (`force: true`).
 */
export default function NewLeadModal({ context, sources, onClose, onCreated, onViewExisting }: Props) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', source_id: '', branch_id: '',
    interest: '', notes: '',
  });
  const [assignToMe, setAssignToMe] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<any>(null);

  const branches: Array<{ id: string; name: string }> = context?.branches ?? [];
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (force = false) => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await salesApi<{ data: any }>('leads', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          source_id: form.source_id || undefined,
          branch_id: form.branch_id || undefined,
          interest: form.interest.trim() || undefined,
          notes: form.notes.trim() || undefined,
          assign_to_me: assignToMe,
          ...(force ? { force: true } : {}),
        },
      });
      toast.success('Lead created');
      onCreated(res.data);
    } catch (e) {
      if (e instanceof SalesApiError && e.status === 409 && (e.payload as any)?.existing_lead) {
        setDuplicate((e.payload as any).existing_lead);
      } else {
        setError(e instanceof SalesApiError ? e.message : 'Network error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>New lead</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          {error && <p className="text-sm text-danger">{error}</p>}

          {duplicate && (
            <div className="p-3 rounded-xl bg-warning-soft border border-line space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-fg">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                This lead already exists
              </div>
              <p className="text-sm text-fg-muted">
                <span className="font-medium text-fg">{duplicate.name}</span>
                {' · '}<span dir="ltr">{duplicate.phone}</span>
                {duplicate.stage && <> · {STAGE_LABELS[duplicate.stage] ?? labelize(duplicate.stage)}</>}
                {duplicate.created_at && <> · added {fmtDate(duplicate.created_at)}</>}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="secondary" size="sm" onClick={() => onViewExisting(duplicate.id)}>
                  View existing lead
                </Button>
                <Button variant="ghost" size="sm" isLoading={saving} onClick={() => submit(true)}>
                  Create anyway
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
            </Field>
            <Field label="Phone" required hint="Local or international format.">
              <Input inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Source">
              <Select value={form.source_id} onChange={(e) => set('source_id', e.target.value)}>
                <option value="">Unknown</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            {branches.length > 0 && (
              <Field label="Branch">
                <Select value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                  <option value="">—</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Interested in">
              <Input value={form.interest} onChange={(e) => set('interest', e.target.value)}
                placeholder="e.g. group classes, PT" />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          <label className="flex items-center gap-2.5 min-h-11 text-sm text-fg cursor-pointer select-none">
            <input type="checkbox" checked={assignToMe} onChange={(e) => setAssignToMe(e.target.checked)}
              className="w-4 h-4 accent-current" />
            Assign to me
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={() => submit(false)} isLoading={saving}>
          Create lead
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
