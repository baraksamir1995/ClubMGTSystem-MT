import type { GymBranch } from '@/app/dashboard/branches/page';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/** The caller's gym branches (Laravel scopes /branches to the token's gym). */
export async function loadBranches(token: string): Promise<GymBranch[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/branches`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.data ?? json ?? []) as GymBranch[];
  } catch {
    return [];
  }
}

export async function kioskAccess(token: string) {
  const { getMe, getStaffPermissions, can } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  if (!me?.id || !me.gym_id || !['gym_admin', 'staff', 'trainer'].includes(me.role)) return null;
  const permissions = await getStaffPermissions(token);
  // PHASE3-CONTRACT §5: permission attendance,view (module-level, like Laravel)
  if (!can(permissions, 'attendance', 'view')) return null;
  return { userId: me.id as string, gymId: me.gym_id as string, role: me.role as string };
}
