/**
 * Laravel API client.
 *
 * Server-side: uses BACKEND_URL (internal, e.g. http://localhost:8080)
 * Client-side: uses NEXT_PUBLIC_API_URL (public, proxied through Next.js or direct)
 *
 * Auth token is stored in an httpOnly cookie named `auth_token`.
 */

import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Server-side API client (for use in API routes and server components).
 * Automatically attaches the auth token from cookies.
 */
export async function api(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
) {
  const url = `${BACKEND_URL}/api${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (!options.skipAuth) {
    const cookieStore = await cookies();
    const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });

  return res;
}

/**
 * Convenience: GET request.
 */
export async function apiGet(path: string) {
  return api(path, { method: 'GET' });
}

/**
 * Convenience: POST request with JSON body.
 */
export async function apiPost(path: string, body?: unknown) {
  return api(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience: PUT request with JSON body.
 */
export async function apiPut(path: string, body?: unknown) {
  return api(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience: PATCH request with JSON body.
 */
export async function apiPatch(path: string, body?: unknown) {
  return api(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience: DELETE request.
 */
export async function apiDelete(path: string, body?: unknown) {
  return api(path, {
    method: 'DELETE',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Upload a file via multipart/form-data.
 */
export async function apiUpload(path: string, formData: FormData) {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(`${BACKEND_URL}/api${path}`, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });
}
