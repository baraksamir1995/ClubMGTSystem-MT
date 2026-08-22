import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

/**
 * Step 1 of the record-attendance flow: members holding at least one
 * service package with sessions left.
 */
export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const search = req.nextUrl.searchParams.get('search');
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';

  const res = await laravelApi(`/service-attendance/members${qs}`, token);
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}
