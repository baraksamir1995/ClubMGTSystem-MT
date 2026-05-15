import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';
import { denyUnlessPermitted } from '@/lib/get-permissions';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  // Mirror the backend guard on /paymob/refund (permission:payments,delete)
  // and the sibling DELETE proxy — fail fast and consistently instead of
  // forwarding an unauthorized refund to Laravel.
  const denied = await denyUnlessPermitted(token, 'payments', 'delete');
  if (denied) return denied;

  const body = await req.json();
  const res = await laravelApi(`/paymob/refund`, token, {
    method: 'POST',
    body: JSON.stringify({ payment_id: params.id, ...body }),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
