import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { gymMemberId } = await req.json();
  if (!gymMemberId) return NextResponse.json({ error: 'gymMemberId required' }, { status: 400 });

  const res = await laravelApi(`/sessions/${params.id}/checkin`, token, {
    method: 'POST',
    body: JSON.stringify({ gym_member_id: gymMemberId }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message }, { status: res.status });
  return NextResponse.json({ ok: true, bookingId: json.data?.id });
}
