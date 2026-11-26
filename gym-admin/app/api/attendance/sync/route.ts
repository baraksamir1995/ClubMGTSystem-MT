import { NextResponse, type NextRequest } from 'next/server';
import { MAX_SYNC_BODY_BYTES, proxyToLaravel } from '@/lib/attendance-offline-proxy';

export const dynamic = 'force-dynamic';

/**
 * POST /api/attendance/sync → clby-api POST /api/attendance/sync
 * (CONTRACT §2). The body is forwarded verbatim; per-event results come back
 * unchanged. Laravel derives gym/actor from the token and validates each event.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_SYNC_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large', code: 'payload_too_large' }, { status: 413 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'invalid_envelope' }, { status: 422 });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Invalid envelope', code: 'invalid_envelope' }, { status: 422 });
  }

  // Fall back to the body's device_id when the client didn't send the header.
  const extraHeaders: Record<string, string> = {};
  const bodyDeviceId = (parsed as { device_id?: unknown }).device_id;
  if (!req.headers.get('x-device-id') && typeof bodyDeviceId === 'string' && bodyDeviceId.length <= 128) {
    extraHeaders['X-Device-Id'] = bodyDeviceId;
  }

  return proxyToLaravel(req, '/attendance/sync', { method: 'POST', body: raw, extraHeaders });
}
