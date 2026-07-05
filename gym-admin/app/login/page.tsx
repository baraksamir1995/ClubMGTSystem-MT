'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Dumbbell } from 'lucide-react';
import { Button, Field, Input, PasswordInput } from '@/components/ui';
import LanguageSwitcher from '@/components/language-switcher';

export default function LoginPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [gymInfo, setGymInfo] = useState<{ name: string; logoUrl: string | null } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('gym_info');
      if (stored) setGymInfo(JSON.parse(stored));
    } catch {}
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // SECURITY: MEDIUM-2 — Never distinguish between wrong email vs wrong password
        toast.error(t('invalidCredentials'));
        setLoading(false);
        return;
      }

      // Fetch gym info + check if password reset is required + determine landing page
      let mustReset = false;
      let landingPage = '/dashboard';
      try {
        const meRes = await fetch('/api/me');
        const json = await meRes.json();

        // Super-admin goes to platform dashboard
        if (json.role === 'super_admin') {
          window.location.href = '/super-admin';
          return;
        }

        if (json.gym) {
          try { localStorage.setItem('gym_info', JSON.stringify({ name: json.gym.name, logoUrl: json.gym.logo_url })); } catch {}
        }
        mustReset = json.mustResetPassword === true;

        // For staff/trainer, resolve first permitted route
        if (json.role === 'staff' || json.role === 'trainer') {
          try {
            const staffRes = await fetch('/api/staff');
            const staffJson = await staffRes.json();
            const staffList = staffJson?.data ?? [];
            const myStaff = staffList.find((s: any) => s.user_id === json.id);
            const myRoleIds = (myStaff?.roles ?? []).map((r: any) => r.id);

            if (myRoleIds.length > 0) {
              const rolesRes = await fetch('/api/staff/roles');
              const rolesJson = await rolesRes.json();
              const allRoles = rolesJson?.data ?? [];

              const viewModules = new Set<string>();
              for (const role of allRoles) {
                if (myRoleIds.includes(role.id)) {
                  for (const perm of role.permissions ?? []) {
                    if (perm.action === 'view') viewModules.add(perm.module);
                  }
                }
              }

              const routeMap = [
                { path: '/dashboard', module: 'overview' },
                { path: '/dashboard/members', module: 'members' },
                { path: '/dashboard/plans', module: 'plans' },
                { path: '/dashboard/payments', module: 'payments' },
                { path: '/dashboard/classes', module: 'classes' },
                { path: '/dashboard/promotions', module: 'promotions' },
                { path: '/dashboard/services', module: 'services' },
                { path: '/dashboard/attendance', module: 'attendance' },
                { path: '/dashboard/invitations', module: 'invitations' },
                { path: '/dashboard/content', module: 'content' },
                { path: '/dashboard/analytics', module: 'analytics' },
                { path: '/dashboard/staff', module: 'staff' },
                { path: '/dashboard/settings', module: 'settings' },
              ];

              const firstAllowed = routeMap.find(r => viewModules.has(r.module));
              if (firstAllowed) landingPage = firstAllowed.path;
            }
          } catch {}
        }
      } catch {}

      window.location.href = mustReset ? '/change-password' : landingPage;
    } catch {
      toast.error(t('connectionError'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-clby-bg flex flex-col items-center justify-center p-4 relative">
      <div className="w-full max-w-sm">
        {/* Gym Identity */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-surface-3 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden">
            {gymInfo?.logoUrl ? (
              <img src={gymInfo.logoUrl} alt={gymInfo.name} className="w-full h-full object-cover" />
            ) : (
              <Dumbbell className="w-8 h-8 text-brand" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-fg">{gymInfo?.name ?? t('defaultGymName')}</h1>
          <p className="text-sm text-fg-muted mt-1">{t('subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-surface-2 border border-line rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label={t('emailLabel')} required>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
              />
            </Field>

            <Field label={t('passwordLabel')} required>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={loading}
              className="mt-2"
            >
              {loading ? t('signingIn') : t('signIn')}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          {t('contactAdmin')}
        </p>

        {/* Language toggle — lets users switch to Arabic before signing in */}
        <div className="mt-4 flex justify-center">
          <div className="w-40">
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* Brand footer */}
      <footer className="absolute bottom-4 inset-x-0 text-center text-[11px] text-gray-500 tracking-wide">
        Powered by <span className="text-clby-green font-semibold">CLBY</span>
      </footer>
    </div>
  );
}
