import { NextResponse } from 'next/server';
import { laravelApi, resolveGymId } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

const ID = /^[0-9a-fA-F-]{36}$/;

/**
 * GET /api/members/{id}/member-pass → clby-api (PHASE2-CONTRACT; `permission:members,view`
 * enforced by Laravel). Returns `{ qr, expires_at, kid }` for printing a member card.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!ID.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;

  try {
    const res = await laravelApi(`/members/${params.id}/member-pass`, resolved.token);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(json ?? { error: 'Failed' }, { status: res.status });
    }
    return NextResponse.json(
      { qr: json?.qr ?? null, expires_at: json?.expires_at ?? null, kid: json?.kid ?? null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
