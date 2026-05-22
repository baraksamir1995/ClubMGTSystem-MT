import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Layers } from 'lucide-react';
import SessionsTracker, {
  type SessionsMember,
} from '@/components/sessions/sessions-tracker';

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
export default async function SessionsPage() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  if (!me?.gym_id) redirect('/dashboard');

  // Fetch sessions members data from Laravel
  // This would ideally be a dedicated endpoint; for now use members with sessions plans
  const membersData = await fetchApi('/members?per_page=9999', token);
  const rawMembers = membersData?.data ?? membersData ?? [];

  const hasSessionsPlan = (pt: string | undefined) => pt === 'sessions' || pt === 'duration_session';
  const members: SessionsMember[] = rawMembers
    .filter((m: any) => {
      const memberships = m.memberships ?? [];
      return memberships.some((ms: any) => hasSessionsPlan(ms.plan?.plan_type) && ms.sessions_total > 0);
    })
    .map((m: any) => {
      const memberships = (m.memberships ?? []).filter((ms: any) => hasSessionsPlan(ms.plan?.plan_type) && ms.sessions_total > 0);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center">
          <Layers className="w-5 h-5 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-fg">Sessions Tracker</h1>
          <p className="text-sm text-fg-muted">
            Monitor session consumption for all sessions-plan members
          </p>
        </div>
      </div>

      <SessionsTracker initialMembers={members} />
    </div>
  );
}
