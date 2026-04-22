import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const resolveGymId = vi.fn();
const laravelApi = vi.fn();

vi.mock('@/lib/api-gym-id', () => ({
  resolveGymId: (...args: any[]) => resolveGymId(...args),
  laravelApi: (...args: any[]) => laravelApi(...args),
}));

import { GET, PATCH } from '@/app/api/settings/route';

function req(body: any) {
  return new Request('http://t/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as any;
}

function resolveOk() {
  resolveGymId.mockResolvedValue({
    user: { id: 'u', role: 'gym_admin' },
    gymId: 'gym-1',
    token: 'tok',
  });
}

function resolveFailed(status: number) {
  resolveGymId.mockResolvedValue({
    response: NextResponse.json({ error: 'no' }, { status }),
  });
}

beforeEach(() => {
  resolveGymId.mockReset();
  laravelApi.mockReset();
});

describe('GET /api/settings', () => {
  it('returns the resolver error response unchanged when unauthorized', async () => {
    resolveFailed(401);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns the resolver error response unchanged when forbidden', async () => {
    resolveFailed(403);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('unwraps { data: ... } from Laravel response', async () => {
    resolveOk();
    laravelApi.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'g-1', name: 'Swap' } }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'g-1', name: 'Swap' });
    expect(laravelApi).toHaveBeenCalledWith('/settings', 'tok');
  });

  it('returns raw JSON if there is no data wrapper', async () => {
    resolveOk();
    laravelApi.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'g-1', name: 'Swap' }),
    });

    const res = await GET();
    expect(await res.json()).toEqual({ id: 'g-1', name: 'Swap' });
  });
});

describe('PATCH /api/settings', () => {
  it('converts camelCase request fields to snake_case for Laravel', async () => {
    resolveOk();
    laravelApi.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'g-1' } }),
    });

    await PATCH(
      req({
        name: 'Swap',
        operatingHours: { mon: '9-17' },
        brandingConfig: { primary_color: '#B8FF2E' },
        mobilePaymentsEnabled: true,
        capacityEnabled: false,
        maxCapacity: 50,
      }),
    );

    const init = laravelApi.mock.calls[0][2] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      name: 'Swap',
      operating_hours: { mon: '9-17' },
      branding_config: { primary_color: '#B8FF2E' },
      mobile_payments_enabled: true,
      capacity_feature_enabled: false,
      max_capacity: 50,
    });
  });

  it('accepts snake_case fields already in the expected shape', async () => {
    resolveOk();
    laravelApi.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await PATCH(
      req({
        is_listed: true,
        operating_hours: { mon: '10-18' },
        max_capacity: 100,
      }),
    );

    const body = JSON.parse((laravelApi.mock.calls[0][2] as RequestInit).body as string);
    expect(body).toEqual({
      is_listed: true,
      operating_hours: { mon: '10-18' },
      max_capacity: 100,
    });
  });

  it('drops unknown fields that are not in the whitelist', async () => {
    resolveOk();
    laravelApi.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await PATCH(
      req({
        name: 'OK',
        evil_flag: true,
        gym_id: 'attacker-gym',
        role: 'super_admin',
      }),
    );

    const body = JSON.parse((laravelApi.mock.calls[0][2] as RequestInit).body as string);
    expect(body).toEqual({ name: 'OK' });
    expect(body).not.toHaveProperty('evil_flag');
    expect(body).not.toHaveProperty('gym_id');
    expect(body).not.toHaveProperty('role');
  });

  it('propagates 422 validation errors', async () => {
    resolveOk();
    laravelApi.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Invalid name' }),
    });

    const res = await PATCH(req({ name: '' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Invalid name' });
  });
});
