'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

interface Props {
  memberId: string;
  memberName: string;
  emailVerified?: boolean;
  onVerified?: () => void;
}

export default function VerifyEmailButton({ memberId, memberName, emailVerified, onVerified }: Props) {
  const t = useTranslations('members.verifyEmail');
  const tc = useTranslations('common');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (emailVerified) return null;

  const handleVerify = async () => {
    const confirmed = window.confirm(
      t('confirmMessage', { name: memberName })
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/members/${memberId}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('toast.failed')); return; }
      toast.success(t('toast.verified'));
      if (onVerified) onVerified();
      else router.refresh();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleVerify}
      disabled={loading}
      title={t('titleAttr')}
      aria-label={t('titleAttr')}
      className="p-1.5 rounded-lg text-fg-faint hover:text-success hover:bg-success-soft transition-colors disabled:opacity-40"
    >
      <MailCheck className="w-4 h-4" aria-hidden />
    </button>
  );
}
