import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Users, CreditCard, UserCheck, TrendingUp } from 'lucide-react';

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

  const statsData = await fetchApi('/dashboard/stats', token);

  const totalMembers = statsData?.total_members ?? 0;
  const activeStaff = statsData?.active_staff ?? 0;
  const monthRevenue = statsData?.month_revenue ?? 0;
  const totalRevenue = statsData?.total_revenue ?? 0;
  const currency = statsData?.currency ?? 'EGP';

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

  const stats = [
    { label: 'Total Members', value: totalMembers.toLocaleString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Active Staff', value: activeStaff.toLocaleString(), icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'This Month Revenue', value: fmt(monthRevenue), icon: TrendingUp, color: 'text-brand', bg: 'bg-brand/10' },
    { label: 'Total Revenue', value: fmt(totalRevenue), icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Overview</h1>
        <p className="text-sm text-fg-muted mt-0.5">Your gym at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface-2 border border-line rounded-xl p-4">
            <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-xs text-fg-muted mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
