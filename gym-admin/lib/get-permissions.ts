import { cache } from 'react';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export type Permission = { module: string; action: string };

async function fetchApi(path: string, token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch the current user's profile. Cached per render cycle via React.cache()
 * so layout + page don't make duplicate /me calls.
 */
export const getMe = cache(async (token: string) => {
  if (!token) return null;
  return fetchApi('/me', token);
});

/**
 * Returns null for gym owners (all actions allowed).
 * Returns a Permission[] for staff (may be empty if no roles assigned).
 *
 * Wrapped in React.cache() so calling it from both layout and page
 * only makes backend requests once per render cycle.
 */
export const getStaffPermissions = cache(async (token: string): Promise<Permission[] | null> => {
  if (!token) return [];

  const me = await getMe(token);
  if (!me) return [];

  const role = me.role;

  // Gym admin = unrestricted
  if (role === 'gym_admin') return null;

  // Staff/trainer — fetch their permissions via the staff roles endpoint
  if (role === 'staff' || role === 'trainer') {
    const staffData = await fetchApi('/staff', token);
    if (!staffData) return [];

    const staffList = staffData?.data ?? staffData ?? [];
    const myStaff = staffList.find((s: any) => s.user_id === me.id);
    if (!myStaff) return null;

    const myRoleIds = (myStaff.roles ?? []).map((r: any) => r.id);
    if (myRoleIds.length === 0) return [];

    // Fetch full roles with permissions
    const rolesData = await fetchApi('/staff/roles', token);
    const allRoles = rolesData?.data ?? rolesData ?? [];

    const permissions: Permission[] = [];
    for (const role of allRoles) {
      if (myRoleIds.includes(role.id)) {
        for (const perm of role.permissions ?? []) {
          permissions.push({ module: perm.module, action: perm.action });
        }
      }
    }
    return permissions;
  }

  return [];
});

/**
 * Check if a user can perform an action.
 * null permissions = admin (always true).
 */
export function can(permissions: Permission[] | null, module: string, action: string): boolean {
  if (permissions === null) return true;
  return permissions.some(p => p.module === module && p.action === action);
}

/**
 * Server-side permission check for API routes.
 */
export async function checkApiPermission(
  token: string,
  module: string,
  action: string,
): Promise<boolean> {
  const perms = await getStaffPermissions(token);
  return can(perms, module, action);
}

/**
 * Convenience guard for API route handlers.
 * Returns a 403 NextResponse if denied, or null if allowed.
 */
export async function denyUnlessPermitted(
  token: string,
  module: string,
  action: string,
): Promise<import('next/server').NextResponse | null> {
  if (await checkApiPermission(token, module, action)) return null;
  const { NextResponse } = await import('next/server');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
