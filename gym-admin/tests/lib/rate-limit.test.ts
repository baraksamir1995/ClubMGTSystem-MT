import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRateLimiter } from '@/lib/rate-limit';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the limit', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });

    const r1 = limiter.check('k1');
    const r2 = limiter.check('k1');
    const r3 = limiter.check('k1');

    expect(r1).toMatchObject({ allowed: true, remaining: 2 });
    expect(r2).toMatchObject({ allowed: true, remaining: 1 });
    expect(r3).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('denies the N+1 request within the window', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    limiter.check('k1');
    limiter.check('k1');
    const denied = limiter.check('k1');
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.resetInMs).toBeGreaterThan(0);
    expect(denied.resetInMs).toBeLessThanOrEqual(1000);
  });

  it('tracks keys independently', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(false);
  });

  it('expires timestamps after the window elapses', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check('k').allowed).toBe(true);
    expect(limiter.check('k').allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(limiter.check('k').allowed).toBe(true);
  });

  it('slides the window as older timestamps drop off', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.check('k').allowed).toBe(true);
    vi.advanceTimersByTime(500);
    expect(limiter.check('k').allowed).toBe(true);
    // 2 in window so far
    expect(limiter.check('k').allowed).toBe(false);

    // Advance past the first timestamp only
    vi.advanceTimersByTime(501); // total 1001ms — oldest timestamp falls out
    expect(limiter.check('k').allowed).toBe(true);
  });
});
