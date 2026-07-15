'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Building2, CreditCard, FileText, Inbox } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/super-admin', icon: Building2, label: 'Gyms' },
  { href: '/super-admin/plans', icon: FileText, label: 'Plans' },
  { href: '/super-admin/payments', icon: CreditCard, label: 'Payments' },
  { href: '/super-admin/leads', icon: Inbox, label: 'Leads' },
];

export default function SuperAdminNav() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map(item => {
        const active = item.href === '/super-admin'
          ? pathname === '/super-admin'
          : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${active ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg hover:bg-surface-3/50'}`}>
            <item.icon className="w-4 h-4" aria-hidden /> {item.label}
          </Link>
        );
      })}
    </>
  );
}
