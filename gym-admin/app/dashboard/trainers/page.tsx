import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TrainersPage from '@/components/trainers/trainers-page';
import type { TrainerProfile } from '@/components/trainers/trainer-modal';
import type { GymBranch } from '@/app/dashboard/branches/page';

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
export default async function TrainersRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getStaffPermissions, getMe } = await import('@/lib/get-permissions');
  const [permissions, me] = await Promise.all([
    getStaffPermissions(token),
    getMe(token),
  ]);

  const [trainersData, branchesData] = await Promise.all([
    fetchApi('/trainers', token),
    fetchApi('/branches', token),
  ]);

  const rawTrainers = trainersData?.data ?? trainersData ?? [];
  const trainers: TrainerProfile[] = rawTrainers.map((t: any) => ({
    id:                t.id,
    name:              t.name,
    photo_url:         t.photo_url,
    bio:               t.bio,
    specialisations:   t.specialisations ?? t.specialties ?? [],
    trainer_type:      t.trainer_type ?? 'personal_trainer',
    is_active:         t.is_active,
    upcoming_sessions: Number(t.upcoming_sessions ?? 0),
    branch_ids:        t.branch_ids ?? [],
  }));

  const branches: GymBranch[] = (branchesData?.data ?? branchesData ?? []) as GymBranch[];

  return <TrainersPage initialTrainers={trainers} branches={branches} permissions={permissions} gymId={me?.gym_id ?? ''} />;
}
