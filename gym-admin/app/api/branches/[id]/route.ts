import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const payload: Record<string, any> = {};
  if (body.name !== undefined) payload.name = body.name;
  if (body.address !== undefined) payload.address = body.address;
  if (body.mapsUrl !== undefined || body.maps_url !== undefined) payload.maps_url = body.mapsUrl ?? body.maps_url;
  if (body.isActive !== undefined || body.is_active !== undefined) payload.is_active = body.isActive ?? body.is_active;
  if (body.imageUrl !== undefined || body.image_url !== undefined) payload.image_url = body.imageUrl ?? body.image_url;

  const res = await laravelApi(`/branches/${params.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json({ branch: json.data ?? json });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi(`/branches/${params.id}`, token, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
