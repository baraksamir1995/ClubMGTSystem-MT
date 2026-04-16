import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();

  // Convert camelCase → snake_case
  const payload: Record<string, any> = {};
  if (body.name !== undefined) payload.name = body.name;
  if (body.photoUrl !== undefined || body.photo_url !== undefined) payload.photo_url = body.photoUrl ?? body.photo_url;
  if (body.bio !== undefined) payload.bio = body.bio;
  if (body.specialisations !== undefined || body.specialties !== undefined) payload.specialties = body.specialisations ?? body.specialties;
  if (body.certifications !== undefined) payload.certifications = body.certifications;
  if (body.trainerType !== undefined || body.trainer_type !== undefined) payload.trainer_type = body.trainerType ?? body.trainer_type;
  if (body.isActive !== undefined || body.is_active !== undefined) payload.is_active = body.isActive ?? body.is_active;
  if (body.branchId !== undefined || body.branch_id !== undefined) payload.branch_id = body.branchId ?? body.branch_id;

  const res = await laravelApi(`/trainers/${params.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
