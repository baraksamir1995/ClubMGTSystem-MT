import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ClassesPage from '@/components/classes/classes-page';
import type { SessionsMember } from '@/components/sessions/sessions-tracker';
import type { GymBranch } from '@/app/dashboard/branches/page';

export const dynamic = 'force-dynamic';

export interface GymClass {
  id: string;
  name: string;
  class_type: string;
  description: string | null;
  instructor: string | null;
  trainer_id: string | null;
  location: string | null;
  color: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  branch_id: string | null;
}

export interface ClassSession {
  id: string;
  class_id: string;
  class_name: string;
  class_type: string;
  session_type: 'popup' | 'recurring';
  instructor: string | null;
  location: string | null;
  color: string;
  session_date: string;
  start_time: string;
  end_time: string;
  capacity: number | null;
  booked_count: number;
  status: 'scheduled' | 'cancelled' | 'completed';
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  recurring_template_id?: string | null;
  is_published: boolean;
  branch_id: string | null;
  studio_id: string | null;
  walk_in_allowed: boolean;
}

export interface GymStudio {
  id: string;
  name: string;
  branch_id: string;
  capacity: number | null;
}

export type { GymBranch };

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
export default async function ClassesPageRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  if (!me?.gym_id) redirect('/login');

  const gymId = me?.gym_id;

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [classesData, sessionsData, settingsData, branchesData, studiosData, membersData] = await Promise.all([
    fetchApi('/classes', token),
    fetchApi('/sessions?per_page=999', token),
    fetchApi('/settings', token),
    fetchApi('/branches', token),
    fetchApi('/studios', token),
    fetchApi('/members?per_page=9999', token),
  ]);

  const rawClasses = classesData?.data ?? classesData ?? [];
  const classes: GymClass[] = rawClasses.map((c: any) => ({
    id: c.id,
    name: c.name,
    class_type: c.class_type,
    description: c.description,
    instructor: c.instructor,
    trainer_id: c.trainer_id ?? null,
    location: c.location,
    color: c.color ?? '#7c3aed',
    image_url: c.image_url ?? null,
    is_active: c.is_active,
    created_at: c.created_at,
    branch_id: c.branch_id ?? null,
  }));

  const initialStudios: GymStudio[] = (studiosData?.data ?? studiosData ?? []) as GymStudio[];
  const studioNameMap: Record<string, string> = Object.fromEntries(initialStudios.map(s => [s.id, s.name]));

  const rawSessions = sessionsData?.data ?? sessionsData ?? [];
  const sessions: ClassSession[] = rawSessions.map((s: any) => ({
    id: s.id,
    class_id: s.class_id,
    class_name: s.class_name ?? s.class_model?.name ?? '',
    class_type: s.class_type ?? s.class_model?.class_type ?? '',
    instructor: s.instructor ?? s.class_model?.instructor ?? null,
    location: s.studio_id ? (studioNameMap[s.studio_id] ?? s.location) : s.location,
    color: s.color ?? s.class_model?.color ?? '#7c3aed',
    session_date: (s.session_date ?? '').slice(0, 10),
    start_time: s.start_time,
    end_time: s.end_time,
    capacity: s.capacity,
    booked_count: s.booked_count ?? 0,
    session_type: (s.session_type === 'recurring' ? 'recurring' : 'popup') as 'popup' | 'recurring',
    recurring_template_id: s.recurring_template_id ?? null,
    is_published: s.is_published ?? false,
    status: s.status,
    cancel_reason: s.cancel_reason,
    cancelled_at: s.cancelled_at,
    created_at: s.created_at,
    branch_id: s.branch_id ?? null,
    studio_id: s.studio_id ?? null,
    walk_in_allowed: s.walk_in_allowed ?? false,
  }));

  const rawMembers = membersData?.data ?? membersData ?? [];
  const hasSessionsPlan = (pt: string | undefined) => pt === 'sessions' || pt === 'duration_session';
  const initialSessionsMembers: SessionsMember[] = rawMembers
    .filter((m: any) => {
      const memberships = m.memberships ?? [];
      return memberships.some((ms: any) => hasSessionsPlan(ms.plan?.plan_type) && ms.sessions_total > 0);
    })
    .map((m: any) => {
      const memberships = (m.memberships ?? []).filter((ms: any) => hasSessionsPlan(ms.plan?.plan_type) && ms.sessions_total > 0);
      // Prefer active, then most recent
      const ms = memberships.find((ms: any) => ms.status === 'active') ?? memberships[0];
      const sessionCount: number = ms.sessions_total ?? ms.session_count ?? 0;
      const sessionsUsed: number = ms.sessions_used ?? 0;
      const sessionsRemaining = Math.max(0, sessionCount - sessionsUsed);
      const pctUsed = sessionCount > 0
        ? Math.round((sessionsUsed / sessionCount) * 100)
        : 0;
      return {
        membershipId: ms.id ?? '',
        memberId: m.id,
        memberNumber: m.member_number ?? '',
        fullName: m.user?.full_name ?? 'Unknown',
        email: m.user?.email ?? null,
        planId: ms.plan_id ?? '',
        planName: ms.plan?.name ?? 'Sessions Plan',
        sessionCount,
        sessionsUsed,
        sessionsRemaining,
        pctUsed,
        status: ms.status ?? m.status,
        startDate: ms.start_date,
        endDate: ms.end_date,
      };
    });

  // Class types from the classes data (distinct class_type values)
  const classTypeSet = new Set<string>(rawClasses.map((c: any) => c.class_type).filter(Boolean));
  const initialClassTypes: { id: string; name: string }[] = [...classTypeSet].map(ct => ({ id: ct, name: ct }));

  const initialBranches: GymBranch[] = (branchesData?.data ?? branchesData ?? []) as GymBranch[];

  return (
    <ClassesPage
      initialClasses={classes}
      initialSessions={sessions}
      initialSessionsMembers={initialSessionsMembers}
      initialClassTypes={initialClassTypes}
      initialBranches={initialBranches}
      initialStudios={initialStudios}
      gymId={gymId}
      gym={{ name: settingsData?.name ?? 'Gym', logo_url: settingsData?.logo_url ?? null }}
      permissions={permissions}
    />
  );
}
