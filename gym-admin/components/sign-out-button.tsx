'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';

export default function SignOutButton() {
  const router = useRouter();
  const t = useTranslations('layout');

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
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
