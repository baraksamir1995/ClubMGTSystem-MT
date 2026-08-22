import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

/**
 * Step 3 of the record-attendance flow: specialists eligible for the
 * chosen package, scoped to that package's service type.
 */
export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const assignmentId = req.nextUrl.searchParams.get('assignment_id');
  if (!assignmentId) {
    return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 });
  }

  const res = await laravelApi(
    `/service-attendance/specialists?assignment_id=${encodeURIComponent(assignmentId)}`,
    token,
  );
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}
