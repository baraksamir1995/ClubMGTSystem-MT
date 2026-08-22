import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

/**
 * Service package assignments that can still take a session — drives the
 * package picker in the record-attendance modal. Service-agnostic: every
 * active session package is returned whatever its service type.
 */
export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const search = req.nextUrl.searchParams;
  const qs = new URLSearchParams();
  for (const key of ['gym_member_id', 'service_type', 'search']) {
    const v = search.get(key);
    if (v !== null && v !== '') qs.set(key, v);
  }
  const path = `/service-attendance/assignments${qs.toString() ? `?${qs}` : ''}`;

  const res = await laravelApi(path, token);
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}
