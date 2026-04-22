import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { safeErrorResponse } from '@/lib/sanitize-error';
import { apiError, apiOk } from '@/lib/api-response';

async function body<T = any>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

describe('safeErrorResponse', () => {
  it('sanitises internal DB errors into a generic message', async () => {
    const res = safeErrorResponse({
      message: 'relation "secret_internal_table" does not exist',
    });
    expect(res.status).toBe(500);
    expect(await body(res)).toEqual({ error: 'An internal error occurred' });
  });

  it('maps "not found" to a friendly 404-style message', async () => {
    const res = safeErrorResponse({ message: 'member not found' }, 404);
    expect(res.status).toBe(404);
    expect(await body(res)).toEqual({ error: 'Resource not found' });
  });

  it('maps duplicate key errors to a generic internal message', async () => {
    const res = safeErrorResponse({
      message: 'duplicate key value violates unique constraint "members_email_key"',
    });
    expect(await body(res)).toEqual({ error: 'An internal error occurred' });
  });

  it('maps "unauthenticated" text to Unauthorized', async () => {
    const res = safeErrorResponse({ message: 'unauthenticated' }, 401);
    expect(await body(res)).toEqual({ error: 'Unauthorized' });
  });

  it('strips PostgREST hints after " - "', async () => {
    const res = safeErrorResponse({
      message: 'some message - internal DB hint leak',
    });
    expect(await body(res)).toEqual({ error: 'some message' });
  });

  it('caps very long messages with generic text', async () => {
    const res = safeErrorResponse({ message: 'x'.repeat(300) });
    expect(await body(res)).toEqual({ error: 'An error occurred' });
  });
});

describe('apiError / apiOk', () => {
  it('apiError produces the expected shape and status', async () => {
    const res = apiError('nope', 422);
    expect(res.status).toBe(422);
    expect(await body(res)).toEqual({ error: 'nope' });
  });

  it('apiOk wraps data with default 200 status', async () => {
    const res = apiOk({ name: 'ok' });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ name: 'ok' });
  });

  it('apiOk respects custom status', async () => {
    const res = apiOk({ id: 1 }, 201);
    expect(res.status).toBe(201);
  });
});
