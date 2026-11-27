'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Loader2, LogOut } from 'lucide-react';
import { signOutWithOfflineCleanup } from '@/lib/offline/sign-out';

export default function SignOutButton() {
  const router = useRouter();
  const t = useTranslations('layout');
  const [phase, setPhase] = useState<'idle' | 'syncing' | 'signing_out'>('idle');

  const handleSignOut = async () => {
    if (phase !== 'idle') return;
    // Offline attendance logout policy: sync while the cookie still works, warn
    // about unsynced records, sign out on the server, then wipe cached member
    // data (the outbox stays). Refuses while offline instead of pretending.
    const outcome = await signOutWithOfflineCleanup({
      confirmPending: (count) => window.confirm(t('offlinePendingConfirm', { count })),
      onProgress: setPhase,
    });
    setPhase('idle');
    if (outcome === 'cancelled') return;
    if (outcome === 'offline') {
      toast.error(t('signOutOffline'));
      return;
    }
    router.push('/login');
  };

  const busy = phase !== 'idle';
  return (
    <button
      onClick={handleSignOut}
      role="menuitem"
      aria-busy={busy || undefined}
      disabled={busy}
      className="w-full flex items-center gap-3 px-3 min-h-11 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors text-start disabled:opacity-70"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <LogOut className="w-4 h-4" />}
      <span aria-live="polite">{phase === 'syncing' ? t('signingOutSync') : t('signOut')}</span>
    </button>
  );
}
