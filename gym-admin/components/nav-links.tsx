'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Banknote, Settings, ClipboardList,
  CalendarDays, Tag, ScanLine, LayoutTemplate, BarChart3,
  ShieldCheck, Layers, Mail,
} from 'lucide-react';

const ALL_NAV = [
  { href: '/dashboard',             label: 'Overview',               icon: LayoutDashboard },
  { href: '/dashboard/members',     label: 'Members',                icon: Users },
  { href: '/dashboard/plans',       label: 'Subscription Plans',     icon: ClipboardList },
  { href: '/dashboard/payments',    label: 'Payments',               icon: Banknote },
  { href: '/dashboard/classes',     label: 'Classes & Schedule',     icon: CalendarDays },
  { href: '/dashboard/promotions',  label: 'Promotions & Discounts', icon: Tag },
  { href: '/dashboard/services',    label: 'Services',               icon: Layers },
  { href: '/dashboard/attendance',  label: 'Attendance & Access',    icon: ScanLine },
  { href: '/dashboard/invitations', label: 'Guest Invitations',      icon: Mail },
  { href: '/dashboard/content',     label: 'Content',                icon: LayoutTemplate },
  { href: '/dashboard/analytics',   label: 'Analytics',              icon: BarChart3 },
  { href: '/dashboard/staff',       label: 'Staff & Roles',          icon: ShieldCheck },
  { href: '/dashboard/settings',    label: 'Settings',               icon: Settings },
];

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
  const allowed = new Set(allowedHrefs);
  const items = ALL_NAV.filter(item => allowed.has(item.href));

  return (
    <>
      {items.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-clby-green/15 text-clby-green font-medium'
                : 'text-gray-400 hover:text-white hover:bg-clby-surface'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-clby-green' : ''}`} />
            <span className="flex-1">{label}</span>
          </Link>
        );
      })}
    </>
  );
}
