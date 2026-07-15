'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';
import { useTranslations } from 'next-intl';

export default function MemberDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('members.detail');
  const tc = useTranslations('common');

  useEffect(() => {
    console.error('[MemberDetail] page error:', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/members"
        className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition-colors"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden /> {t('breadcrumb')}
      </Link>

      <div className="bg-surface-2 border border-danger/30 rounded-xl p-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="w-10 h-10 text-danger" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-fg mb-1">{t('errorTitle')}</h2>
          <p className="text-sm text-fg-muted">
            {t('errorDesc')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" onClick={reset}>{tc('tryAgain')}</Button>
          <Link href="/dashboard/members">
            <Button variant="secondary">{t('backToMembers')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
