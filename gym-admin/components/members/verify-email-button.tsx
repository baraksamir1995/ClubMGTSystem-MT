'use client';

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  memberId: string;
  memberName: string;
  emailVerified?: boolean;
  onVerified?: () => void;
}

export default function VerifyEmailButton({ memberId, memberName, emailVerified, onVerified }: Props) {
  const [loading, setLoading] = useState(false);

  if (emailVerified) return null;

  const handleVerify = async () => {
    const confirmed = window.confirm(
      `Verify email for ${memberName}? This confirms their email address is valid.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/members/${memberId}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to verify email'); return; }
      toast.success('Email verified');
      if (onVerified) onVerified();
      else window.location.reload();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleVerify}
      disabled={loading}
      title="Verify email"
      className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors disabled:opacity-40"
    >
      <MailCheck className="w-4 h-4" />
    </button>
  );
}
