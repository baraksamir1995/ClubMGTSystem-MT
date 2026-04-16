import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi(`/classes/${params.id}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      name: body.name, class_type: body.classType, description: body.description,
      instructor: body.instructor, trainer_id: body.trainerId, location: body.location,
      color: body.color, image_url: body.imageUrl, branch_id: body.branchId, is_active: body.isActive,
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message }, { status: res.status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi(`/classes/${params.id}`, token, { method: 'DELETE' });
  if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status });
  return NextResponse.json({ ok: true });
}
