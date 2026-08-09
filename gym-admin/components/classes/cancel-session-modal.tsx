'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { ClassSession } from '@/app/dashboard/classes/page';
import { fmt12 } from '@/lib/time';
import { Button, Modal, Textarea } from '@/components/ui';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';

interface Props {
  session: ClassSession;
  gym: { name: string; logo_url: string | null };
  onClose: () => void;
  onCancelled: (id: string) => void;
}

export default function CancelSessionModal({ session, gym, onClose, onCancelled }: Props) {
  const t = useTranslations('classes');
  const tErr = useTranslations('common.errors');
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
    if (!reason.trim()) { toast.error(t('cancelModal.reasonRequired')); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), notify, gym }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { toast.error(apiErrorMessage(null, res.status, tErr)); return; }
      if (!res.ok) { toast.error(apiErrorMessage(data, res.status, tErr)); return; }
      toast.success(notify && (bookedCount ?? 0) > 0 ? t('cancelModal.cancelSuccessNotified') : t('cancelModal.cancelSuccess'));
      onCancelled(session.id);
      onClose();
    } catch { toast.error(networkErrorMessage(tErr)); }
    finally { setLoading(false); }
  };

  const sessionDate = new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><AlertTriangle aria-hidden className="w-4 h-4 text-danger" /> {t('cancelModal.title')}</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Session info */}
        <div className="bg-surface-3/50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ backgroundColor: session.color }} />
            <div>
              <p className="text-fg font-semibold">{session.class_name}</p>
              <p className="text-sm text-fg-muted mt-0.5">{sessionDate}</p>
              <p className="text-sm text-fg-muted">{fmt12(session.start_time)} – {fmt12(session.end_time)}</p>
              {session.location && <p className="text-xs text-fg-faint mt-1">{session.location}</p>}
            </div>
          </div>

          {/* Booked members count */}
          <div className="mt-3 pt-3 border-t border-line flex items-center gap-2">
            <Users aria-hidden className="w-3.5 h-3.5 text-fg-muted" />
            {bookedCount === null
              ? <span className="text-xs text-fg-faint">{t('cancelModal.loadingBookings')}</span>
              : <span className="text-xs text-fg-muted">
                  <span className="text-fg font-medium">{bookedCount}</span>{' '}
                  {bookedCount !== 1 ? t('cancelModal.membersBookedPlural') : t('cancelModal.membersBooked')}
                </span>
            }
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('cancelModal.labelReason')} <span className="text-danger">*</span></label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)}
            rows={3} placeholder={t('cancelModal.reasonPlaceholder')}
            className="resize-none" />
        </div>

        {/* Notify toggle */}
        {(bookedCount ?? 0) > 0 && (
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={notify}
              aria-label={t('cancelModal.notifyMembers')}
              onClick={() => setNotify(n => !n)}
              className={`relative w-10 h-5 rounded-full transition-colors ${notify ? 'bg-brand' : 'bg-surface-4'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notify ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-fg-muted">{t('cancelModal.notifyMembers')}</span>
          </label>
        )}

        {/* Warning */}
        <div className="flex items-start gap-2 bg-danger-soft border border-danger/20 rounded-xl p-3">
          <AlertTriangle aria-hidden className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-xs text-danger">
            {t('cancelModal.warning')}
          </p>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{t('cancelModal.keepSession')}</Button>
        <Button variant="danger" fullWidth onClick={handleCancel} disabled={!reason.trim()} isLoading={loading}>
          {t('cancelModal.cancelSession')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
