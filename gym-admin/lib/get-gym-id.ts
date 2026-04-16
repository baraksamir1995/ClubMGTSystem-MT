import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

/**
 * Returns the gym_id for the current user by calling the Laravel /api/me endpoint.
 * The Laravel backend resolves gym_id from profiles or staff_members.
 */
export async function getGymId(token?: string): Promise<string | null> {
  const authToken = token ?? (await cookies()).get('auth_token')?.value;
  if (!authToken) return null;

  try {
    const res = await fetch(`${BACKEND_URL}/api/me`, {
      headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.gym_id ?? null;
  } catch {
    return null;
  }
}
