import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import { POST as syncPost } from '@/app/api/attendance/sync/route';
import { GET as bootstrapGet } from '@/app/api/attendance/offline/bootstrap/route';
import { GET as statusGet } from '@/app/api/attendance/offline/status/route';
import { GET as eventsGet } from '@/app/api/attendance/offline/events/route';
import { GET as memberPassGet } from '@/app/api/members/[id]/member-pass/route';
import { middleware } from '@/middleware';
import { resolveGymId } from '@/lib/api-gym-id';
import { POST as attendancePost } from '@/app/api/attendance/route';

const ME = { id: 'u1', gym_id: 'gym-1', role: 'staff' };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** fetch mock: /api/me → ME, everything else → `upstream` */
function backend(upstream: () => Response | Promise<Response>) {
  return vi.fn(async (url: string) => (String(url).endsWith('/api/me') ? json(ME) : upstream()));
}

function upstreamCall(fetchMock: ReturnType<typeof backend>) {
  const call = fetchMock.mock.calls.find(([u]) => !String(u).endsWith('/api/me')) as unknown as [string, RequestInit];
  return { url: call[0], init: call[1], headers: call[1].headers as Record<string, string> };
}

const syncBody = { device_id: 'dev-1', app: 'admin', app_version: '1.0', events: [{ event_id: 'e1' }] };

function syncReq(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://t/api/attendance/sync', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('offline attendance proxies', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    vi.restoreAllMocks();
  });

  // Each test uses a distinct token: resolveGymId caches /api/me for 5 s per token.
  let n = 0;
  // resolveGymId caches /api/me by the token's LAST 16 chars → make them unique.
  const login = () => cookieGet.mockReturnValue({ value: `1|token-${String(++n).padStart(16, '0')}` });

  it('POST /sync without cookie → JSON 401 and no upstream call', async () => {
    cookieGet.mockReturnValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await syncPost(syncReq(JSON.stringify(syncBody)));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized', code: 'auth_required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /sync forwards the body verbatim with bearer + client headers, X-App forced to admin', async () => {
    login();
    const upstreamBody = { server_time: 'now', results: [{ event_id: 'e1', status: 'accepted', code: 'created' }] };
    const fetchMock = backend(() => json(upstreamBody));
    vi.stubGlobal('fetch', fetchMock);
    const raw = JSON.stringify(syncBody);
    const res = await syncPost(
      syncReq(raw, {
        'x-device-id': 'dev-1', 'x-app': 'member', 'x-app-version': '1.0', 'x-app-build': '42', 'x-app-platform': 'web', 'x-evil': '1',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(upstreamBody);
    const { url, init, headers } = upstreamCall(fetchMock);
    expect(url).toBe('http://backend.test/api/attendance/sync');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(raw);
    expect(headers.Authorization).toMatch(/^Bearer 1\|token-\d{16}$/);
    expect(headers).toMatchObject({
      'X-Device-Id': 'dev-1', 'X-App': 'admin', 'X-App-Version': '1.0', 'X-App-Build': '42', 'X-App-Platform': 'web',
    });
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('x-evil');
  });

  it('POST /sync falls back to body.device_id for X-Device-Id', async () => {
    login();
    const fetchMock = backend(() => json({ server_time: 'x', results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await syncPost(syncReq(JSON.stringify(syncBody)));
    expect(upstreamCall(fetchMock).headers['X-Device-Id']).toBe('dev-1');
  });

  it('POST /sync rejects invalid JSON with 422 before calling upstream', async () => {
    login();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await syncPost(syncReq('{not json'));
    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 422, 429])('POST /sync passes upstream %i through as JSON', async (status) => {
    login();
    vi.stubGlobal('fetch', backend(() => json({ message: 'x', code: status === 403 ? 'device_revoked' : 'x' }, status, { 'retry-after': '12' })));
    const res = await syncPost(syncReq(JSON.stringify(syncBody)));
    expect(res.status).toBe(status);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.headers.get('retry-after')).toBe('12');
  });

  it('POST /sync: non-JSON upstream 500 stays a JSON 500; unreachable upstream → 503', async () => {
    login();
    vi.stubGlobal('fetch', backend(() => new Response('<html>oops</html>', { status: 500 })));
    const r1 = await syncPost(syncReq(JSON.stringify(syncBody)));
    expect(r1.status).toBe(500);
    expect(await r1.json()).toMatchObject({ code: 'upstream_invalid_response' });

    login();
    vi.stubGlobal('fetch', backend(() => Promise.reject(new TypeError('ECONNREFUSED'))));
    const r2 = await syncPost(syncReq(JSON.stringify(syncBody)));
    expect(r2.status).toBe(503);
  });

  it('POST /sync: members are refused (403) by resolveGymId', async () => {
    cookieGet.mockReturnValue({ value: `member-token-${'y'.repeat(16)}` });
    vi.stubGlobal('fetch', vi.fn(async () => json({ id: 'm', gym_id: 'gym-1', role: 'member' })));
    expect((await syncPost(syncReq(JSON.stringify(syncBody)))).status).toBe(403);
  });

  // ── MEDIUM-1: an /api/me outage must not look like a logout ──────────────

  const meFails = (me: () => Response | Promise<Response>) =>
    vi.fn(async (url: string) => (String(url).endsWith('/api/me') ? me() : json({ server_time: 'x', results: [] })));

  it('/api/me 401 → 401 auth_required (genuinely invalid token)', async () => {
    login();
    vi.stubGlobal('fetch', meFails(() => json({ message: 'Unauthenticated.' }, 401)));
    const res = await syncPost(syncReq(JSON.stringify(syncBody)));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized', code: 'auth_required' });
  });

  it.each([500, 502, 503])('/api/me %i → retryable 503 upstream_unavailable (no upstream sync call)', async (status) => {
    login();
    const fetchMock = meFails(() => new Response('oops', { status }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await syncPost(syncReq(JSON.stringify(syncBody)));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: 'upstream_unavailable', retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('/api/me 429 → 429 upstream_rate_limited with Retry-After', async () => {
    login();
    vi.stubGlobal('fetch', meFails(() => json({ message: 'Too Many Attempts.' }, 429, { 'retry-after': '42' })));
    const res = await bootstrapGet(new NextRequest('http://t/api/attendance/offline/bootstrap'));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(await res.json()).toMatchObject({ code: 'upstream_rate_limited', retryable: true });
  });

  it('/api/me network failure → 503', async () => {
    login();
    vi.stubGlobal('fetch', meFails(() => Promise.reject(new TypeError('ECONNREFUSED'))));
    expect((await statusGet(new NextRequest('http://t/api/attendance/offline/status'))).status).toBe(503);
  });

  it('backwards compatible: resolveGymId() for other routes still maps /api/me 500 → 401', async () => {
    login();
    vi.stubGlobal('fetch', meFails(() => new Response('oops', { status: 500 })));
    const r = await resolveGymId();
    expect(r.response?.status).toBe(401);
    expect(await r.response!.json()).toEqual({ error: 'Unauthorized' });
  });

  it('POST /sync body limit counts UTF-8 bytes, not UTF-16 units', async () => {
    login();
    const fetchMock = backend(() => json({ server_time: 'x', results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    // ~600k chars of a 3-byte character ≈ 1.8 MB
    const big = JSON.stringify({ ...syncBody, pad: '\u20ac'.repeat(600_000) });
    expect(big.length).toBeLessThan(1_000_000);
    const res = await syncPost(syncReq(big));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /offline/bootstrap forwards cursor + limit only', async () => {
    login();
    const fetchMock = backend(() => json({ as_of: 'x', members: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await bootstrapGet(
      new NextRequest('http://t/api/attendance/offline/bootstrap?cursor=abc&limit=200&gym_id=evil', { headers: { 'x-device-id': 'd1' } }),
    );
    expect(res.status).toBe(200);
    const { url, init, headers } = upstreamCall(fetchMock);
    expect(url).toBe('http://backend.test/api/attendance/offline/bootstrap?cursor=abc&limit=200');
    expect(init.method).toBe('GET');
    expect(headers['X-Device-Id']).toBe('d1');
  });

  it('GET /offline/status forwards device_id', async () => {
    login();
    const fetchMock = backend(() => json({ enabled: false }));
    vi.stubGlobal('fetch', fetchMock);
    await statusGet(new NextRequest('http://t/api/attendance/offline/status?device_id=dev-7'));
    expect(upstreamCall(fetchMock).url).toBe('http://backend.test/api/attendance/offline/status?device_id=dev-7');
  });

  it('GET /offline/events forwards only known filters (PHASE2 review endpoint)', async () => {
    login();
    const fetchMock = backend(() => json({ data: [], next_cursor: null }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await eventsGet(
      new NextRequest('http://t/api/attendance/offline/events?result=rejected&needs_review=1&cursor=c1&gym_id=evil&result2=x'),
    );
    expect(res.status).toBe(200);
    expect(upstreamCall(fetchMock).url).toBe('http://backend.test/api/attendance/offline/events?result=rejected&needs_review=1&cursor=c1');
  });

  it('GET /offline/events forwards result=error and caps limit at 200', async () => {
    login();
    const fetchMock = backend(() => json({ data: [], next_cursor: null }));
    vi.stubGlobal('fetch', fetchMock);
    await eventsGet(new NextRequest('http://t/api/attendance/offline/events?result=error&limit=999'));
    expect(upstreamCall(fetchMock).url).toBe('http://backend.test/api/attendance/offline/events?result=error&limit=200');
    login();
    const f2 = backend(() => json({ data: [], next_cursor: null }));
    vi.stubGlobal('fetch', f2);
    await eventsGet(new NextRequest('http://t/api/attendance/offline/events?limit=25'));
    expect(upstreamCall(f2).url).toBe('http://backend.test/api/attendance/offline/events?limit=25');
    login();
    const f3 = backend(() => json({ data: [], next_cursor: null }));
    vi.stubGlobal('fetch', f3);
    await eventsGet(new NextRequest('http://t/api/attendance/offline/events?limit=0&limit=abc'));
    expect(upstreamCall(f3).url).toBe('http://backend.test/api/attendance/offline/events');
  });

  it('GET /offline/events drops an unknown result value', async () => {
    login();
    const fetchMock = backend(() => json({ data: [], next_cursor: null }));
    vi.stubGlobal('fetch', fetchMock);
    await eventsGet(new NextRequest('http://t/api/attendance/offline/events?result=everything'));
    expect(upstreamCall(fetchMock).url).toBe('http://backend.test/api/attendance/offline/events');
  });

  it('GET /api/members/{id}/member-pass returns only {qr, expires_at, kid}', async () => {
    login();
    const id = '11111111-2222-3333-4444-555555555555';
    const fetchMock = backend(() => json({ qr: '{"t":"clby_mp"}', expires_at: '2026-12-26T00:00:00Z', kid: 'k1', extra: 'nope' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await memberPassGet(new Request(`http://t/api/members/${id}/member-pass`), { params: { id } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ qr: '{"t":"clby_mp"}', expires_at: '2026-12-26T00:00:00Z', kid: 'k1' });
    expect(upstreamCall(fetchMock).url).toBe(`http://backend.test/api/members/${id}/member-pass`);
  });

  it('GET /api/members/{id}/member-pass rejects a non-uuid id and passes upstream 403', async () => {
    login();
    const fetchMock = backend(() => json({ error: 'Forbidden' }, 403));
    vi.stubGlobal('fetch', fetchMock);
    expect((await memberPassGet(new Request('http://t/x'), { params: { id: '../../me' } })).status).toBe(404);
    const id = '11111111-2222-3333-4444-555555555555';
    expect((await memberPassGet(new Request('http://t/x'), { params: { id } })).status).toBe(403);
  });

  it('GET /offline/* without cookie → JSON 401', async () => {
    cookieGet.mockReturnValue(undefined);
    expect((await bootstrapGet(new NextRequest('http://t/api/attendance/offline/bootstrap'))).status).toBe(401);
    expect((await statusGet(new NextRequest('http://t/api/attendance/offline/status'))).status).toBe(401);
  });
});

describe('middleware: offline attendance APIs return JSON 401 instead of the login redirect', () => {
  const req = (path: string, token?: string) => {
    const r = new NextRequest(`http://t${path}`);
    if (token) r.cookies.set('auth_token', token);
    return r;
  };

  it.each(['/api/attendance/sync', '/api/attendance/offline/bootstrap', '/api/attendance/offline/status', '/api/attendance/offline/events', '/api/members/11111111-2222-3333-4444-555555555555/member-pass'])(
    '%s without cookie → 401 JSON',
    async (path) => {
      const res = await middleware(req(path));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Unauthorized', code: 'auth_required' });
    },
  );

  it.each(['/api/attendance', '/api/attendance/syncx', '/api/attendance/offline', '/dashboard/attendance', '/api/members', '/api/members/x', '/api/members/x/member-pass/extra'])(
    '%s without cookie still redirects to /login (unchanged)',
    async (path) => {
      const res = await middleware(req(path));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://t/login');
    },
  );

  it('with a cookie the offline APIs pass through', async () => {
    const res = await middleware(req('/api/attendance/sync', 'tok'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('existing POST /api/attendance: method allowlist (policy-off staff QR)', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    vi.restoreAllMocks();
  });

  it.each([
    [{ method: 'qr' }, 'qr'],
    [{}, 'manual'],
    [{ method: 'staff_qr' }, 'manual'],
    [{ method: 'anything' }, 'manual'],
  ])('body %j → method %s', async (extra, expected) => {
    cookieGet.mockReturnValue({ value: `1|token-method-${expected}-${JSON.stringify(extra).length}-${'z'.repeat(16)}` });
    const fetchMock = backend(() => json({ data: { id: 'att-1' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await attendancePost(
      new NextRequest('http://t/api/attendance', { method: 'POST', body: JSON.stringify({ memberId: 'm1', ...extra }), headers: { 'content-type': 'application/json' } }),
    );
    expect(res.status).toBe(200);
    expect(JSON.parse(String(upstreamCall(fetchMock).init.body)).method).toBe(expected);
  });
});

