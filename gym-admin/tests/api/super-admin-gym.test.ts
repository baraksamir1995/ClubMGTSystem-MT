import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import {
  GET,
  PATCH,
  POST,
  DELETE,
} from '@/app/api/super-admin/gyms/[id]/route';

function req(body?: any) {
  return new Request('http://t/api/super-admin/gyms/g-1', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  }) as any;
}

const ctx = { params: { id: 'g-1' } };

/**
 * Stub fetch so the resolveSuperAdmin() pre-flight (/super-admin/me)
 * succeeds, and every other call gets `backendResponse`. Returns the
 * mock; use backendCall() to get the [url, init] of the forwarded
 * request (the /me call is filtered out).
 */
function stubFetch(backendResponse: { ok: boolean; status?: number; json: () => Promise<any> }) {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith('/api/super-admin/me')) {
      return { ok: true, json: async () => ({ role: 'super_admin' }) };
    }
    return backendResponse;
  });
  vi.stubGlobal('fetch', fetchMock);
  const backendCall = () =>
    fetchMock.mock.calls.find(([u]: [string]) => !u.endsWith('/api/super-admin/me')) as [string, RequestInit];
  return { fetchMock, backendCall };
}

describe('super-admin gyms [id] route', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when no auth cookie', async () => {
      cookieGet.mockReturnValue(undefined);
      const res = await GET(req() as any, ctx);
      expect(res.status).toBe(401);
    });

    it('rejects non-super-admin callers with 403', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ role: 'gym_admin' }),
        }),
      );
      const res = await GET(req() as any, ctx);
      expect(res.status).toBe(403);
    });

    it('forwards request with bearer token and passes through 200 response', async () => {
      cookieGet.mockReturnValue({ value: 'super-tok' });
      const { backendCall } = stubFetch({
        ok: true,
        json: async () => ({ id: 'g-1', name: 'Swap' }),
      });

      const res = await GET(req() as any, ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: 'g-1', name: 'Swap' });
      const [url, init] = backendCall();
      expect(url).toMatch(/\/api\/super-admin\/gyms\/g-1$/);
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer super-tok');
    });

    it('propagates backend error status', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      stubFetch({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });
      const res = await GET(req() as any, ctx);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not found' });
    });
  });

  describe('PATCH', () => {
    it('returns 401 when no auth cookie', async () => {
      cookieGet.mockReturnValue(undefined);
      const res = await PATCH(req({ name: 'X' }) as any, ctx);
      expect(res.status).toBe(401);
    });

    it('forwards JSON body to Laravel PATCH endpoint', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      const { backendCall } = stubFetch({
        ok: true,
        json: async () => ({ id: 'g-1', name: 'Updated' }),
      });

      const res = await PATCH(req({ name: 'Updated' }) as any, ctx);
      expect(res.status).toBe(200);
      const [, init] = backendCall();
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ name: 'Updated' }));
    });
  });

  describe('POST (toggle-active)', () => {
    it('hits the toggle-active sub-path', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      const { backendCall } = stubFetch({
        ok: true,
        json: async () => ({ is_active: false }),
      });

      const res = await POST(req() as any, ctx);
      expect(res.status).toBe(200);
      const [url, init] = backendCall();
      expect(url).toMatch(/\/api\/super-admin\/gyms\/g-1\/toggle-active$/);
      expect(init.method).toBe('POST');
    });
  });

  describe('DELETE', () => {
    it('forwards DELETE to Laravel and returns success', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      const { backendCall } = stubFetch({
        ok: true,
        json: async () => ({ message: "Gym 'Swap' deleted" }),
      });

      const res = await DELETE(req() as any, ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Gym 'Swap' deleted" });
      const [url, init] = backendCall();
      expect(url).toMatch(/\/api\/super-admin\/gyms\/g-1$/);
      expect(init.method).toBe('DELETE');
    });

    it('passes through backend failure', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      stubFetch({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Foreign key constraint' }),
      });
      const res = await DELETE(req() as any, ctx);
      expect(res.status).toBe(409);
    });
  });
});
