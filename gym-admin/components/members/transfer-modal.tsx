'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Avatar, Button, Field, Input, Modal } from '@/components/ui';

interface Member {
  id: string;
  member_number: string;
  full_name: string | null;
  email: string | null;
}

interface ActiveMembership {
  plan_name: string;
  end_date: string | null;
  sessions_remaining: number | null;
}

interface Props {
  sourceMemberId: string;
  sourceMemberName: string;
  activeMembership: ActiveMembership | null;
  gymMembers: Member[];
  onClose: () => void;
}

export default function TransferModal({
  sourceMemberId,
  sourceMemberName,
  activeMembership,
  gymMembers,
  onClose,
}: Props) {
  const t = useTranslations('members.transfer');
  const tc = useTranslations('common');
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);
  const [step, setStep] = useState<'select' | 'review'>('select');
  const [loading, setLoading] = useState(false);

  const filtered = gymMembers.filter(m => {
    if (m.id === sourceMemberId) return false;
    const q = search.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(q) ||
      String(m.member_number ?? '').toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  });

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${sourceMemberId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination_member_id: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('toast.transferFailed')); return; }
      toast.success(t('toast.transferred'));
      onClose();
      router.refresh();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>{t('title')}</Modal.Header>

      {step === 'select' ? (
        <>
          <Modal.Body className="space-y-4">
            {/* Source */}
            <div className="bg-surface-3/40 rounded-lg p-3 border border-line">
              <p className="text-xs text-fg-faint mb-1">{t('transferringFrom')}</p>
              <p className="text-sm font-medium text-fg">{sourceMemberName}</p>
              {activeMembership ? (
                <p className="text-xs text-brand mt-0.5">{activeMembership.plan_name}</p>
              ) : (
                <p className="text-xs text-danger mt-0.5">{t('noActiveMembership')}</p>
              )}
            </div>

            {/* Search destination */}
            <Field label={t('searchDestination')}>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </Field>

            {/* Member list */}
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-sm text-fg-faint text-center py-4">{t('noMembersFound')}</p>
              )}
              {filtered.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-start transition-colors ${
                    selected?.id === m.id
                      ? 'bg-brand/15 border border-brand'
                      : 'hover:bg-surface-3/50 border border-transparent'
                  }`}
                >
                  <Avatar name={m.full_name ?? m.member_number ?? '?'} size={32} />
                  <div className="min-w-0">
                    <p className="text-sm text-fg font-medium truncate">{m.full_name ?? '—'}</p>
                    <p className="text-xs text-fg-faint truncate">{m.member_number} · {m.email ?? ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" fullWidth onClick={onClose}>{tc('cancel')}</Button>
            <Button
              variant="primary"
              fullWidth
              onClick={() => setStep('review')}
              disabled={!selected || !activeMembership}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {t('review')}
            </Button>
          </Modal.Footer>
        </>
      ) : (
        <>
          <Modal.Body className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-surface-3/40 rounded-lg p-3 border border-line text-center">
                <p className="text-xs text-fg-faint mb-1">{t('from')}</p>
                <p className="text-sm font-medium text-fg">{sourceMemberName}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-brand flex-shrink-0" aria-hidden />
              <div className="flex-1 bg-surface-3/40 rounded-lg p-3 border border-brand/40 text-center">
                <p className="text-xs text-fg-faint mb-1">{t('to')}</p>
                <p className="text-sm font-medium text-fg">{selected?.full_name ?? '—'}</p>
              </div>
            </div>

            <div className="bg-surface-3/40 rounded-lg p-4 border border-line space-y-2">
              <p className="text-xs text-fg-muted font-medium uppercase tracking-wide">{t('membershipBeingTransferred')}</p>
              <p className="text-sm text-fg font-semibold">{activeMembership?.plan_name}</p>
              {activeMembership?.end_date && (
                <div className="flex justify-between">
                  <span className="text-xs text-fg-faint">{t('expiry')}</span>
                  <span className="text-xs text-fg">{new Date(activeMembership.end_date).toLocaleDateString('en-GB')}</span>
                </div>
              )}
              {activeMembership?.sessions_remaining != null && (
                <div className="flex justify-between">
                  <span className="text-xs text-fg-faint">{t('sessionsRemaining')}</span>
                  <span className="text-xs text-fg">{activeMembership.sessions_remaining}</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 bg-warning-soft border border-warning/30 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-warning">
                {t('warningText')}
              </p>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" fullWidth onClick={() => setStep('select')}>{tc('back')}</Button>
            <Button variant="primary" fullWidth onClick={handleConfirm} isLoading={loading}>
              {t('confirmTransfer')}
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
