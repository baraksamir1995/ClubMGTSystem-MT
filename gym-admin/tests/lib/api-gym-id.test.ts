import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

describe('resolveGymId', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    vi.restoreAllMocks();
  });

  it('returns 401 when no auth cookie is present', async () => {
    cookieGet.mockReturnValue(undefined);
    const result = await resolveGymId();
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(401);
  });

  it('returns 401 when the backend rejects the token', async () => {
    cookieGet.mockReturnValue({ value: 'bad-token' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );
    const result = await resolveGymId();
    expect(result.response!.status).toBe(401);
  });

  it('returns 403 when the profile has no gym_id', async () => {
    cookieGet.mockReturnValue({ value: 'super-admin-token' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'u1', gym_id: null, role: 'super_admin' }),
      }),
    );
    const result = await resolveGymId();
    expect(result.response!.status).toBe(403);
  });

  it('returns 403 for a regular member even with a gym_id', async () => {
    cookieGet.mockReturnValue({ value: 'member-token' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'u2', gym_id: 'gym-1', role: 'member' }),
      }),
    );
    const result = await resolveGymId();
    expect(result.response!.status).toBe(403);
  });

  it('allows gym_admin / trainer / staff roles', async () => {
    for (const role of ['gym_admin', 'trainer', 'staff']) {
      cookieGet.mockReturnValue({ value: `token-${role}` });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: 'u', gym_id: 'gym-1', role }),
        }),
      );
      const result = await resolveGymId();
      expect(result.response).toBeUndefined();
      expect(result.gymId).toBe('gym-1');
      expect(result.user!.role).toBe(role);
      expect(result.token).toBe(`token-${role}`);
    }
  });

  it('URL-decodes percent-encoded tokens', async () => {
    cookieGet.mockReturnValue({ value: '42%7Cabc' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'u', gym_id: 'g', role: 'gym_admin' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await resolveGymId();
    expect(result.token).toBe('42|abc');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/me'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer 42|abc' }),
      }),
    );
  });

  it('returns 503 when the backend throws', async () => {
    cookieGet.mockReturnValue({ value: 'tok' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await resolveGymId();
    expect(result.response!.status).toBe(503);
  });
});

describe('laravelApi', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('prefixes /api and forwards the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await laravelApi('/gyms', 'my-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/gyms$/);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer my-token');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.cache).toBe('no-store');
  });

  it('merges caller-provided headers on top of defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await laravelApi('/gyms', 'tok', {
      method: 'POST',
      headers: { 'X-Request-Id': 'req-1' },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe('POST');
    expect(headers['X-Request-Id']).toBe('req-1');
    expect(headers.Authorization).toBe('Bearer tok');
  });
});
