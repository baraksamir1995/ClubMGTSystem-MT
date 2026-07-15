'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  memberId: string;
  memberName: string;
}

export default function DeleteMemberButton({ memberId, memberName }: Props) {
  const t = useTranslations('members.delete');
  const tc = useTranslations('common');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      t('confirmMessage', { name: memberName })
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/members/${memberId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? t('toast.failed'));
        return;
      }

      toast.success(t('toast.removed', { name: memberName }));
      router.refresh();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      title={t('titleAttr')}
      aria-label={t('titleAttr')}
      className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Trash2 className="w-4 h-4" aria-hidden />
    </button>
  );
}
