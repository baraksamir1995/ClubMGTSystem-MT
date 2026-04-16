import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import MembersTable from '@/components/members/members-table';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

async function fetchApi(path: string, token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
export interface MemberWithProfile {
  id: string;
  member_number: string;
  status: string;
  joined_at: string;
  notes: string | null;
  plan_type: string | null;
  plan_name: string | null;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
    email_verified?: boolean;
  } | null;
}

export default async function MembersPage() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  

  // Fetch permissions
  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  // Load members via Laravel API
  const membersData = await fetchApi('/members?page=1&limit=20', token);

  const members: MemberWithProfile[] = (membersData?.data ?? []).map((m: any) => ({
    id: m.id,
    member_number: String(m.member_number ?? ''),
    status: m.status,
    joined_at: m.joined_at,
    notes: m.notes ?? null,
    plan_type: m.plan_type ?? null,
    plan_name: m.plan_name ?? null,
    profile: m.user ? {
      id: m.user.id,
      full_name: m.user.full_name,
      email: m.user.email,
      phone: m.user.phone,
      photo_url: m.user.photo_url,
    } : {
      id: m.user_id ?? m.id,
      full_name: m.full_name ?? null,
      email: m.email ?? null,
      phone: m.phone ?? null,
      photo_url: m.photo_url ?? null,
    },
  }));

  const pagination = membersData?.pagination ?? membersData?.meta ?? { page: 1, limit: 20, total: members.length, pages: 1 };

  return <MembersTable members={members} initialPagination={pagination} permissions={permissions} />;
}
