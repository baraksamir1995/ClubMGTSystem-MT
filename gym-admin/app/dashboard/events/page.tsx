import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import EventsPage from '@/components/events/events-page';
import { normalizeEvents, type BranchOption, type PlanOption } from '@/lib/types/store-events';

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

export default async function EventsRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const [permissions, eventsData, plansData, branchesData] = await Promise.all([
    getStaffPermissions(token),
    fetchApi('/admin/events', token),
    fetchApi('/plans', token),
    fetchApi('/branches', token),
  ]);

  const events = normalizeEvents(eventsData?.data ?? eventsData ?? []);

  const rawPlans = plansData?.data ?? plansData ?? [];
  const plans: PlanOption[] = Array.isArray(rawPlans)
    ? rawPlans
        .filter((p: { deleted_at?: string | null }) => !p.deleted_at)
        .map((p: { id: string; name: string; is_active?: boolean }) => ({
          id: p.id, name: p.name, is_active: p.is_active !== false,
        }))
    : [];

  const rawBranches = branchesData?.data ?? branchesData ?? [];
  const branches: BranchOption[] = Array.isArray(rawBranches)
    ? rawBranches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))
    : [];

  return <EventsPage initialEvents={events} plans={plans} branches={branches} permissions={permissions} />;
}
