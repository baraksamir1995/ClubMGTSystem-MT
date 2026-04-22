import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookieGet }),
}));

import { backendFetch, backendJson } from '@/lib/backend-client';

describe('backendFetch', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    vi.restoreAllMocks();
  });

  it('sends Authorization header when cookie present', async () => {
    cookieGet.mockReturnValue({ value: 'abc123' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await backendFetch('/classes');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/classes$/);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer abc123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.cache).toBe('no-store');
  });

  it('omits Authorization when no cookie', async () => {
    cookieGet.mockReturnValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await backendFetch('/public-endpoint');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('URL-decodes token value (Sanctum pipe)', async () => {
    cookieGet.mockReturnValue({ value: '42%7Cabc' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await backendFetch('/me');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer 42|abc');
  });

  it('forwards method and body and overrides default headers last', async () => {
    cookieGet.mockReturnValue({ value: 'tok' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await backendFetch('/classes', {
      method: 'POST',
      body: JSON.stringify({ name: 'x' }),
      headers: { 'X-Custom': 'yes' },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
    expect(headers['X-Custom']).toBe('yes');
    expect(headers.Authorization).toBe('Bearer tok');
  });
});

describe('backendJson', () => {
  beforeEach(() => {
    cookieGet.mockReset();
    cookieGet.mockReturnValue({ value: 't' });
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [1, 2, 3] }),
      }),
    );
    const result = await backendJson<{ data: number[] }>('/x');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('throws with status + message on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable',
        json: async () => ({ message: 'validation failed' }),
      }),
    );
    await expect(backendJson('/x')).rejects.toMatchObject({
      message: 'validation failed',
      status: 422,
    });
  });

  it('falls back to statusText when response body has no error/message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('no body');
        },
      }),
    );
    await expect(backendJson('/x')).rejects.toMatchObject({
      message: 'Internal Server Error',
      status: 500,
    });
  });
});
