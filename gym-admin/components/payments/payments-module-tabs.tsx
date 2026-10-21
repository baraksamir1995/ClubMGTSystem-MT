'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Banknote, PieChart } from 'lucide-react';
import { useTranslations } from 'next-intl';

/// Sub-tab bar for the Payments module — switches between the payment
/// ledger and the Financial Overview (expenses + revenue/net summary).
/// Tab state is held in the `?view=` query so links stay shareable.

export default function PaymentsModuleTabs() {
  const t = useTranslations('payments.moduleTabs');
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('view') === 'financial' ? 'financial' : 'payments';

  const TABS = [
    { id: 'payments',  label: t('payments'),  icon: Banknote, view: undefined },
    { id: 'financial', label: t('financial'), icon: PieChart, view: 'financial' },
  ] as const;

  return (
    <div className="flex gap-1 bg-surface-2 border border-line rounded-xl p-1 w-fit max-w-full overflow-x-auto">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const active = current === tab.id;
        const next = new URLSearchParams(params.toString());
        if (tab.view) next.set('view', tab.view);
        else next.delete('view');
        const href = `${pathname}${next.toString() ? `?${next}` : ''}`;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              active ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
