'use client';

import { useState } from 'react';
import { X, CalendarPlus, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  branchId: string | null;
  branchName: string | null;
  onClose: () => void;
  onCopied: () => void;
}

const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

function monthLabel(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return MONTH_FMT.format(d);
}

/**
 * Format an ISO date (YYYY-MM-DD) as "Month YYYY" in UTC, so a server tz of
 * UTC and a client tz east-of-UTC don't disagree about which month it is.
 */
function monthLabelFromIso(iso: string): string {
  return MONTH_FMT.format(new Date(iso + 'T00:00:00Z'));
}

export default function CopyMonthModal({ branchId, branchName, onClose, onCopied }: Props) {
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState<{ existing: number; targetStart: string; targetEnd: string } | null>(null);

  const sourceLabel = monthLabel(0);
  const targetLabel = monthLabel(1);

  const handleCopy = async () => {
    setLoading(true);
    setConflict(null);
    try {
      const res = await fetch('/api/sessions/copy-to-next-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.existing_count != null) {
          setConflict({
            existing: data.existing_count,
            targetStart: data.target_start,
            targetEnd: data.target_end,
          });
        } else {
          toast.error(data.error ?? 'Failed to copy schedule');
        }
        return;
      }
      // Use the backend's resolved target month for the toast — server tz
      // (Postgres CURRENT_DATE) is the source of truth, not local Date().
      const targetMonth = data.target_start ? monthLabelFromIso(data.target_start) : targetLabel;
      toast.success(`Copied ${data.created} sessions across ${data.templates} classes into ${targetMonth}`);
      onCopied();
      onClose();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Copy Schedule to Next Month</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center justify-center gap-3 py-3 bg-gray-900 border border-gray-700 rounded-xl">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">From</p>
              <p className="text-sm font-semibold text-white mt-0.5">{sourceLabel}</p>
            </div>
            <div className="text-gray-600">→</div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">To</p>
              <p className="text-sm font-semibold text-purple-300 mt-0.5">{targetLabel}</p>
            </div>
          </div>

          {branchName && (
            <p className="text-xs text-gray-400 text-center">
              Branch: <span className="text-gray-200 font-medium">{branchName}</span>
            </p>
          )}

          <ul className="text-xs text-gray-400 space-y-1.5 leading-relaxed">
            <li>· Recurring sessions only — pop-ups and cancelled sessions are skipped.</li>
            <li>· Each weekday's pattern is copied to the matching weekdays in {targetLabel}.</li>
            <li>· New sessions start as <span className="text-gray-300">unpublished</span> — review and publish.</li>
            <li>· Each copied series gets a new template, so stopping the new series won't affect {sourceLabel}.</li>
          </ul>

          {conflict && (
            <div className="flex items-start gap-2 p-3 bg-amber-400/10 border border-amber-400/30 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300">Target month is not empty</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {targetLabel} already has {conflict.existing} session{conflict.existing === 1 ? '' : 's'}{branchName ? ` for ${branchName}` : ''}.
                  Cancel or remove them before copying.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button onClick={handleCopy} disabled={loading || !!conflict}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />}
            {loading ? 'Copying…' : 'Copy Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
