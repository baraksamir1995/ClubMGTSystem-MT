import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SettingsPage from '@/components/settings/settings-page';
import type { GymSettings } from '@/lib/settings-types';
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
export default async function SettingsRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  
  const gymId = me?.gym_id;

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [gymData, branchesData, studiosData] = await Promise.all([
    fetchApi('/settings', token),
    fetchApi('/branches', token),
    fetchApi('/studios', token),
  ]);

  const gym = gymData;

  const safeGym: GymSettings = {
    id:                       gymId,
    name:                     gym?.name                     ?? '',
    email:                    gym?.email                    ?? null,
    phone:                    gym?.phone                    ?? null,
    address:                  gym?.address                  ?? null,
    logo_url:                 gym?.logo_url                 ?? null,
    description:              gym?.description              ?? null,
    operating_hours:          gym?.operating_hours          ?? null,
    mobile_payments_enabled:  gym?.mobile_payments_enabled  ?? true,
    capacity_feature_enabled: gym?.capacity_feature_enabled ?? false,
    max_capacity:             gym?.max_capacity             ?? null,
    branding_config:          gym?.branding_config          ?? null,
  };

  const branches = (branchesData?.data ?? branchesData ?? []) as GymBranch[];
  const initialStudios: GymStudio[] = (studiosData?.data ?? studiosData ?? []) as GymStudio[];

  // Note: session counts per branch would ideally come from the API
  // For now pass branches as-is with session_count defaulting to 0
  const enrichedBranches = branches.map(b => ({
    ...b,
    session_count: (b as any).session_count ?? 0,
  }));

  return (
    <SettingsPage
      gym={safeGym}
      permissions={permissions}
      initialBranches={enrichedBranches}
      initialStudios={initialStudios}
      maxBranches={Math.max(gym?.max_branches ?? 10, 10)}
      pricePerBranch={gym?.price_per_branch ?? null}
      gymId={gymId}
    />
  );
}
