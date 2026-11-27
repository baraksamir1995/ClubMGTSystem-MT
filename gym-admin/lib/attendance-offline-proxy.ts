/**
 * Shared forwarding for the offline-attendance proxies
 * (`/api/attendance/sync`, `/api/attendance/offline/*`).
 *
 * - Auth via `resolveGymIdForSync()` (httpOnly cookie → Bearer). Only a missing
 *   or invalid token is a 401 `auth_required`; an `/api/me` outage is a
 *   retryable 503/429 so the engine backs off instead of pausing. The token
 *   never reaches the browser.
 * - Forwards only an allowlist of client identity headers; `X-App` is forced
 *   to `admin` (this proxy only serves the admin dashboard).
 * - Upstream status + JSON body are passed through unchanged (per-event sync
 *   results must reach the engine verbatim). Non-JSON upstream → 502 JSON.
 *   Upstream unreachable → 503 JSON (the client keeps events pending).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { laravelApi, resolveGymIdForSync } from '@/lib/api-gym-id';

const FORWARDED_HEADERS = ['x-device-id', 'x-app-version', 'x-app-build', 'x-app-platform'] as const;
const HEADER_NAMES: Record<(typeof FORWARDED_HEADERS)[number], string> = {
  'x-device-id': 'X-Device-Id',
  'x-app-version': 'X-App-Version',
  'x-app-build': 'X-App-Build',
  'x-app-platform': 'X-App-Platform',
};
const MAX_HEADER_LEN = 128;

/** 1 MB is far above 50 events × (≤4 KB metadata + fields). */
export const MAX_SYNC_BODY_BYTES = 1_000_000;

/** UTF-8 byte length (string.length counts UTF-16 units). */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function forwardedClientHeaders(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = { 'X-App': 'admin' };
  for (const h of FORWARDED_HEADERS) {
    const v = req.headers.get(h);
    if (v && v.length <= MAX_HEADER_LEN) out[HEADER_NAMES[h]] = v;
  }
  return out;
}

export async function proxyToLaravel(
  req: NextRequest,
  path: string,
  init: { method: 'GET' | 'POST'; body?: string; extraHeaders?: Record<string, string> },
): Promise<NextResponse> {
  const resolved = await resolveGymIdForSync();
  if (resolved.response) return resolved.response;

  let res: Response;
  try {
    res = await laravelApi(path, resolved.token, {
      method: init.method,
      body: init.body,
      headers: { ...forwardedClientHeaders(req), ...(init.extraHeaders ?? {}) },
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable', code: 'upstream_unreachable' }, { status: 503 });
  }

  const retryAfter = res.headers.get('retry-after');
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (retryAfter) headers['Retry-After'] = retryAfter;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return NextResponse.json(
      { error: 'Bad gateway', code: 'upstream_invalid_response' },
      { status: res.ok ? 502 : res.status, headers },
    );
  }
  return NextResponse.json(body, { status: res.status, headers });
}
