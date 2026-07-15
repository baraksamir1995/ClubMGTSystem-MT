'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard, Users, Banknote, Settings, ClipboardList,
  CalendarDays, Tag, ScanLine, LayoutTemplate, BarChart3,
  ShieldCheck, Layers, Mail,
} from 'lucide-react';

// `labelKey` indexes into the `nav` message namespace; the visible label is
// resolved per-locale at render time.
const ALL_NAV = [
  { href: '/dashboard',             labelKey: 'overview',    icon: LayoutDashboard },
  { href: '/dashboard/members',     labelKey: 'members',     icon: Users },
  { href: '/dashboard/plans',       labelKey: 'plans',       icon: ClipboardList },
  { href: '/dashboard/payments',    labelKey: 'payments',    icon: Banknote },
  { href: '/dashboard/classes',     labelKey: 'classes',     icon: CalendarDays },
  { href: '/dashboard/promotions',  labelKey: 'promotions',  icon: Tag },
  { href: '/dashboard/services',    labelKey: 'services',    icon: Layers },
  { href: '/dashboard/attendance',  labelKey: 'attendance',  icon: ScanLine },
  { href: '/dashboard/invitations', labelKey: 'invitations', icon: Mail },
  { href: '/dashboard/content',     labelKey: 'content',     icon: LayoutTemplate },
  { href: '/dashboard/analytics',   labelKey: 'analytics',   icon: BarChart3 },
  { href: '/dashboard/staff',       labelKey: 'staff',       icon: ShieldCheck },
  { href: '/dashboard/settings',    labelKey: 'settings',    icon: Settings },
] as const;

interface Props {
  allowedHrefs: string[];
  /**
   * Kept for backwards-compatibility with the dashboard layout's call
   * site — the badge itself is no longer rendered per product request.
   */
  contentBadge?: number;
}

export default function NavLinks({ allowedHrefs }: Props) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const allowed = new Set(allowedHrefs);
  const items = ALL_NAV.filter(item => allowed.has(item.href));

  return (
    <>
      {items.map(({ href, labelKey, icon: Icon }) => {
        const isActive =
          href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 px-3 min-h-11 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-brand/15 text-brand font-medium'
                : 'text-fg-muted hover:text-fg hover:bg-surface-2'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-brand' : ''}`} aria-hidden />
            <span className="flex-1 text-start">{t(labelKey)}</span>
          </Link>
        );
      })}
    </>
  );
}
