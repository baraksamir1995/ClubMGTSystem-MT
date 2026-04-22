import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { POST as changePasswordPost } from '@/app/api/auth/change-password/route';

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    vi.restoreAllMocks();
  });

  it('calls the backend and clears the auth cookie', async () => {
    cookieGet.mockReturnValue({ value: 'live-token' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const res = await logoutPost();

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/logout$/);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer live-token');

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/auth_token=/);
    expect(setCookie).toMatch(/Max-Age=0/i);
  });

  it('skips the backend call and still clears cookie when no token', async () => {
    cookieGet.mockReturnValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await logoutPost();

    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get('set-cookie')).toMatch(/auth_token=/);
  });

  it('still clears the cookie when the backend fetch rejects', async () => {
    cookieGet.mockReturnValue({ value: 'tok' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const res = await logoutPost();

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i);
  });
});

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    vi.restoreAllMocks();
  });

  function makeReq(body: any) {
    return new Request('http://t/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }) as any;
  }

  it('returns 401 when no auth cookie', async () => {
    cookieGet.mockReturnValue(undefined);
    const res = await changePasswordPost(makeReq({ current: 'x', next: 'y' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('forwards the request body to Laravel with bearer auth', async () => {
    cookieGet.mockReturnValue({ value: 'tok42' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Password updated' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await changePasswordPost(
      makeReq({ current_password: 'a', new_password: 'b' }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Password updated' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/change-password$/);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok42');
    expect(init.body).toBe(JSON.stringify({ current_password: 'a', new_password: 'b' }));
  });

  it('passes through backend error status and body', async () => {
    cookieGet.mockReturnValue({ value: 'tok' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ errors: { new_password: ['too short'] } }),
      }),
    );

    const res = await changePasswordPost(makeReq({ new_password: 'x' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ errors: { new_password: ['too short'] } });
  });
});
