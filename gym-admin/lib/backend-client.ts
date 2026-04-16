/**
 * Backend HTTP client for gym-admin → Laravel API proxy.
 *
 * Uses the Laravel auth_token cookie for authentication.
 * Laravel validates the token, extracts gymId from the profile,
 * and enforces tenant isolation in each controller.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   const res = await backendFetch('/classes');
 *   const data = await res.json();
 *
 * ── Configuration ─────────────────────────────────────────────────────────────
 *
 * Set BACKEND_URL in .env.local (never expose publicly):
 *   BACKEND_URL=http://localhost:8080          # local
 *   BACKEND_URL=https://api.yourdomain.com     # production
 */

import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Forwards a request to the Laravel backend with the current user's auth token.
 * All gym isolation is enforced by Laravel using the authenticated user.
 *
 * @param path  API path including query string, e.g. '/classes?page=1'
 * @param init  Standard RequestInit (method, headers, body, etc.)
 */
export async function backendFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init?.headers ?? {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${BACKEND_URL}/api${path}`, { ...init, headers, cache: 'no-store' });
}

/**
 * Convenience wrapper that parses JSON and throws on non-2xx responses.
 */
export async function backendJson<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await backendFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(body?.message ?? body?.error ?? 'Backend error'), {
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}
