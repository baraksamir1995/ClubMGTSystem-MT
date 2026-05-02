import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AttendancePage from '@/components/attendance/attendance-page';
import type { GymBranch } from '@/app/dashboard/branches/page';

export const dynamic = 'force-dynamic';

export interface AttendanceLog {
  id: string;
  gym_member_id: string;
  member_number: string;
  full_name: string | null;
  photo_url: string | null;
  check_in_at: string;
  method: string | null;
  access_point: string | null;
  instructor_name: string | null;
  branch_name: string | null;
  studio_name: string | null;
  class_name: string | null;
  specialist_name: string | null;
  plan_name: string | null;
  plan_type: string | null;
}

export interface MemberOption {
  id: string;
  member_number: string;
  full_name: string | null;
  plan_type: string | null; // 'sessions' | 'duration' | 'duration_session' | null
}

export interface SessionOption {
  id: string;
  label: string;
  branch_id: string | null;
  branch_name: string | null;
  instructor: string | null;
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
export default async function AttendanceRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  
  const gymId = me?.gym_id;

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [attendanceData, branchesData, membersData, sessionsData] = await Promise.all([
    fetchApi('/attendance?limit=20', token),
    fetchApi('/branches', token),
    fetchApi('/members?limit=500&status=active', token),
    fetchApi('/sessions?date=' + new Date().toISOString().slice(0, 10), token),
  ]);

  const branches: GymBranch[] = (branchesData?.data ?? branchesData ?? []) as GymBranch[];

  const rawLogs = attendanceData?.data ?? attendanceData ?? [];
  const logs: AttendanceLog[] = rawLogs.map((l: any) => ({
    id:              l.id,
    gym_member_id:   l.gym_member_id,
    member_number:   l.member_number ?? '',
    full_name:       l.full_name ?? null,
    photo_url:       l.photo_url ?? null,
    check_in_at:     l.check_in_at,
    method:          l.method ?? null,
    access_point:    l.access_point ?? null,
    instructor_name: l.instructor_name ?? null,
    branch_name:     l.branch_name ?? null,
    studio_name:     l.studio_name ?? null,
    class_name:      l.class_name ?? null,
    specialist_name: l.specialist_name ?? null,
    plan_name:       l.plan_name ?? null,
    plan_type:       l.plan_type ?? null,
  }));

  const rawMembers = membersData?.data ?? membersData ?? [];
  const members: MemberOption[] = rawMembers.map((m: any) => {
    const activeMembership = (m.memberships ?? []).find((ms: any) => ms.status === 'active');
    return {
      id:            m.id,
      member_number: m.member_number ?? '',
      full_name:     m.user?.full_name ?? m.full_name ?? m.profile?.full_name ?? null,
      plan_type:     activeMembership?.plan?.plan_type ?? null,
    };
  });

  const rawSessions = sessionsData?.data ?? sessionsData ?? [];
  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));

  // Normalize: Laravel returns class name inside class_model.name
  const sessionsWithClassName = rawSessions.map((s: any) => ({
    ...s,
    class_name: s.class_name ?? s.class_model?.name ?? null,
    instructor: s.instructor ?? s.class_model?.instructor ?? null,
  }));

  // Collect all class names to filter them out of gym access points
  const classNames = new Set(sessionsWithClassName.map((s: any) => s.class_name).filter(Boolean));

  // Access points from past logs — exclude class names so they don't appear under "Gym Access"
  const accessPoints = [...new Set(
    logs.map(l => l.access_point).filter((p): p is string => !!p && !classNames.has(p))
  )];

  const sessionEntryPoints: string[] = sessionsWithClassName
    .filter((s: any) => s.class_name)
    .map((s: any) => {
      const time = s.start_time ?? '';
      return time ? `${s.class_name} - ${time}` : s.class_name;
    });

  const sessionOptions: SessionOption[] = sessionsWithClassName
    .filter((s: any) => s.class_name)
    .map((s: any) => ({
      id: s.id,
      label: s.start_time ? `${s.class_name} - ${s.start_time}` : s.class_name,
      branch_id: s.branch_id ?? null,
      branch_name: s.branch_id ? (branchMap[s.branch_id] ?? null) : null,
      instructor: s.instructor ?? null,
    }));

  return (
    <AttendancePage
      initialLogs={logs}
      members={members}
      accessPoints={accessPoints}
      sessionEntryPoints={sessionEntryPoints}
      sessionOptions={sessionOptions}
      gymId={gymId}
      branches={branches}
      permissions={permissions}
    />
  );
}
