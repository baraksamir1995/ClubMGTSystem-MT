'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ClassSession } from '@/app/dashboard/classes/page';
import { fmt12 } from '@/lib/time';

interface Props {
  session: ClassSession;
  gym: { name: string; logo_url: string | null };
  onClose: () => void;
  onCancelled: (id: string) => void;
}

export default function CancelSessionModal({ session, gym, onClose, onCancelled }: Props) {
  const [reason, setReason]             = useState('');
  const [notify, setNotify]             = useState(true);
  const [bookedCount, setBookedCount]   = useState<number | null>(null);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    // Fetch booked count for this session
    fetch(`/api/sessions/${session.id}/bookings`)
      .then(r => r.json())
      .then(d => setBookedCount(d.count ?? 0))
      .catch(() => setBookedCount(0));
  }, [session.id]);

  const handleCancel = async () => {
    if (!reason.trim()) { toast.error('Please provide a cancellation reason'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), notify, gym }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { toast.error(`Server error: ${text.slice(0, 120)}`); return; }
      if (!res.ok) { toast.error(data.error ?? 'Failed to cancel'); return; }
      toast.success('Session cancelled' + (notify && (bookedCount ?? 0) > 0 ? ' · Members notified' : ''));
      onCancelled(session.id);
      onClose();
    } catch (e: any) { toast.error(e?.message ?? 'Network error'); }
    finally { setLoading(false); }
  };

  const sessionDate = new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-base font-semibold text-white">Cancel Session</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Session info */}
          <div className="bg-gray-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: session.color }} />
              <div>
                <p className="text-white font-semibold">{session.class_name}</p>
                <p className="text-sm text-gray-400 mt-0.5">{sessionDate}</p>
                <p className="text-sm text-gray-400">{fmt12(session.start_time)} – {fmt12(session.end_time)}</p>
                {session.location && <p className="text-xs text-gray-500 mt-1">{session.location}</p>}
              </div>
            </div>

            {/* Booked members count */}
            <div className="mt-3 pt-3 border-t border-gray-600 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              {bookedCount === null
                ? <span className="text-xs text-gray-500">Loading bookings…</span>
                : <span className="text-xs text-gray-400"><span className="text-white font-medium">{bookedCount}</span> member{bookedCount !== 1 ? 's' : ''} booked</span>
              }
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Cancellation Reason <span className="text-red-400">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              rows={3} placeholder="e.g. Instructor unavailable, maintenance..."
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none" />
          </div>

          {/* Notify toggle */}
          {(bookedCount ?? 0) > 0 && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setNotify(n => !n)}
                className={`relative w-10 h-5 rounded-full transition-colors ${notify ? 'bg-purple-600' : 'bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notify ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-300">Notify booked members by email</span>
            </label>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 bg-red-400/10 border border-red-400/20 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">
              This action cannot be undone. The session will be marked as cancelled and removed from the active schedule.
            </p>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Keep Session</button>
          <button onClick={handleCancel} disabled={!reason.trim() || loading}
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cancelling…</> : 'Cancel Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
