import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Shield, Building2, CreditCard, FileText } from 'lucide-react';
import SignOutButton from '@/components/sign-out-button';
import ThemeToggle from '@/components/theme/theme-toggle';
import SuperAdminNav from './nav';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const metadata = { title: 'Super Admin — Platform' };

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  // Verify super-admin role
  let me: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/super-admin/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) me = await res.json();
  } catch {}

  if (!me || me.role !== 'super_admin') redirect('/login');

  return (
    <div className="min-h-screen bg-surface flex">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-surface-2 border-r border-line flex flex-col">
        <div className="p-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-brand" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg truncate">Platform Admin</p>
              <p className="text-xs text-fg-muted truncate">Super Admin</p>
            </div>
            <ThemeToggle className="flex-shrink-0" />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <SuperAdminNav />
        </nav>

        <div className="p-3 border-t border-line">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-fg truncate">{me.full_name}</p>
            <p className="text-xs text-fg-faint truncate">{me.email}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main id="main-content" className="flex-1 min-w-0 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
