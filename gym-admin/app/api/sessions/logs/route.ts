import { NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/sessions/logs', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });

  const rawLogs = json.data ?? json ?? [];

  const logs = rawLogs.map((l: any) => ({
    id: l.id,
    consumedAt: l.consumed_at,
    source: l.source ?? 'unknown',
    reversedAt: l.reversed_at ?? null,
    memberId: l.member_id ?? '',
    memberNumber: l.member_number ?? '',
    fullName: l.full_name ?? 'Unknown',
    email: l.email ?? null,
    membershipId: l.membership_id ?? '',
    planName: l.plan_name ?? '',
    planType: l.plan_type ?? '',
    membershipStatus: l.membership_status ?? '',
    sessionsUsed: l.sessions_used ?? null,
    sessionsTotal: l.sessions_total ?? null,
    className: l.class_name ?? null,
    classType: l.class_type ?? null,
    classColor: l.class_color ?? null,
    sessionDate: l.session_date ?? null,
    sessionTime: l.session_time ?? null,
  }));

  return NextResponse.json({ logs });
}
