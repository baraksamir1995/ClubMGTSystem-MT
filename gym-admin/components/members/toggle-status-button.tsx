'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserX, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

interface Props {
  memberId: string;
  memberName: string;
  currentStatus: string;
}

export default function ToggleStatusButton({ memberId, memberName, currentStatus }: Props) {
  const t = useTranslations('members.toggleStatus');
  const tc = useTranslations('common');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isActive = currentStatus === 'active';

  const handleToggle = async () => {
    const newStatus = isActive ? 'suspended' : 'active';
    const confirmed = window.confirm(
      isActive
        ? t('confirmDeactivate', { name: memberName })
        : t('confirmReactivate', { name: memberName })
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('toast.failed')); return; }
      toast.success(isActive ? t('toast.deactivated') : t('toast.reactivated'));
      router.refresh();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return isActive ? (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={t('deactivateTitle')}
      className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-40"
    >
      <UserX className="w-4 h-4" />
    </button>
  ) : (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={t('reactivateTitle')}
      className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-40"
    >
      <UserCheck className="w-4 h-4" />
    </button>
  );
}
