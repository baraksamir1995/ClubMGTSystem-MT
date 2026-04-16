import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi(`/sessions/${params.id}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      session_date: body.date, start_time: body.startTime, end_time: body.endTime,
      capacity: body.capacity, instructor: body.instructor, session_type: body.sessionType,
      location: body.location, branch_id: body.branchId, studio_id: body.studioId,
      walk_in_allowed: body.walkInAllowed, is_published: body.isPublished,
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message }, { status: res.status });
  return NextResponse.json({ ok: true });
}
