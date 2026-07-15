import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Dumbbell } from 'lucide-react';
import NavLinks from '@/components/nav-links';
import ThemeToggle from '@/components/theme/theme-toggle';
import UserMenu from '@/components/user-menu';
import MutationListener from '@/components/mutation-listener';
import GymTimezoneProvider from '@/components/gym-timezone-provider';
import type { Metadata } from 'next';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

async function fetchApi(path: string, token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const cookieStore = await cookies();
    const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
    if (!token) return { title: 'Admin Panel' };

    const { getMe } = await import('@/lib/get-permissions');
    const me = await getMe(token);
    if (!me?.gym_id) return { title: 'Admin Panel' };

    const settings = await fetchApi('/settings', token);
    if (!settings) return { title: 'Admin Panel' };

    const firstName = (settings.name ?? 'Gym').split(' ')[0];
    return {
      title: `${firstName} — Admin`,
      icons: {
        icon: settings.logo_url ?? '/favicon.ico',
        apple: settings.logo_url ?? '/favicon.ico',
      },
    };
  } catch {
    return { title: 'Admin Panel' };
  }
}

// Map each nav route to the permission module key (null = always visible)
const ALL_NAV = [
  { href: '/dashboard',              module: 'overview' },
  { href: '/dashboard/members',      module: 'members' },
  { href: '/dashboard/plans',        module: 'plans' },
  { href: '/dashboard/payments',     module: 'payments' },
  { href: '/dashboard/classes',      module: 'classes' },
  { href: '/dashboard/promotions',   module: 'promotions' },
  { href: '/dashboard/services',     module: 'services' },
  { href: '/dashboard/attendance',   module: 'attendance' },
  { href: '/dashboard/invitations',  module: 'invitations' },
  { href: '/dashboard/content',      module: 'content' },
  { href: '/dashboard/analytics',    module: 'analytics' },
  { href: '/dashboard/staff',        module: 'staff' },
  { href: '/dashboard/settings',     module: 'settings' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  // Get user info (cached via React.cache — shared with generateMetadata + pages)
  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  if (!me) {
    // Don't redirect — show dashboard with fallback data
    // This prevents logout loops when the API is temporarily slow
  }

  // Block dashboard access until password is changed
  if (me?.must_reset_password) redirect('/change-password');

  // Get gym settings
  const settings = await fetchApi('/settings', token);
  const gym = settings ? { id: me?.gym_id, name: settings.name ?? 'My Gym', logo_url: settings.logo_url ?? null } : null;

  // Determine which nav items to show based on permissions
  let allowedModules: Set<string> | null = null; // null = show all (gym_admin)

  if (me?.role === 'staff' || me?.role === 'trainer') {
    try {
      const { getStaffPermissions } = await import('@/lib/get-permissions');
      const perms = await getStaffPermissions(token);
      if (perms === null) {
        // null = unrestricted (gym owner or unrecognized)
        allowedModules = null;
      } else {
        const modules = new Set<string>();
        for (const p of perms) {
          if (p.action === 'view') modules.add(p.module);
        }
        allowedModules = modules;
      }
    } catch {
      // Fail closed for staff/trainer: a thrown/unexpected permission
      // response must not expose the full admin nav. Behave like a
      // zero-permission staff member (empty set) — the guard below then
      // restricts/redirects. null stays reserved for confirmed
      // unrestricted users (handled above).
      allowedModules = new Set();
    }
  }

  const allowedHrefs = ALL_NAV
    .filter(item => item.module === null || allowedModules === null || allowedModules.has(item.module))
    .map(item => item.href);

  // Route guard: redirect to first allowed page if current page isn't permitted
  if (allowedModules !== null) {
    if (allowedHrefs.length === 0) {
      redirect('/login');
    }

    const { headers } = await import('next/headers');
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') ?? '';

    if (pathname) {
      const isAllowed = allowedHrefs.some(href =>
        pathname === href || pathname.startsWith(href + '/')
      );
      if (!isAllowed) {
        redirect(allowedHrefs[0]);
      }
    }
  }

  // Active offer count for sidebar badge — runs on every dashboard route,
  // so a single bad item in /offers (null, missing status, missing
  // expires_at) crashes the entire dashboard layout via React's error
  // boundary, which surfaces as a generic "Something went wrong" toast on
  // unrelated pages (notifications, content, etc). Guard each access.
  let activeOffersCount = 0;
  if (me?.gym_id) {
    const offersData = await fetchApi('/offers', token);
    const offers = offersData?.data ?? offersData ?? [];
    activeOffersCount = Array.isArray(offers)
      ? offers.filter((o: any) => {
          if (!o || o.status !== 'active') return false;
          const exp = o.expires_at ? new Date(o.expires_at) : null;
          // No expiry means evergreen → still active.
          return exp == null || exp > new Date();
        }).length
      : 0;
  }

  const t = await getTranslations('layout');
  const displayName = me?.full_name || me?.email || '';
  const sidebarLabel = me?.is_staff ? t('staffPortal') : t('adminPanel');

  return (
    <div className="min-h-screen bg-surface flex">
      {/* First tab stop on every dashboard page — jumps past the nav rail. */}
      <a href="#main-content" className="skip-link">{t('skipToContent')}</a>
      {/* Sidebar — themed page surface with a hairline border so it
          still reads as a distinct rail against the main content area. */}
      <aside className="w-60 flex-shrink-0 bg-surface border-e border-line flex flex-col">
        {/* Gym Identity */}
        <div className="p-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-2 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
              {gym?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- gym logo on external host
                <img src={gym.logo_url} alt={gym.name} className="w-full h-full object-cover" />
              ) : (
                <Dumbbell className="w-5 h-5 text-brand" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg truncate">{gym?.name ?? t('myGym')}</p>
              <p className="text-xs text-fg-muted truncate">{sidebarLabel}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          <Suspense fallback={null}>
            <NavLinks allowedHrefs={allowedHrefs} contentBadge={activeOffersCount} />
          </Suspense>
        </nav>

      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 overflow-auto flex flex-col">
        <GymTimezoneProvider timezone={settings?.timezone ?? 'Africa/Cairo'} />
        <MutationListener />
        {/* Dashboard header — global controls + account dropdown, pinned to
            the inline-end of the content area (top-right in LTR). */}
        <header className="flex items-center justify-end gap-1 px-6 pt-3 -mb-3">
          <ThemeToggle />
          <UserMenu name={displayName} email={me?.email ?? ''} />
        </header>
        <main id="main-content" className="flex-1 p-6">{children}</main>
        {/* Brand footer — pinned to the bottom of the scroll container
            so it sits below page content regardless of length. */}
        <footer className="px-6 py-3 text-[11px] text-fg-faint border-t border-line tracking-wide">
          {t('poweredBy')} <span className="text-brand font-semibold">CLBY</span>
        </footer>
      </div>
    </div>
  );
}
