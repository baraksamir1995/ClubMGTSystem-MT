'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';

interface Props {
  memberId: string;
  memberName: string;
}

export default function DeleteMemberButton({ memberId, memberName }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${memberName}" from this gym? This action cannot be undone.`
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/members/${memberId}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete member');
        return;
      }

      toast.success(`${memberName} has been removed`);
      window.location.reload();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Remove member"
      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
