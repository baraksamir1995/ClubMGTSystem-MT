import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import StudiosPage from '@/components/studios/studios-page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import type { GymStudio } from '@/app/dashboard/classes/page';

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
export default async function StudiosRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  
  const gymId = me?.gym_id;

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [studiosData, branchesData] = await Promise.all([
    fetchApi('/studios', token),
    fetchApi('/branches', token),
  ]);

  const studios: GymStudio[] = (studiosData?.data ?? studiosData ?? []) as GymStudio[];
  const branches: GymBranch[] = (branchesData?.data ?? branchesData ?? []) as GymBranch[];

  return (
    <StudiosPage
      initialStudios={studios}
      branches={branches}
      gymId={gymId}
      permissions={permissions}
    />
  );
}
