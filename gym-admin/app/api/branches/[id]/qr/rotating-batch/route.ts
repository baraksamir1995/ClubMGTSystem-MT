import { NextResponse, type NextRequest } from 'next/server';
import { proxyToLaravel } from '@/lib/attendance-offline-proxy';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const MAX_HOURS = 24;
const DEFAULT_HOURS = 12;

/**
 * GET /api/branches/{id}/qr/rotating-batch?hours= → clby-api (PHASE3-CONTRACT §3):
 * consecutive 60 s rotating branch QR tokens for the kiosk screen. `hours` is an
 * integer clamped to 1..24 (default 12). Laravel enforces the permission and
 * branch ownership. Only `{tokens:[{qr,iat,exp}], kid, generated_at}` is returned.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Not found', code: 'not_found' }, { status: 404 });
  const raw = new URL(req.url).searchParams.get('hours');
  const hours = raw && /^\d{1,3}$/.test(raw) ? Math.min(MAX_HOURS, Math.max(1, Number(raw))) : DEFAULT_HOURS;

  const res = await proxyToLaravel(req, `/branches/${params.id.toLowerCase()}/qr/rotating-batch?hours=${hours}`, { method: 'GET' });
  if (!res.ok) return res;
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.tokens)) {
    return NextResponse.json({ error: 'Bad gateway', code: 'upstream_invalid_response' }, { status: 502 });
  }
  const tokens = (body.tokens as Record<string, unknown>[]).map((t) => ({ qr: t?.qr, iat: t?.iat, exp: t?.exp }));
  return NextResponse.json(
    { tokens, kid: body.kid ?? null, generated_at: body.generated_at ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
