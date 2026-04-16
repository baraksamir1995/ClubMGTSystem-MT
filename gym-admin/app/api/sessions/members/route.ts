import { NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

const hasSessionsPlan = (pt: string | undefined) => pt === 'sessions' || pt === 'duration_session';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/members?per_page=9999', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });

  const rawMembers = json.data ?? json ?? [];

  const members = rawMembers
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

  return NextResponse.json({ members });
}
