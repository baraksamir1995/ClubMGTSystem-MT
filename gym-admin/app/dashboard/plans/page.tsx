import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PlansTable from '@/components/plans/plans-table';
import type { GymBranch } from '@/app/dashboard/branches/page';

export const dynamic = 'force-dynamic';

export interface Plan {
  id: string;
  name: string;
  plan_type: string;
  billing_cycle: string | null;
  price: number;
  currency: string;
  duration_days: number | null;
  session_count: number | null;
  session_expiry_days: number | null;
  description: string | null;
  facilities: string[] | null;
  visits_per_week: number | null;
  visits_per_month: number | null;
  add_ons: string[] | null;
  is_active: boolean;
  freeze_enabled: boolean;
  freeze_max_days: number | null;
  freeze_max_count: number | null;
  invitations_enabled: boolean;
  invitations_per_cycle: number | null;
  invitation_duration_type: 'per_visit' | 'time_based' | null;
  invitation_duration_days: number | null;
  invitation_validity_days: number;
  access_scope: 'all_branches' | 'specific_branches';
  allowed_branch_ids: string[] | null;
  created_at: string;
}

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
export interface PageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  counts: {
    total: number;
    active: number;
    inactive: number;
  };
}

export type PlanStatusFilter = 'all' | 'active' | 'inactive';
export type PlanTypeFilter = 'all' | 'duration' | 'sessions' | 'duration_session';

export default async function PlansPage({
  searchParams,
}: {
  searchParams?: {
    page?: string;
    search?: string;
    status?: PlanStatusFilter;
    type?: PlanTypeFilter;
  };
}) {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const search = (searchParams?.search ?? '').trim();
  const status: PlanStatusFilter = searchParams?.status ?? 'all';
  const type: PlanTypeFilter = searchParams?.type ?? 'all';
  const perPage = 10;

  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
    status,
  });
  if (search) params.set('search', search);
  if (type !== 'all') params.set('plan_type', type);

  const [plansData, branchesData] = await Promise.all([
    fetchApi(`/plans?${params.toString()}`, token),
    fetchApi('/branches', token),
  ]);

  const plans = (plansData?.data ?? []) as Plan[];
  const meta = (plansData?.meta ?? null) as PageMeta | null;
  const branches = (branchesData?.data ?? branchesData ?? []).map((b: any) => ({ id: b.id, name: b.name })) as Pick<GymBranch, 'id' | 'name'>[];

  return (
    <PlansTable
      plans={plans}
      branches={branches}
      permissions={permissions}
      meta={meta}
      filters={{ search, status, type }}
    />
  );
}
