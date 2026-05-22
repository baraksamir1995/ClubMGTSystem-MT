import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

/**
 * Admin proxy for /api/service-logs — listing of every coach-logged
 * session in the gym. Forwards `q`, `trainer_id`, `branch_id`, `limit`,
 * `offset` to the Laravel side.
 */
export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const search = req.nextUrl.searchParams;
  const qs = new URLSearchParams();
  for (const key of ['q', 'trainer_id', 'branch_id', 'limit', 'offset']) {
    const v = search.get(key);
    if (v !== null && v !== '') qs.set(key, v);
  }
  const path = `/service-logs${qs.toString() ? `?${qs}` : ''}`;

  const res = await laravelApi(path, token);
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}
