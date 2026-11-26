'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { signOutWithOfflineCleanup } from '@/lib/offline/sign-out';

export default function SignOutButton() {
  const router = useRouter();
  const t = useTranslations('layout');

  const handleSignOut = async () => {
    // Offline attendance logout policy runs first (needs the cookie): sync,
    // warn about unsynced records, wipe cached member data, keep the outbox.
    const outcome = await signOutWithOfflineCleanup({
      confirmPending: (count) => window.confirm(t('offlinePendingConfirm', { count })),
    });
    if (outcome === 'cancelled') return;
    router.push('/login');
  };

  return (
    <button
      onClick={handleSignOut}
      role="menuitem"
      className="w-full flex items-center gap-3 px-3 min-h-11 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors text-start"
    >
      <LogOut className="w-4 h-4" />
      {t('signOut')}
    </button>
  );
}
