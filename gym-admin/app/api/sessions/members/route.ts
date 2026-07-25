import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';
import { mapSessionMemberRow, mapMeta, mapStats } from '@/lib/sessions-tracker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const sp = request.nextUrl.searchParams;
  const params = new URLSearchParams();
  params.set('page', sp.get('page') ?? '1');
  params.set('per_page', sp.get('per_page') ?? '10');
  if (sp.get('search')) params.set('search', sp.get('search')!);
  if (sp.get('sort')) params.set('sort', sp.get('sort')!);
  if (sp.get('dir')) params.set('dir', sp.get('dir')!);

  const res = await laravelApi(`/sessions/members?${params.toString()}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });

  return NextResponse.json({
    members: (json.data ?? []).map(mapSessionMemberRow),
    meta: mapMeta(json.meta),
    stats: mapStats(json.stats),
  });
}
