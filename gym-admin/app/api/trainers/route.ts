import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const branchFilter = req.nextUrl.searchParams.get('branch_id');
  const qs = branchFilter ? `?branch_id=${branchFilter}` : '';
  const res = await laravelApi(`/trainers${qs}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });
  return NextResponse.json({ trainers: json.data ?? json });
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi('/trainers', token, {
    method: 'POST',
    body: JSON.stringify({
      name: body.name,
      photo_url: body.photoUrl ?? body.photo_url ?? null,
      bio: body.bio ?? null,
      specialties: body.specialisations ?? body.specialties ?? null,
      certifications: body.certifications ?? null,
      trainer_type: body.trainerType ?? body.trainer_type ?? null,
      is_active: body.isActive ?? body.is_active ?? true,
      branch_id: body.branchId ?? body.branch_id ?? null,
    }),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
