import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SalesPage from '@/components/sales/sales-page';
import type { SalesContext, TeamMember } from '@/lib/sales-types';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

async function fetchSales(path: string, token: string): Promise<Response | null> {
  try {
    return await fetch(`${BACKEND_URL}/api/sales/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return null; // backend unreachable — render the shell with safe defaults
  }
}

export default async function SalesRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const [ctxRes, teamRes] = await Promise.all([
    fetchSales('context', token),
    fetchSales('team', token),
  ]);

  if (ctxRes?.status === 401 || teamRes?.status === 401) redirect('/login');

  let context: SalesContext = {
    is_admin: false,
    is_manager: false,
    user_id: '',
    branch_ids: null,
    branches: [],
  };
  if (ctxRes?.ok) {
    const json = await ctxRes.json();
    context = (json.data ?? json) as SalesContext;
  }

  let team: TeamMember[] = [];
  if (teamRes?.ok) {
    const json = await teamRes.json();
    team = (json.data ?? []) as TeamMember[];
  }

  return <SalesPage context={context} team={team} />;
}
