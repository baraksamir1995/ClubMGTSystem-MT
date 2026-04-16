import { NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/dashboard/capacity', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });

  const data = json.data;
  if (!data?.is_enabled) {
    return NextResponse.json({ active_users: 0, max_capacity: 0, capacity_percentage: 0, status: 'not_busy' });
  }
  return NextResponse.json(data);
}
