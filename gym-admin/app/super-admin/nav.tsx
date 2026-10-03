'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { INVOICES_CHANGED_EVENT } from '@/lib/saas-invoice-events';
import { Building2, CreditCard, FileText, Inbox, ImageIcon, Megaphone } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/super-admin', icon: Building2, label: 'Gyms' },
  { href: '/super-admin/plans', icon: FileText, label: 'Plans' },
  { href: '/super-admin/payments', icon: CreditCard, label: 'Payments' },
  { href: '/super-admin/leads', icon: Inbox, label: 'Leads' },
  { href: '/super-admin/client-logos', icon: ImageIcon, label: 'Client Logos' },
  { href: '/super-admin/whats-new', icon: Megaphone, label: "What's New" },
];

export default function SuperAdminNav() {
  const pathname = usePathname();
  // Gyms' "I have paid" claims waiting on review — the super-admin's
  // notification that a settlement needs confirming.
  const [awaiting, setAwaiting] = useState(0);

  useEffect(() => {
    const load = () => {
      fetch('/api/super-admin/invoices/awaiting-count')
        .then(r => (r.ok ? r.json() : null))
        .then(j => setAwaiting(j?.data?.awaiting ?? 0))
        .catch(() => {});
    };
    load();
    window.addEventListener(INVOICES_CHANGED_EVENT, load);
    return () => window.removeEventListener(INVOICES_CHANGED_EVENT, load);
  }, [pathname]);

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
            {item.href === '/super-admin/payments' && awaiting > 0 && (
              <span className="ms-auto min-w-5 h-5 px-1.5 rounded-full bg-info text-on-status text-[11px] font-semibold inline-flex items-center justify-center"
                aria-label={`${awaiting} awaiting confirmation`}>
                {awaiting}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}
