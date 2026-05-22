'use client';

import { useState } from 'react';
import { CalendarPlus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Modal } from '@/components/ui';

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
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-brand" /> Copy Schedule to Next Month</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-3 bg-surface border border-line rounded-xl">
          <div className="text-center">
            <p className="text-xs text-fg-faint uppercase tracking-wide">From</p>
            <p className="text-sm font-semibold text-fg mt-0.5">{sourceLabel}</p>
          </div>
          <div className="text-fg-faint">→</div>
          <div className="text-center">
            <p className="text-xs text-fg-faint uppercase tracking-wide">To</p>
            <p className="text-sm font-semibold text-brand mt-0.5">{targetLabel}</p>
          </div>
        </div>

        {branchName && (
          <p className="text-xs text-fg-muted text-center">
            Branch: <span className="text-fg font-medium">{branchName}</span>
          </p>
        )}

        <ul className="text-xs text-fg-muted space-y-1.5 leading-relaxed">
          <li>· Recurring sessions only — pop-ups and cancelled sessions are skipped.</li>
          <li>· Each weekday&apos;s pattern is copied to the matching weekdays in {targetLabel}.</li>
          <li>· New sessions start as <span className="text-fg">unpublished</span> — review and publish.</li>
          <li>· Each copied series gets a new template, so stopping the new series won&apos;t affect {sourceLabel}.</li>
        </ul>

        {conflict && (
          <div className="flex items-start gap-2 p-3 bg-warning-soft border border-warning/30 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">Target month is not empty</p>
              <p className="text-xs text-fg-muted mt-0.5">
                {targetLabel} already has {conflict.existing} session{conflict.existing === 1 ? '' : 's'}{branchName ? ` for ${branchName}` : ''}.
                Cancel or remove them before copying.
              </p>
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleCopy} disabled={!!conflict} isLoading={loading}
          leftIcon={<CalendarPlus className="w-3.5 h-3.5" />}>
          Copy Schedule
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
