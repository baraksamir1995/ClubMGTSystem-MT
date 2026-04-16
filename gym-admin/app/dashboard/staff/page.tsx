import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import StaffPage from '@/components/staff/staff-page';

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
export default async function StaffRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [staffData, rolesData] = await Promise.all([
    fetchApi('/staff', token),
    fetchApi('/staff/roles', token),
  ]);

  const staffList = staffData?.data ?? staffData ?? [];
  const rolesList = rolesData?.data ?? rolesData ?? [];

  // Build staff with roles (API should already include roles)
  const staff = staffList.map((s: any) => ({
    ...s,
    roles: s.roles ?? [],
  }));

  // Build roles with permissions + member counts
  const roles = rolesList.map((r: any) => ({
    ...r,
    permissions: r.permissions ?? [],
    memberCount: r.member_count ?? r.memberCount ?? 0,
  }));

  const totalStaff = staffList.length;
  const activeStaff = staffList.filter((s: any) => s.status === 'active').length;
  const inactiveStaff = staffList.filter((s: any) => s.status === 'inactive').length;

  const countByRole: Record<string, number> = {};
  for (const s of staffList) {
    for (const r of s.roles ?? []) {
      countByRole[r.id] = (countByRole[r.id] ?? 0) + 1;
    }
  }

  const overview = {
    totalStaff,
    activeStaff,
    inactiveStaff,
    totalRoles: rolesList.length,
    recentActivity: [], // Activity logs would need a separate endpoint
    roleBreakdown: rolesList.map((r: any) => ({ id: r.id, name: r.name, memberCount: countByRole[r.id] ?? r.member_count ?? 0 })),
  };

  return <StaffPage permissions={permissions} initialStaff={staff} initialRoles={roles} initialOverview={overview} />;
}
