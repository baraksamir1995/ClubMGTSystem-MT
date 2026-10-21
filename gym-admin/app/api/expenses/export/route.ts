import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

// Unpaginated expense set + summary for the CSV export. The client builds
// the file (localised headers), but the rows come from the backend so the
// export never depends on which table page is on screen.
const FORWARD = ['from', 'to'];

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  for (const key of FORWARD) {
    const v = searchParams.get(key);
    if (v) params.set(key, v);
  }

  const res = await laravelApi(`/expenses/export${params.toString() ? `?${params}` : ''}`, token);
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}
