'use client';

import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { LOCALE_COOKIE } from '@/i18n/config';

/**
 * Two-locale toggle (English ⇄ العربية). Writes the `locale` cookie that
 * i18n/request.ts reads, then does a full reload so the server re-renders
 * with the new locale AND the <html dir> flips cleanly to/from RTL.
 *
 * A hard reload (vs router.refresh) is intentional: the direction change is
 * a document-level attribute and toggling is rare, so correctness beats the
 * tiny flash.
 */
export default function LanguageSwitcher() {
  const locale = useLocale();
  const next = locale === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? 'العربية' : 'English';

  const switchTo = () => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  return (
    <button
      onClick={switchTo}
      role="menuitem"
      className="w-full flex items-center gap-3 px-3 min-h-11 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors"
    >
      <Languages className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-start">{label}</span>
    </button>
  );
}
