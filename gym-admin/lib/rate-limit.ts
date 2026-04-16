/**
 * In-process sliding-window rate limiter.
 *
 * Works without any external dependency (no Redis, no Upstash).
 * Suitable for single-instance Next.js deployments.
 *
 * Limitation: state is per-process. If you scale to multiple instances,
 * replace this with Upstash Redis rate limiting (@upstash/ratelimit).
 *
 * Usage:
 *   const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
 *   const result  = limiter.check('gym:abc123');
 *   if (!result.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface RateLimiterOptions {
  /** Max number of requests allowed within the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

interface WindowEntry {
  timestamps: number[];
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { limit, windowMs } = options;
  const store = new Map<string, WindowEntry>();

  // Periodically clean up expired entries to prevent memory leaks
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  };
  // Run cleanup every 5 minutes
  setInterval(cleanup, 5 * 60 * 1000).unref();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(key) ?? { timestamps: [] };

      // Drop timestamps outside the current window
      entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

      if (entry.timestamps.length >= limit) {
        const oldest   = entry.timestamps[0];
        const resetInMs = windowMs - (now - oldest);
        return { allowed: false, remaining: 0, resetInMs };
      }

      entry.timestamps.push(now);
      store.set(key, entry);

      return {
        allowed:   true,
        remaining: limit - entry.timestamps.length,
        resetInMs: 0,
      };
    },
  };
}
