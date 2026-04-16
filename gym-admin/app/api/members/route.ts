import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { resolveGymId, laravelApi } from '@/lib/api-gym-id';

export async function GET(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  if (searchParams.get('page')) params.set('page', searchParams.get('page')!);
  if (searchParams.get('limit')) params.set('per_page', searchParams.get('limit')!);
  if (searchParams.get('search')) params.set('search', searchParams.get('search')!);
  if (searchParams.get('status')) params.set('status', searchParams.get('status')!);
  if (searchParams.get('sort')) params.set('sort', searchParams.get('sort')!);

  const res = await laravelApi(`/members${params.toString() ? `?${params}` : ''}`, token);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? 'Failed' }, { status: res.status });

  // Laravel paginate() returns { data, current_page, last_page, total, per_page }
  // Frontend expects { members, pagination: { page, pages, total, limit } }
  const members = (json.data ?? []).map((m: any) => ({
    id: m.id,
    member_number: String(m.member_number ?? ''),
    status: m.status,
    joined_at: m.joined_at ?? m.created_at,
    notes: m.notes ?? null,
    plan_type: m.memberships?.[0]?.plan?.plan_type ?? null,
    plan_name: m.memberships?.[0]?.plan?.name ?? null,
    profile: m.user ? {
      id: m.user.id,
      full_name: m.user.full_name,
      email: m.user.email,
      phone: m.user.phone,
      photo_url: m.user.photo_url,
      email_verified: m.user.email_verified ?? false,
    } : {
      id: m.user_id ?? m.id,
      full_name: m.full_name ?? null,
      email: m.email ?? null,
      phone: m.phone ?? null,
      photo_url: m.photo_url ?? null,
      email_verified: m.email_verified ?? false,
    },
  }));

  return NextResponse.json({
    members,
    pagination: {
      page: json.current_page ?? 1,
      pages: json.last_page ?? 1,
      total: json.total ?? members.length,
      limit: json.per_page ?? 20,
    },
  });
}

export async function POST(req: NextRequest) {
  const resolved = await resolveGymId();
  if (resolved.response) return resolved.response;
  const { token } = resolved;

  const body = await req.json();
  const res = await laravelApi('/members', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json.error ?? json.message ?? 'Failed' }, { status: res.status });
  return NextResponse.json(json, { status: 201 });
}
