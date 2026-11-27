import { NextResponse, type NextRequest } from 'next/server';
import { proxyToLaravel } from '@/lib/attendance-offline-proxy';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * GET /api/branches/{id}/qr?mode=static → clby-api (PHASE3-CONTRACT §3): a signed
 * v2 static branch QR for printing. Laravel enforces `permission:attendance,view`
 * and that the branch belongs to the caller's gym; here the id must be a UUID
 * (no path tricks) and only `mode=static` is forwarded. Only the documented
 * fields are returned.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Not found', code: 'not_found' }, { status: 404 });
  const mode = new URL(req.url).searchParams.get('mode') ?? 'static';
  if (mode !== 'static') return NextResponse.json({ error: 'Unsupported mode', code: 'invalid_mode' }, { status: 422 });

  const res = await proxyToLaravel(req, `/branches/${params.id.toLowerCase()}/qr?mode=static`, { method: 'GET' });
  if (!res.ok) return res;
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.qr !== 'string') {
    return NextResponse.json({ error: 'Bad gateway', code: 'upstream_invalid_response' }, { status: 502 });
  }
  return NextResponse.json(
    { qr: body.qr, mode: 'static', expires_at: body.expires_at ?? null, kid: body.kid ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
