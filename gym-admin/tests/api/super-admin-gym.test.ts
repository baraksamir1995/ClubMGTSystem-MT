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

    it('forwards request with bearer token and passes through 200 response', async () => {
      cookieGet.mockReturnValue({ value: 'super-tok' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'g-1', name: 'Swap' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await GET(req() as any, ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: 'g-1', name: 'Swap' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/api\/super-admin\/gyms\/g-1$/);
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer super-tok');
    });

    it('propagates backend error status', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        }),
      );
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
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'g-1', name: 'Updated' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await PATCH(req({ name: 'Updated' }) as any, ctx);
      expect(res.status).toBe(200);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ name: 'Updated' }));
    });
  });

  describe('POST (toggle-active)', () => {
    it('hits the toggle-active sub-path', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ is_active: false }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await POST(req() as any, ctx);
      expect(res.status).toBe(200);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/api\/super-admin\/gyms\/g-1\/toggle-active$/);
      expect(init.method).toBe('POST');
    });
  });

  describe('DELETE', () => {
    it('forwards DELETE to Laravel and returns success', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Gym 'Swap' deleted" }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await DELETE(req() as any, ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Gym 'Swap' deleted" });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/api\/super-admin\/gyms\/g-1$/);
      expect(init.method).toBe('DELETE');
    });

    it('passes through backend failure', async () => {
      cookieGet.mockReturnValue({ value: 'tok' });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: async () => ({ error: 'Foreign key constraint' }),
        }),
      );
      const res = await DELETE(req() as any, ctx);
      expect(res.status).toBe(409);
    });
  });
});
