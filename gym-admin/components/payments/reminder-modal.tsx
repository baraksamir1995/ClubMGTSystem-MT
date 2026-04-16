'use client';

import { useState } from 'react';
import { X, Mail, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Payment } from '@/app/dashboard/payments/page';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-red-400" />
            <h2 className="text-base font-semibold text-white">Send Overdue Reminders</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {results ? (
          /* Results view */
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <p className="text-sm text-gray-400 mb-4">Reminder sending complete:</p>
            {overduePayments.filter(p => selected.has(p.id) && p.email).map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-700/40 rounded-xl px-4 py-3">
                {results[p.id] === 'sent'
                  ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{p.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{p.email}</p>
                </div>
                <span className={`text-xs font-medium ${results[p.id] === 'sent' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {results[p.id] === 'sent' ? 'Sent' : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Info */}
            <div className="px-5 pt-4 flex-shrink-0">
              <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  {overduePayments.length} member{overduePayments.length !== 1 ? 's' : ''} with overdue payments.
                  {overduePayments.length - withEmail.length > 0 &&
                    ` ${overduePayments.length - withEmail.length} have no email on file.`}
                </p>
              </div>
            </div>

            {/* Member list */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">{selected.size} selected</span>
                <button onClick={toggleAll} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                  {selected.size === withEmail.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-2">
                {overduePayments.map(p => {
                  const hasEmail = !!p.email;
                  return (
                    <label key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                        !hasEmail ? 'border-gray-700 opacity-50 cursor-not-allowed' :
                        selected.has(p.id) ? 'border-red-500/50 bg-red-400/5' : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        disabled={!hasEmail}
                        onChange={() => toggle(p.id)}
                        className="w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500 accent-red-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{p.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{p.email || 'No email on file'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-red-400">{fmt(p.amount, p.currency)}</p>
                        <p className="text-xs text-gray-500">overdue</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              onClick={sendReminders}
              disabled={selected.size === 0 || sending}
              className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : `Send ${selected.size} Reminder${selected.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
