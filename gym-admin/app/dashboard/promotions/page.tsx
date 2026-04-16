import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PromosPage from '@/components/promotions/promos-page';
import type { Plan } from '@/app/dashboard/plans/page';

export const dynamic = 'force-dynamic';

export interface PromoCode {
  id: string;
  code: string;
  name: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  max_uses_per_member: number | null;
  usage_count: number;
  is_active: boolean;
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
export default async function PromotionsPage() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [promosData, plansData] = await Promise.all([
    fetchApi('/promo-codes', token),
    fetchApi('/plans', token),
  ]);

  const rawPromos = promosData?.data ?? promosData ?? [];
  const promos: PromoCode[] = rawPromos.map((p: any) => ({
    id:             p.id,
    code:           p.code,
    name:           p.name,
    discount_type:  p.discount_type,
    discount_value: p.discount_value,
    valid_from:     p.valid_from,
    valid_until:    p.valid_until,
    max_uses:            p.max_uses,
    max_uses_per_member: p.max_uses_per_member,
    usage_count:         p.usage_count ?? p.uses_count ?? 0,
    is_active:      p.is_active,
    created_at:     p.created_at,
  }));

  const plans = (plansData?.data ?? plansData ?? []) as Plan[];

  return <PromosPage initialPromos={promos} plans={plans} permissions={permissions} />;
}
