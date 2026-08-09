'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-danger font-semibold">{t('somethingWrong')}</p>
      <p className="text-fg-muted text-sm max-w-xl text-center">
        {t('errors.unknown')}
        {error.digest ? (
          <span className="block mt-1 text-xs font-mono text-fg-muted/70">ref: {error.digest}</span>
        ) : null}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-brand text-brand-ink text-sm rounded-lg hover:bg-brand-dim"
      >
        {t('tryAgain')}
      </button>
    </div>
  );
}
