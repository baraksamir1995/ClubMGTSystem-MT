import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

// Fields forwarded to the Laravel /memberships endpoint. Anything outside
// this allow-list is dropped so request URLs stay tidy.
const FORWARD = [
  'page', 'limit', 'search', 'status', 'plan_type', 'source_type',
  'membership_kind',
  'start_from', 'start_to', 'end_from', 'end_to', 'expiring_days',
];

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  for (const key of FORWARD) {
    const v = searchParams.get(key);
    if (v) params.set(key, v);
  }

  const url = `/memberships${params.toString() ? `?${params}` : ''}`;
  const res = await laravelApi(url, token);
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  }
  return NextResponse.json(json);
}
