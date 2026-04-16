/**
 * Browser-side API client — for use in 'use client' components.
 * Calls Next.js API routes (which proxy to Laravel), NOT Laravel directly.
 *
 * For login/logout, calls Laravel directly via NEXT_PUBLIC_API_URL.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Fetch wrapper for calling Next.js API routes from the browser.
 * These routes handle auth and proxy to Laravel.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Login via Laravel API directly, store token in cookie.
 */
export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res;
}

/**
 * Logout — clears the auth cookie via Next.js API route.
 */
export async function logout() {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  return res;
}
