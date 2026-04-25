import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  if (searchParams.get('date')) params.set('date', searchParams.get('date')!);
  if (searchParams.get('class_id')) params.set('class_id', searchParams.get('class_id')!);

  const res = await laravelApi(`/sessions${params.toString() ? `?${params}` : ''}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json);
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { classId, date, startTime, endTime, capacity, instructor, sessionType, location, branchId, studioId, walkInAllowed } = await req.json();

  if (sessionType === 'recurring') {
    const res = await laravelApi('/sessions/recurring', token, {
      method: 'POST',
      body: JSON.stringify({
        class_id: classId, start_date: date, start_time: startTime,
        end_time: endTime, capacity, instructor, location,
        studio_id: studioId, branch_id: branchId,
      }),
    });
    const json = await res.json();
    if (!res.ok) return NextResponse.json({ error: json.error ?? json.message }, { status: res.status });

    // Fetch the generated sessions for this template
    const sessionsRes = await laravelApi('/sessions', token);
    const sessionsJson = await sessionsRes.json();
    const allSessions = sessionsJson?.data ?? sessionsJson ?? [];
    const templateId = json.data?.id;
    const generatedSessions = allSessions.filter((s: any) => s.recurring_template_id === templateId);

    return NextResponse.json({ templateId, sessions: generatedSessions });
  }

  const res = await laravelApi('/sessions', token, {
    method: 'POST',
    body: JSON.stringify({
      class_id: classId, session_date: date, start_time: startTime,
      end_time: endTime, capacity, instructor, session_type: sessionType ?? 'popup',
      location, branch_id: branchId, studio_id: studioId, walk_in_allowed: walkInAllowed,
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message }, { status: res.status });
  return NextResponse.json({ id: json.data?.id });
}
