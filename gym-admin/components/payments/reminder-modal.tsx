'use client';

import { useState } from 'react';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Payment } from '@/app/dashboard/payments/page';
import { Button, Modal } from '@/components/ui';

interface Props {
  overduePayments: Payment[];
  gym: { name: string; logo_url: string | null };
  onClose: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

export default function ReminderModal({ overduePayments, gym, onClose }: Props) {
  const withEmail = overduePayments.filter(p => p.email);
  const [selected, setSelected] = useState<Set<string>>(new Set(withEmail.map(p => p.id)));
  const [sending, setSending]   = useState(false);
  const [results, setResults]   = useState<Record<string, 'sent' | 'failed'> | null>(null);

  const toggle = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(prev => prev.size === withEmail.length ? new Set() : new Set(withEmail.map(p => p.id)));

  const sendReminders = async () => {
    const targets = overduePayments.filter(p => selected.has(p.id) && p.email);
    if (targets.length === 0) return;
    setSending(true);
    try {
      const res = await fetch('/api/payments/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIds: targets.map(p => p.id), gym }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to send'); return; }
      setResults(data.results);
      const sent = Object.values(data.results).filter(v => v === 'sent').length;
      toast.success(`Reminder sent to ${sent} member${sent !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Network error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><Mail className="w-4 h-4 text-danger" /> Send Overdue Reminders</span>
      </Modal.Header>

      {results ? (
        /* Results view */
        <Modal.Body className="space-y-3">
          <p className="text-sm text-fg-muted mb-4">Reminder sending complete:</p>
          {overduePayments.filter(p => selected.has(p.id) && p.email).map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-surface-3/40 rounded-xl px-4 py-3">
              {results[p.id] === 'sent'
                ? <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm text-fg font-medium truncate">{p.full_name}</p>
                <p className="text-xs text-fg-muted truncate">{p.email}</p>
              </div>
              <span className={`text-xs font-medium ${results[p.id] === 'sent' ? 'text-success' : 'text-danger'}`}>
                {results[p.id] === 'sent' ? 'Sent' : 'Failed'}
              </span>
            </div>
          ))}
        </Modal.Body>
      ) : (
        <Modal.Body className="space-y-3">
          {/* Info */}
          <div className="bg-danger-soft border border-danger/20 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-danger">
              {overduePayments.length} member{overduePayments.length !== 1 ? 's' : ''} with overdue payments.
              {overduePayments.length - withEmail.length > 0 &&
                ` ${overduePayments.length - withEmail.length} have no email on file.`}
            </p>
          </div>

          {/* Member list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-fg-muted">{selected.size} selected</span>
              <button onClick={toggleAll} className="text-xs text-brand hover:text-brand-dim transition-colors">
                {selected.size === withEmail.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2">
              {overduePayments.map(p => {
                const hasEmail = !!p.email;
                return (
                  <label key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                      !hasEmail ? 'border-line opacity-50 cursor-not-allowed' :
                      selected.has(p.id) ? 'border-danger/50 bg-danger-soft' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      disabled={!hasEmail}
                      onChange={() => toggle(p.id)}
                      className="w-4 h-4 rounded border-line accent-danger focus:ring-danger"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-fg-muted truncate">{p.email || 'No email on file'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-danger">{fmt(p.amount, p.currency)}</p>
                      <p className="text-xs text-fg-faint">overdue</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </Modal.Body>
      )}

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{results ? 'Close' : 'Cancel'}</Button>
        {!results && (
          <Button variant="danger" fullWidth onClick={sendReminders} disabled={selected.size === 0} isLoading={sending}>
            Send {selected.size} Reminder{selected.size !== 1 ? 's' : ''}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
