'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserX, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  memberId: string;
  memberName: string;
  currentStatus: string;
}

export default function ToggleStatusButton({ memberId, memberName, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isActive = currentStatus === 'active';

  const handleToggle = async () => {
    const action = isActive ? 'deactivate' : 'reactivate';
    const newStatus = isActive ? 'suspended' : 'active';
    const confirmed = window.confirm(
      `${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${memberName}? ${
        action === 'deactivate'
          ? 'Their data will be preserved and can be reactivated later.'
          : 'They will regain active member status.'
      }`
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
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success(`Member ${action}d`);
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return isActive ? (
    <button
      onClick={handleToggle}
      disabled={loading}
      title="Deactivate member"
      className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-40"
    >
      <UserX className="w-4 h-4" />
    </button>
  ) : (
    <button
      onClick={handleToggle}
      disabled={loading}
      title="Reactivate member"
      className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-40"
    >
      <UserCheck className="w-4 h-4" />
    </button>
  );
}
