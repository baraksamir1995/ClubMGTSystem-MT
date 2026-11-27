import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';
import { denyUnlessPermitted } from '@/lib/get-permissions';

/**
 * Store products + paid events the Record Payment modal can sell.
 * `?gym_member_id=` adds per-member event eligibility (unavailable_reason).
 * Same gate as recording a payment (backend: permission:payments,create).
 */
export async function GET(req: Request) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const denied = await denyUnlessPermitted(token, 'payments', 'create');
  if (denied) return denied;

  const memberId = new URL(req.url).searchParams.get('gym_member_id');
  const qs = memberId ? `?gym_member_id=${encodeURIComponent(memberId)}` : '';
  const res = await laravelApi(`/payment-catalog${qs}`, token);
  const json = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json({ error: json?.error ?? json?.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json?.data ?? { products: [], events: [] });
}
