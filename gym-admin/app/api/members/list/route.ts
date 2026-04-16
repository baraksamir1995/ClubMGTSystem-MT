import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET() {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const res = await laravelApi('/members?per_page=9999', token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });

  const rawMembers = json.data ?? json ?? [];
  const members = rawMembers.map((m: any) => ({
    id: m.id,
    member_number: String(m.member_number ?? ''),
    full_name: m.user?.full_name ?? m.full_name ?? null,
    email: m.user?.email ?? m.email ?? null,
    phone: m.user?.phone ?? m.phone ?? null,
    photo_url: m.user?.photo_url ?? m.photo_url ?? null,
  }));

  return NextResponse.json({ members });
}
