import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { gymMemberId } = await req.json();
  if (!gymMemberId) return NextResponse.json({ error: 'gymMemberId required' }, { status: 400 });

  // Find today's session for this class
  const today = new Date().toISOString().slice(0, 10);
  const sessRes = await laravelApi(`/sessions?class_id=${params.id}&date=${today}`, token);
  const sessJson = await sessRes.json();
  const sessions = (sessJson.data ?? []).filter((s: any) => s.status !== 'cancelled');

  if (!sessions.length) return NextResponse.json({ error: 'No active session for this class today' }, { status: 404 });

  const res = await laravelApi(`/sessions/${sessions[0].id}/checkin`, token, {
    method: 'POST',
    body: JSON.stringify({ gym_member_id: gymMemberId }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json({ ok: true, sessionId: sessions[0].id, bookingId: json.data?.id });
}
