import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import BranchesPage from '@/components/branches/branches-page';
import type { GymStudio } from '@/app/dashboard/classes/page';

export const dynamic = 'force-dynamic';

export interface GymBranch {
  id: string;
  gym_id: string;
  name: string;
  address: string | null;
  image_url: string | null;
  maps_url: string | null;
  is_active: boolean;
  created_at: string;
  session_count?: number;
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
export default async function BranchesRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  
  const gymId = me?.gym_id;

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [branchesData, settingsData, studiosData] = await Promise.all([
    fetchApi('/branches', token),
    fetchApi('/settings', token),
    fetchApi('/studios', token),
  ]);

  const branches = (branchesData?.data ?? branchesData ?? []) as GymBranch[];
  const enrichedBranches = branches.map(b => ({
    ...b,
    session_count: (b as any).session_count ?? 0,
  }));

  const initialStudios: GymStudio[] = (studiosData?.data ?? studiosData ?? []) as GymStudio[];

  return (
    <BranchesPage
      initialBranches={enrichedBranches}
      initialStudios={initialStudios}
      maxBranches={Math.max(settingsData?.max_branches ?? 10, 10)}
      pricePerBranch={settingsData?.price_per_branch ?? null}
      gymId={gymId}
      permissions={permissions}
    />
  );
}
