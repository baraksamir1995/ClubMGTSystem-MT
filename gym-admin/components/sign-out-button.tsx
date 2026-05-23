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
      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-start"
    >
      <LogOut className="w-4 h-4" />
      {t('signOut')}
    </button>
  );
}
