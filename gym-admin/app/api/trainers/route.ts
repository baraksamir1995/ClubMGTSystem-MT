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
  const payload: Record<string, unknown> = {
    name: body.name,
    photo_url: body.photoUrl ?? body.photo_url ?? null,
    bio: body.bio ?? null,
    specialties: body.specialisations ?? body.specialties ?? null,
    certifications: body.certifications ?? null,
    trainer_type: body.trainerType ?? body.trainer_type ?? null,
    is_active: body.isActive ?? body.is_active ?? true,
    branch_id: body.branchId ?? body.branch_id ?? (Array.isArray(body.branchIds) ? body.branchIds[0] : null) ?? null,
  };
  // Forward optional Coachesapp login fields — when `password` is
  // present the Laravel controller also provisions the profiles +
  // auth.users rows and links them via trainer_profiles.profile_id.
  if (body.password) payload.password = body.password;
  if (body.username) payload.username = body.username;

  const res = await laravelApi('/trainers', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed', code: json.code }, { status: res.status });
  return NextResponse.json(json.data ?? json);
}
