import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  if (searchParams.get('from')) params.set('from_date', searchParams.get('from')!);
  if (searchParams.get('to')) params.set('to_date', searchParams.get('to')!);
  if (searchParams.get('member_id')) params.set('member_id', searchParams.get('member_id')!);
  if (searchParams.get('access_point')) params.set('access_point', searchParams.get('access_point')!);
  if (searchParams.get('page')) params.set('page', searchParams.get('page')!);
  params.set('limit', searchParams.get('limit') ?? '25');

  const res = await laravelApi(`/attendance?${params}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });
  return NextResponse.json({ logs: json.data ?? [], pagination: json.pagination ?? null });
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi('/attendance', token, {
    method: 'POST',
    body: JSON.stringify({
      gym_member_id: body.memberId,
      check_in_at: body.checkInAt,
      access_point: body.accessPoint,
      method: 'manual',
      branch_id: body.branchId,
      specialist_name: body.specialistName,
      class_session_id: body.classSessionId ?? null,
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json({ id: json.data?.id });
}
