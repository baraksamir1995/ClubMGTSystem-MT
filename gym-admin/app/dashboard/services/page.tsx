import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ServicesPage from '@/components/services/services-page';
import type { GymOffer } from '@/app/dashboard/content/page';
import type { GymBranch } from '@/app/dashboard/branches/page';

export const dynamic = 'force-dynamic';

export interface GymProgram {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  storage_path: string | null;
  duration_weeks: number | null;
  total_sessions: number | null;
  session_duration_minutes: number | null;
  level: string | null;
  category: string | null;
  trainer_name: string | null;
  schedule_text: string | null;
  focus_areas: string[];
  price: number | null;
  display_order: number;
  status: 'draft' | 'published';
  created_at: string;
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
export default async function ServicesRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  
  const gymId = me?.gym_id;

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [programsData, offersData, trainersData, packagesData, branchesData] = await Promise.all([
    fetchApi('/programs', token),
    fetchApi('/offers', token),
    fetchApi('/trainers', token),
    fetchApi('/service-packages', token),
    fetchApi('/branches', token),
  ]);

  const programs = (programsData?.data ?? programsData ?? []) as GymProgram[];
  const offers = (offersData?.data ?? offersData ?? []) as GymOffer[];

  const rawTrainers = trainersData?.data ?? trainersData ?? [];
  const trainers = rawTrainers
    .filter((t: any) => ['personal_trainer', 'physiotherapist', 'nutritionist'].includes(t.trainer_type))
    .map((t: any) => ({
      ...t,
      specialisations: t.specialisations ?? t.specialties ?? [],
      upcoming_sessions: Number(t.upcoming_sessions ?? 0),
      branch_ids: t.branch_ids ?? [],
    }));

  const rawPackages = packagesData?.data ?? packagesData ?? [];
  const packages = rawPackages.map((p: any) => ({
    id:            p.id,
    name:          p.name,
    session_count: p.session_count,
    price:         p.price,
    currency:      p.currency ?? 'EGP',
    description:   p.description,
    is_active:     p.is_active,
    trainer_type:  p.trainer_type ?? null,
  }));

  const branches: GymBranch[] = (branchesData?.data ?? branchesData ?? []) as GymBranch[];

  return (
    <ServicesPage
      initialPrograms={programs}
      initialOffers={offers}
      initialTrainers={trainers}
      initialPackages={packages}
      permissions={permissions}
      gymId={gymId}
      branches={branches}
    />
  );
}
