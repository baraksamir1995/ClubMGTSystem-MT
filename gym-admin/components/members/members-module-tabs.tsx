'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Users, BadgeCheck } from 'lucide-react';

/// Sub-tab bar for the Members module — currently switches between the
/// member directory and the aggregated memberships operational view.
/// Tab state is held in the `?view=` query so links stay shareable.
const TABS = [
  { id: 'members',     label: 'Members',     icon: Users,       view: undefined },
  { id: 'memberships', label: 'Memberships', icon: BadgeCheck,  view: 'memberships' },
] as const;

export default function MembersModuleTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get('view') === 'memberships' ? 'memberships' : 'members';

  return (
    <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-fit">
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
              active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
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
