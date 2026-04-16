import { NextRequest, NextResponse } from 'next/server';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { name, classType, description, instructor, trainerId, location, color, imageUrl, branchId } = await req.json();

  const res = await laravelApi('/classes', token, {
    method: 'POST',
    body: JSON.stringify({
      name, class_type: classType, description, instructor,
      trainer_id: trainerId, location, color: color ?? '#7c3aed',
      image_url: imageUrl, branch_id: branchId,
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message }, { status: res.status });
  return NextResponse.json({ id: json.data?.id });
}
