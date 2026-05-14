import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import NotificationsPage from '@/components/notifications/notifications-page';

export const dynamic = 'force-dynamic';

export interface GymNotification {
  id: string;
  title: string;
  body: string;
  recipient_type: string;
  recipient_filter: { plan_ids?: string[]; statuses?: string[] } | null;
  scheduled_at: string | null;
  sent_at: string | null;
  status: 'sent' | 'scheduled' | 'cancelled';
  recipient_count: number | null;
  created_at: string;
}

export interface PlanOption {
  id: string;
  name: string;
}

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
export default async function NotificationsRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  // Notifications are fetched per-tab on the client (true server-side
  // pagination), so we only need the plans list up front. Saves one
  // /notifications round-trip on every visit.
  const plansData = await fetchApi('/plans', token);
  const rawPlans = plansData?.data ?? plansData ?? [];
  const plans = rawPlans.map((p: any) => ({ id: p.id, name: p.name })) as PlanOption[];

  return (
    <NotificationsPage
      plans={plans}
      permissions={permissions}
    />
  );
}
