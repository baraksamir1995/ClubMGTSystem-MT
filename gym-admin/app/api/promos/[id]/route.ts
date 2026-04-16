import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();

  // Only include fields that are actually provided (not undefined)
  const payload: Record<string, any> = {};
  if (body.code !== undefined) payload.code = body.code;
  if (body.name !== undefined) payload.name = body.name;
  if (body.discountType !== undefined || body.discount_type !== undefined) {
    const dt = body.discountType ?? body.discount_type;
    payload.discount_type = dt === 'percent' ? 'percentage' : dt;
  }
  if (body.discountValue !== undefined || body.discount_value !== undefined)
    payload.discount_value = body.discountValue ?? body.discount_value;
  if (body.validFrom !== undefined || body.valid_from !== undefined)
    payload.valid_from = body.validFrom ?? body.valid_from;
  if (body.validUntil !== undefined || body.valid_until !== undefined)
    payload.valid_until = body.validUntil ?? body.valid_until;
  if (body.maxUses !== undefined || body.max_uses !== undefined)
    payload.max_uses = body.maxUses ?? body.max_uses;
  if (body.maxUsesPerMember !== undefined || body.per_member_limit !== undefined)
    payload.per_member_limit = body.maxUsesPerMember ?? body.per_member_limit;
  if (body.isActive !== undefined || body.is_active !== undefined)
    payload.is_active = body.isActive ?? body.is_active;

  const res = await laravelApi(`/promo-codes/${params.id}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi(`/promo-codes/${params.id}`, token, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
