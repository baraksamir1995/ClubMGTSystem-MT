import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: <T extends (...args: any[]) => any>(fn: T) => fn };
});

import { can, checkApiPermission, denyUnlessPermitted, getStaffPermissions, getMe } from '@/lib/get-permissions';

describe('can', () => {
  it('returns true when permissions is null (admin)', () => {
    expect(can(null, 'members', 'view')).toBe(true);
  });

  it('returns true when matching permission exists', () => {
    const perms = [{ module: 'members', action: 'view' }];
    expect(can(perms, 'members', 'view')).toBe(true);
  });

  it('returns false when permission missing', () => {
    const perms = [{ module: 'members', action: 'view' }];
    expect(can(perms, 'members', 'edit')).toBe(false);
  });

  it('returns false on empty permissions array', () => {
    expect(can([], 'settings', 'view')).toBe(false);
  });
});

describe('getMe / getStaffPermissions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getMe returns null on empty token', async () => {
    const result = await getMe('');
    expect(result).toBeNull();
  });

  it('getStaffPermissions returns [] on empty token', async () => {
    const result = await getStaffPermissions('');
    expect(result).toEqual([]);
  });

  it('returns null (unrestricted) for gym_admin role', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'u', role: 'gym_admin' }),
      }),
    );
    const result = await getStaffPermissions('token-admin-' + Math.random());
    expect(result).toBeNull();
  });

  it('returns [] for non-staff non-admin roles (member)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'u', role: 'member' }),
      }),
    );
    const result = await getStaffPermissions('token-member-' + Math.random());
    expect(result).toEqual([]);
  });

  it('aggregates permissions across matching staff roles', async () => {
    const token = 'token-staff-' + Math.random();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/me')) {
          return { ok: true, json: async () => ({ id: 'u-1', role: 'staff' }) };
        }
        if (url.endsWith('/api/staff')) {
          return {
            ok: true,
            json: async () => ({
              data: [{ user_id: 'u-1', roles: [{ id: 'r-1' }, { id: 'r-2' }] }],
            }),
          };
        }
        if (url.endsWith('/api/staff/roles')) {
          return {
            ok: true,
            json: async () => ({
              data: [
                { id: 'r-1', permissions: [{ module: 'members', action: 'view' }] },
                {
                  id: 'r-2',
                  permissions: [
                    { module: 'members', action: 'edit' },
                    { module: 'classes', action: 'view' },
                  ],
                },
                { id: 'r-3', permissions: [{ module: 'settings', action: 'edit' }] },
              ],
            }),
          };
        }
        return { ok: false, json: async () => ({}) };
      }),
    );

    const result = await getStaffPermissions(token);
    expect(result).toEqual([
      { module: 'members', action: 'view' },
      { module: 'members', action: 'edit' },
      { module: 'classes', action: 'view' },
    ]);
  });

  it('returns null when staff member has no matching record (treated as unrestricted edge case)', async () => {
    const token = 'token-ghost-' + Math.random();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/me')) {
          return { ok: true, json: async () => ({ id: 'u-1', role: 'staff' }) };
        }
        if (url.endsWith('/api/staff')) {
          return { ok: true, json: async () => ({ data: [] }) };
        }
        return { ok: false, json: async () => ({}) };
      }),
    );

    const result = await getStaffPermissions(token);
    expect(result).toBeNull();
  });
});

describe('checkApiPermission / denyUnlessPermitted', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('checkApiPermission true for admin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'u', role: 'gym_admin' }),
      }),
    );
    const result = await checkApiPermission('tok-' + Math.random(), 'anything', 'any');
    expect(result).toBe(true);
  });

  it('denyUnlessPermitted returns null when permitted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'u', role: 'gym_admin' }),
      }),
    );
    const result = await denyUnlessPermitted('tok-' + Math.random(), 'members', 'view');
    expect(result).toBeNull();
  });

  it('denyUnlessPermitted returns 403 when denied', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'u', role: 'member' }),
      }),
    );
    const result = await denyUnlessPermitted('tok-' + Math.random(), 'members', 'view');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});
