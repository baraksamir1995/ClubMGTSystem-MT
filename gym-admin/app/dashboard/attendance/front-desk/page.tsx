import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import FrontDeskPage from '@/components/attendance/front-desk/front-desk-page';

export const dynamic = 'force-dynamic';

/**
 * Offline-capable front desk (PHASE2-CONTRACT). The server part only runs on
 * first load: the dashboard layout guard has already enforced the
 * `attendance` module for this route (prefix match on /dashboard/attendance);
 * here we resolve the identity + whether the user may record, and hand off to
 * a client component that works from IndexedDB afterwards.
 */
export default async function FrontDeskRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe, getStaffPermissions, can } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  if (!me?.id || !me.gym_id) redirect('/dashboard/attendance');
  if (!['gym_admin', 'staff', 'trainer'].includes(me.role)) redirect('/dashboard');

  const permissions = me.role === 'gym_admin' ? null : await getStaffPermissions(token);
  const canRecord = can(permissions, 'attendance', 'create');

  return <FrontDeskPage userId={me.id} gymId={me.gym_id} role={me.role} canRecord={canRecord} />;
}
