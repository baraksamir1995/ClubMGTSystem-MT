import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

/**
 * Admin proxy for /api/service-attendance — the Services Attendance
 * sub-tab under Attendance.
 *
 * GET  lists recorded service attendance (filterable).
 * POST records one attendance; an 'attended' status deducts a session and
 *      writes the paired Services → Service Logs row on the Laravel side.
 */
const FORWARD = [
  'search', 'gym_member_id', 'assignment_id', 'trainer_id',
  'service_type', 'status', 'date_from', 'date_to', 'limit', 'offset',
];

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const search = req.nextUrl.searchParams;
  const qs = new URLSearchParams();
  for (const key of FORWARD) {
    const v = search.get(key);
    if (v !== null && v !== '') qs.set(key, v);
  }
  const path = `/service-attendance${qs.toString() ? `?${qs}` : ''}`;

  const res = await laravelApi(path, token);
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi('/service-attendance', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json, { status: res.status });
}
