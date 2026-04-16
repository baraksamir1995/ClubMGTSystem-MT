import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi(`/sessions/${params.id}/bookings`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });

  const active = (json.data ?? []).filter((b: any) => b.status !== 'cancelled');
  return NextResponse.json({ count: active.length, bookings: active });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { gymMemberId } = await req.json();
  const res = await laravelApi('/bookings', token, {
    method: 'POST',
    body: JSON.stringify({ session_id: params.id, gym_member_id: gymMemberId }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message }, { status: res.status });
  return NextResponse.json({ id: json.data?.id });
}
