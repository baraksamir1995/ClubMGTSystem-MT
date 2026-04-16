import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi(`/notifications/${params.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      title: body.title,
      body: body.body,
      recipient_type: body.recipientType ?? body.recipient_type,
      recipient_filter: body.recipientFilter ?? body.recipient_filter,
      scheduled_at: body.scheduledAt ?? body.scheduled_at,
      target_audience: body.targetAudience ?? body.target_audience,
    }),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi(`/notifications/${params.id}`, token, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
