import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/settings', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

export async function PATCH(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();

  // Convert camelCase to snake_case for Laravel
  const payload: Record<string, any> = {};

  // Direct fields (already snake_case)
  for (const key of ['name', 'email', 'phone', 'address', 'description', 'city', 'country',
    'website', 'timezone', 'language', 'category', 'is_listed']) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  // camelCase → snake_case conversions
  if (body.operatingHours !== undefined) payload.operating_hours = body.operatingHours;
  if (body.operating_hours !== undefined) payload.operating_hours = body.operating_hours;
  if (body.brandingConfig !== undefined) payload.branding_config = body.brandingConfig;
  if (body.branding_config !== undefined) payload.branding_config = body.branding_config;
  if (body.mobilePaymentsEnabled !== undefined) payload.mobile_payments_enabled = body.mobilePaymentsEnabled;
  if (body.mobile_payments_enabled !== undefined) payload.mobile_payments_enabled = body.mobile_payments_enabled;
  if (body.capacityEnabled !== undefined) payload.capacity_feature_enabled = body.capacityEnabled;
  if (body.capacity_feature_enabled !== undefined) payload.capacity_feature_enabled = body.capacity_feature_enabled;
  if (body.maxCapacity !== undefined) payload.max_capacity = body.maxCapacity;
  if (body.max_capacity !== undefined) payload.max_capacity = body.max_capacity;

  const res = await laravelApi('/settings', token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
