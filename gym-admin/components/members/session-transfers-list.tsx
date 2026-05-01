'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Repeat2 } from 'lucide-react';

interface TransferRow {
  id: string;
  count: number;
  created_at: string;
  other_name: string | null;
  other_photo: string | null;
  other_gym_member_id?: string | null;
}

interface Props {
  gymMemberId: string;
}

/**
 * Shows sessions-transfer history for a member: sent (outbound) and
 * received (inbound). Hidden entirely when the member has no activity.
 */
export default function SessionTransfersList({ gymMemberId }: Props) {
  const [sent, setSent] = useState<TransferRow[]>([]);
  const [received, setReceived] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/members/${gymMemberId}/session-transfers`);
        if (!res.ok) {
          if (!cancelled) setError('Failed to load transfers');
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setSent(json.data?.sent ?? []);
        setReceived(json.data?.received ?? []);
      } catch {
        if (!cancelled) setError('Failed to load transfers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gymMemberId]);

  const totalCount = sent.length + received.length;

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Repeat2 className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Session Transfers</h2>
        </div>
        <p className="text-xs text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Repeat2 className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-white">Session Transfers</h2>
        {totalCount > 0 && (
          <span className="ml-auto text-xs text-gray-500">
            {sent.length} sent · {received.length} received
          </span>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="text-sm text-gray-500">No transfers yet.</p>
      ) : (
        <div className="space-y-2">
          {sent.map((t) => (
            <Row key={t.id} row={t} direction="sent" />
          ))}
          {received.map((t) => (
            <Row key={t.id} row={t} direction="received" />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ row, direction }: { row: TransferRow; direction: 'sent' | 'received' }) {
  const isSent = direction === 'sent';
  const date = new Date(row.created_at);
  const dateStr = isNaN(date.getTime())
    ? row.created_at
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-900/40 border border-gray-700/50">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isSent ? 'bg-amber-400/10' : 'bg-emerald-400/10'
        }`}
      >
        {isSent ? (
          <ArrowUpRight className="w-4 h-4 text-amber-400" />
        ) : (
          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          {isSent ? 'Sent to' : 'Received from'}{' '}
          <span className="font-medium">{row.other_name ?? '—'}</span>
        </p>
        <p className="text-xs text-gray-500">{dateStr}</p>
      </div>
      <div
        className={`text-sm font-semibold flex-shrink-0 ${
          isSent ? 'text-amber-400' : 'text-emerald-400'
        }`}
      >
        {isSent ? '−' : '+'}
        {row.count} {row.count === 1 ? 'session' : 'sessions'}
      </div>
    </div>
  );
}
