import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import StorePage from '@/components/store/store-page';
import type { BranchOption, GymProduct } from '@/lib/types/store-events';

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

export default async function StoreRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const [permissions, productsData, branchesData] = await Promise.all([
    getStaffPermissions(token),
    fetchApi('/products', token),
    fetchApi('/branches', token),
  ]);

  const rawProducts = productsData?.data ?? productsData ?? [];
  const products: GymProduct[] = Array.isArray(rawProducts)
    ? rawProducts.map((p: GymProduct) => ({ ...p, variants: p.variants ?? [] }))
    : [];
  const rawBranches = branchesData?.data ?? branchesData ?? [];
  const branches: BranchOption[] = Array.isArray(rawBranches)
    ? rawBranches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))
    : [];

  return <StorePage initialProducts={products} permissions={permissions} branches={branches} />;
}
