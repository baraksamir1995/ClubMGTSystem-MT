'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Users, BadgeCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

/// Sub-tab bar for the Members module — currently switches between the
/// member directory and the aggregated memberships operational view.
/// Tab state is held in the `?view=` query so links stay shareable.

export default function MembersModuleTabs() {
  const t = useTranslations('members.moduleTabs');
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('view') === 'memberships' ? 'memberships' : 'members';

  const TABS = [
    { id: 'members',     label: t('members'),     icon: Users,       view: undefined },
    { id: 'memberships', label: t('memberships'), icon: BadgeCheck,  view: 'memberships' },
  ] as const;

  return (
    <div className="flex gap-1 bg-surface-2 border border-line rounded-xl p-1 w-fit">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const active = current === tab.id;
        // Preserve other query params when switching tabs.
        const next = new URLSearchParams(params.toString());
        if (tab.view) next.set('view', tab.view);
        else next.delete('view');
        // Drop pagination + search when switching views — they don't carry
        // semantic meaning across two different tables.
        next.delete('page');
        next.delete('search');
        const href = `${pathname}${next.toString() ? `?${next}` : ''}`;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
