'use client';

import { useState } from 'react';
import { Dumbbell, Salad, HeartPulse, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui';
import { useTranslations } from 'next-intl';

const PAGE_SIZE = 5;

const serviceIcon: Record<string, React.ElementType> = {
  personal_trainer: Dumbbell,
  nutritionist:     Salad,
  physiotherapist:  HeartPulse,
};

const statusVariant: Record<string, BadgeProps['variant']> = {
  active:    'success',
  completed: 'neutral',
  cancelled: 'danger',
};

export default function ServicePackagesList({ assignments }: { assignments: any[] }) {
  const t = useTranslations('members.servicePackages');
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(assignments.length / PAGE_SIZE);
  const slice = assignments.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="bg-surface-2 border border-line rounded-xl p-6 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Dumbbell className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-semibold text-fg">{t('title')}</h2>
        <span className="ms-auto text-xs text-fg-faint">{t('assigned', { count: assignments.length })}</span>
      </div>

      <div className="space-y-3">
        {slice.map((a) => {
          const Icon = serviceIcon[a.service_type] ?? Dumbbell;
          const used  = a.sessions_used  ?? 0;
          const total = a.sessions_total ?? 1;
          const pct   = Math.min(100, Math.round((used / total) * 100));
          const serviceLabel = t(`serviceType.${a.service_type}` as any) ?? (a.service_type ?? '').toString().replace('_', ' ');
          return (
            <div key={a.id} className="bg-surface-3/30 rounded-xl p-4 border border-line">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-fg-muted shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-fg">{a.package_name}</p>
                    <p className="text-xs text-fg-faint">{serviceLabel}</p>
                  </div>
                </div>
                <Badge variant={statusVariant[a.status] ?? 'neutral'} size="sm" className="capitalize">{a.status}</Badge>
              </div>
              {a.trainer_name && (
                <p className="text-xs text-fg-faint mb-2">
                  {t('specialist', { name: a.trainer_name })}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-fg-faint mb-1">
                <span>{t('sessionsUsed')}</span>
                <span className="text-fg font-medium">{used} / {total}</span>
              </div>
              <div className="w-full bg-surface-3 rounded-full h-1.5">
                <div className="bg-brand h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {a.notes && (
                <p className="text-xs text-fg-faint mt-2 truncate" title={a.notes}>{a.notes}</p>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
          <span className="text-xs text-fg-faint">
            {t('page', { page: page + 1, total: totalPages })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
