import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ServicesPage from '@/components/services/services-page';
import type { GymOffer } from '@/app/dashboard/content/page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { can } from '@/lib/get-permissions';
import { normalizeEvents, type GymProduct, type PlanOption } from '@/lib/types/store-events';

export const dynamic = 'force-dynamic';

export interface GymProgram {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  storage_path: string | null;
  duration_weeks: number | null;
  total_sessions: number | null;
  session_duration_minutes: number | null;
  level: string | null;
  category: string | null;
  trainer_name: string | null;
  schedule_text: string | null;
  focus_areas: string[];
  price: number | null;
  display_order: number;
  status: 'draft' | 'published';
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
interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function ServicesRoute({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  
  const gymId = me?.gym_id;

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  // Store + Events live here as sub-tabs; only load what the caller may see.
  const canEvents = can(permissions, 'events');
  const canStore  = can(permissions, 'store');
  const { view } = await searchParams;

  const [programsData, offersData, trainersData, packagesData, branchesData, eventsData, plansData, productsData] = await Promise.all([
    fetchApi('/programs', token),
    fetchApi('/offers', token),
    fetchApi('/trainers', token),
    fetchApi('/service-packages?include_inactive=1', token),
    fetchApi('/branches', token),
    canEvents ? fetchApi('/admin/events', token) : null,
    canEvents ? fetchApi('/plans', token) : null,
    canStore ? fetchApi('/products', token) : null,
  ]);

  const programs = (programsData?.data ?? programsData ?? []) as GymProgram[];
  const offers = (offersData?.data ?? offersData ?? []) as GymOffer[];

  const rawTrainers = trainersData?.data ?? trainersData ?? [];
  const trainers = rawTrainers
    .filter((t: any) => ['personal_trainer', 'physiotherapist', 'nutritionist'].includes(t.trainer_type))
    .map((t: any) => ({
      ...t,
      specialisations: t.specialisations ?? t.specialties ?? [],
      upcoming_sessions: Number(t.upcoming_sessions ?? 0),
      branch_ids: t.branch_ids ?? [],
    }));

  const rawPackages = packagesData?.data ?? packagesData ?? [];
  const packages = rawPackages.map((p: any) => ({
    id:            p.id,
    name:          p.name,
    session_count: p.session_count,
    price:         p.price,
    currency:      p.currency ?? 'EGP',
    description:   p.description,
    is_active:     p.is_active,
    trainer_type:  p.trainer_type ?? null,
  }));

  const branches: GymBranch[] = (branchesData?.data ?? branchesData ?? []) as GymBranch[];

  const events = canEvents ? normalizeEvents(eventsData?.data ?? eventsData ?? []) : [];
  const rawPlans = plansData?.data ?? plansData ?? [];
  const plans: PlanOption[] = Array.isArray(rawPlans)
    ? rawPlans
        .filter((p: { deleted_at?: string | null }) => !p.deleted_at)
        .map((p: { id: string; name: string; is_active?: boolean }) => ({
          id: p.id, name: p.name, is_active: p.is_active !== false,
        }))
    : [];
  const rawProducts = productsData?.data ?? productsData ?? [];
  const products: GymProduct[] = Array.isArray(rawProducts)
    ? rawProducts.map((p: GymProduct) => ({ ...p, variants: p.variants ?? [] }))
    : [];

  return (
    <ServicesPage
      initialPrograms={programs}
      initialOffers={offers}
      initialTrainers={trainers}
      initialPackages={packages}
      permissions={permissions}
      gymId={gymId}
      branches={branches}
      initialView={view}
      events={canEvents ? { initialEvents: events, plans } : null}
      store={canStore ? { initialProducts: products } : null}
    />
  );
}
