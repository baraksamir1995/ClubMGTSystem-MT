'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Server result code → translated text (EN/AR); unknown codes fall back to the
 * server's message, then the raw code. AttendanceController::store codes that
 * the backend maps 1:1 are open-ended, hence the fallback.
 */
export function useReasonText() {
  const t = useTranslations('attendance.offline.codes');
  return useCallback(
    (code: string | null | undefined, message?: string | null): string => {
      if (code && t.has(code)) return t(code);
      return message || code || '—';
    },
    [t],
  );
}
