'use client';

import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import type { ScanCandidate } from '@/lib/offline/front-desk';
import { MemberSummary } from './member-summary';

/** Staff must look at the cached photo + name and confirm before anything is recorded. */
export function ScanConfirmModal({
  candidate,
  busy,
  blockedReason,
  onConfirm,
  onCancel,
}: {
  candidate: ScanCandidate | null;
  busy: boolean;
  blockedReason: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('attendance.frontDesk.scan');
  return (
    <Modal open={!!candidate} onClose={onCancel} size="sm">
      <Modal.Header>{t('confirmTitle')}</Modal.Header>
      <Modal.Body>
        {candidate && (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">{t('confirmHint')}</p>
            <MemberSummary member={candidate.member} memberships={candidate.memberships} asOf={candidate.asOf} large />
            {blockedReason && <p className="text-sm text-warning" role="note">{blockedReason}</p>}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button fullWidth onClick={onConfirm} isLoading={busy} disabled={!!blockedReason} autoFocus>
          {t('confirm')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
