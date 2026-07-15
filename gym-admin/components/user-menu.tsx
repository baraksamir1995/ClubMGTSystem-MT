'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleUserRound } from 'lucide-react';
import LanguageSwitcher from './language-switcher';
import SignOutButton from './sign-out-button';

/**
 * UserMenu — avatar button in the dashboard header that opens a dropdown
 * with the signed-in user's identity, the language switcher, and sign out.
 * Closes on outside click and Escape.
 */
export default function UserMenu({ name, email }: { name: string; email: string }) {
  const t = useTranslations('layout');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('accountMenu')}
        title={name || email}
        className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors"
      >
        <CircleUserRound className="w-5 h-5" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full mt-1 w-64 rounded-xl border border-line bg-surface-2 shadow-lg p-2 z-50"
        >
          <div className="px-3 py-2 border-b border-line mb-1">
            <p className="text-xs font-medium text-fg truncate">{name}</p>
            <p className="text-xs text-fg-faint truncate">{email}</p>
          </div>
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
