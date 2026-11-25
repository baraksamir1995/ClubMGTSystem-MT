import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Users, CreditCard, UserCheck, TrendingUp } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getMe } from '@/lib/get-permissions';
import PaymentReminderBanner, { type BillingReminder } from '@/components/billing/payment-reminder-banner';
import { StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

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
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const t = await getTranslations('overview');

  // Platform billing reminders are the gym owner's business only; the API
  // 403s anyone else, so don't even ask on their behalf.
  const me = await getMe(token);
  const [statsData, remindersData] = await Promise.all([
    fetchApi('/dashboard/stats', token),
    me?.role === 'gym_admin' ? fetchApi('/billing/reminders', token) : Promise.resolve(null),
  ]);
  const reminders: BillingReminder[] = Array.isArray(remindersData?.data) ? remindersData.data : [];

  const totalMembers = statsData?.total_members ?? 0;
  const activeStaff = statsData?.active_staff ?? 0;
  const monthRevenue = statsData?.month_revenue ?? 0;
  const totalRevenue = statsData?.total_revenue ?? 0;
  const currency = statsData?.currency ?? 'EGP';

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

  const stats = [
    { label: t('stats.totalMembers'), value: totalMembers.toLocaleString(), icon: Users },
    { label: t('stats.activeStaff'), value: activeStaff.toLocaleString(), icon: UserCheck },
    { label: t('stats.thisMonthRevenue'), value: fmt(monthRevenue), icon: TrendingUp },
    { label: t('stats.totalRevenue'), value: fmt(totalRevenue), icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <PaymentReminderBanner initial={reminders} />

      <div>
        <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
        <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
        ))}
      </div>

    </div>
  );
}
