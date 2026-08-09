'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Button, Field, Select, Textarea, Input } from '@/components/ui';
import { salesApi, errMsg, LOST_REASONS, labelize } from './lib';

interface Props {
  leadId: string;
  leadName?: string;
  onClose: () => void;
  /** Fires after the lead is marked lost (callers refresh + close). */
  onLost: () => void;
}

/**
 * "Mark as lost" dialog — reason (server enum), optional notes, optional
 * re-engage date (drops the lead into the nurture pool with a wake-up).
 */
export default function LostDialog({ leadId, leadName, onClose, onLost }: Props) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [reengageAt, setReengageAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) { setError('Pick a reason.'); return; }
    setSaving(true);
    setError(null);
    try {
      await salesApi(`leads/${leadId}/lost`, {
        method: 'POST',
        body: {
          reason,
          notes: notes.trim() || undefined,
          reengage_at: reengageAt || undefined,
        },
      });
      toast.success('Lead marked as lost');
      onLost();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="sm">
      <Modal.Header>Mark {leadName ? `“${leadName}”` : 'lead'} as lost</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <Field label="Reason" required error={error}>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select a reason…</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>{labelize(r)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" hint="What happened? Helps the next rep.">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="Re-engage on" hint="Optional — resurfaces the lead from the nurture pool on this date.">
            <Input
              type="date"
              value={reengageAt}
              min={new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA')}
              onChange={(e) => setReengageAt(e.target.value)}
            />
          </Field>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="danger" fullWidth onClick={submit} isLoading={saving}>Mark as lost</Button>
      </Modal.Footer>
    </Modal>
  );
}
