import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PaymentsTable from '@/components/payments/payments-table';
import type { GymBranch } from '@/app/dashboard/branches/page';

export interface GymInfo {
  name: string;
  logo_url: string | null;
}

export const dynamic = 'force-dynamic';

export interface Payment {
  id: string;
  gym_member_id: string;
  membership_id: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'paid' | 'pending' | 'overdue' | 'refunded' | 'partial_refund';
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  source: string;
  service_type: string | null;
  service_name: string | null;
  specialist_name: string | null;
  branch_name: string | null;
  original_amount: number | null;
  discount_amount: number | null;
  paymob_transaction_id: string | null;
  refunded_amount: number;
  member_number: string;
  full_name: string;
  email: string;
}

export interface ServiceOption {
  id: string;
  type: 'membership' | 'session_package' | 'program' | 'offer';
  name: string;
  price: number | null;
  original_price: number | null;
  currency: string;
  subtitle: string;
  creates_assignment: boolean;
  trainer_type: string | null;
  allowed_branch_ids: string[] | null;
  plan_promotion_id: string | null;
}

export interface PromoCode {
  id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  is_active: boolean;
}

export interface TrainerOption {
  id: string;
  name: string;
  trainer_type: string;
}

export interface MemberOption {
  id: string;
  member_number: string;
  full_name: string | null;
  email: string | null;
  active_membership_id: string | null;
  plan_name: string | null;
  plan_price: number | null;
  currency: string | null;
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
export default async function PaymentsPage() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  // Fetch all data from Laravel in parallel
  const [paymentsData, settingsData, branchesData, plansData, programsData, offersData, trainersData, svcPackagesData, promoCodesData, membersData, planPromosData] = await Promise.all([
    fetchApi('/payments', token),
    fetchApi('/settings', token),
    fetchApi('/branches', token),
    fetchApi('/plans', token),
    fetchApi('/programs', token),
    fetchApi('/offers', token),
    fetchApi('/trainers', token),
    fetchApi('/service-packages', token),
    fetchApi('/promo-codes', token),
    fetchApi('/members?limit=500&status=active', token),
    fetchApi('/plan-promotions', token),
  ]);

  const gym: GymInfo = { name: settingsData?.name ?? 'Gym', logo_url: settingsData?.logo_url ?? null };
  const branches: GymBranch[] = (branchesData?.data ?? branchesData ?? []) as GymBranch[];

  // Build member lookup from members data (fetched in parallel)
  const rawMembers = membersData?.data ?? membersData ?? [];
  const memberLookup: Record<string, any> = {};
  for (const m of rawMembers) {
    memberLookup[m.id] = m;
  }

  // Map payments with enriched member info
  const rawPayments = paymentsData?.data ?? paymentsData ?? [];
  const payments: Payment[] = rawPayments.map((p: any) => {
    const member = memberLookup[p.gym_member_id];
    const profile = member?.user ?? member?.profile ?? {};
    return {
      id: p.id,
      gym_member_id: p.gym_member_id,
      membership_id: p.membership_id ?? null,
      amount: p.amount,
      currency: p.currency ?? 'EGP',
      payment_method: p.payment_method,
      status: p.status,
      notes: p.notes ?? null,
      due_date: p.due_date ?? null,
      paid_at: p.paid_at ?? null,
      created_at: p.created_at,
      source: p.source ?? 'admin',
      service_type: p.service_type ?? null,
      service_name: p.service_name ?? null,
      specialist_name: p.specialist_name ?? null,
      branch_name: p.branch_name ?? null,
      original_amount: p.original_amount ?? null,
      discount_amount: p.discount_amount ?? null,
      paymob_transaction_id: p.paymob_transaction_id ?? null,
      refunded_amount: p.refunded_amount ?? 0,
      member_number: String(member?.member_number ?? p.member_number ?? '---'),
      full_name: profile?.full_name ?? p.full_name ?? '---',
      email: profile?.email ?? p.email ?? '',
    };
  });

  // Map members (rawMembers already defined above)
  const memberOptions: MemberOption[] = rawMembers.map((m: any) => {
    const profile = m.user ?? m.profile ?? {};
    const activeMembership = (m.memberships ?? []).find((ms: any) => ms.status === 'active');
    const plan = activeMembership?.plan ?? null;
    return {
      id: m.id,
      member_number: String(m.member_number ?? ''),
      full_name: profile.full_name ?? m.full_name ?? null,
      email: profile.email ?? m.email ?? null,
      active_membership_id: activeMembership?.id ?? null,
      plan_name: plan?.name ?? null,
      plan_price: plan?.price ? Number(plan.price) : null,
      currency: plan?.currency ?? null,
    };
  });

  // Map service options
  const rawPlans = plansData?.data ?? plansData ?? [];
  const rawPrograms = programsData?.data ?? programsData ?? [];
  const rawOffers = offersData?.data ?? offersData ?? [];
  const rawSvcPackages = svcPackagesData?.data ?? svcPackagesData ?? [];
  const rawPlanPromos = planPromosData?.data ?? planPromosData ?? [];

  const promoByPlan: Record<string, { price: number; id: string }> = {};
  rawPlanPromos.forEach((pp: any) => {
    if (pp.plan_id) promoByPlan[pp.plan_id] = { price: Number(pp.promo_price), id: pp.id };
  });

  const cycleLabel = (c: string | null) => ({ monthly: '/ month', yearly: '/ year', quarterly: '/ quarter', one_time: 'one time' }[c ?? ''] ?? '');
  const trainerTypeLabel = (t: string | null) => ({ personal_trainer: 'Personal Training', physiotherapist: 'Physiotherapy', nutritionist: 'Nutrition' }[t ?? ''] ?? t ?? '');

  const serviceOptions: ServiceOption[] = [
    ...rawPlans.filter((p: any) => p.plan_type !== 'sessions' && p.is_active).map((p: any): ServiceOption => {
      const promo = promoByPlan[p.id];
      return {
        id: p.id, type: 'membership', name: p.name,
        price: promo ? promo.price : p.price,
        original_price: promo ? p.price : null,
        currency: p.currency ?? 'EGP',
        subtitle: promo ? `${cycleLabel(p.billing_cycle)} \u00b7 was ${p.price}` : cycleLabel(p.billing_cycle),
        creates_assignment: false, trainer_type: null,
        allowed_branch_ids: p.access_scope === 'specific_branches' ? (p.allowed_branch_ids ?? null) : null,
        plan_promotion_id: promo?.id ?? null,
      };
    }),
    ...rawPlans.filter((p: any) => p.plan_type === 'sessions' && p.is_active).map((p: any): ServiceOption => {
      const promo = promoByPlan[p.id];
      return {
        id: p.id, type: 'session_package', name: p.name,
        price: promo ? promo.price : p.price,
        original_price: promo ? p.price : null,
        currency: p.currency ?? 'EGP',
        subtitle: promo
          ? `${p.session_count ? `${p.session_count} sessions` : ''} \u00b7 was ${p.price}`
          : (p.session_count ? `${p.session_count} sessions` : ''),
        creates_assignment: false, trainer_type: null,
        allowed_branch_ids: p.access_scope === 'specific_branches' ? (p.allowed_branch_ids ?? null) : null,
        plan_promotion_id: promo?.id ?? null,
      };
    }),
    ...rawPrograms.filter((p: any) => p.status === 'published').map((p: any): ServiceOption => ({
      id: p.id, type: 'program', name: p.title,
      price: p.price, original_price: null, currency: 'EGP', subtitle: 'programme',
      creates_assignment: false, trainer_type: null,
      allowed_branch_ids: null, plan_promotion_id: null,
    })),
    ...rawOffers.filter((o: any) => o.status === 'active').map((o: any): ServiceOption => ({
      id: o.id, type: 'offer', name: o.title,
      price: o.offer_price, original_price: null, currency: 'EGP', subtitle: 'offer',
      creates_assignment: false, trainer_type: null,
      allowed_branch_ids: null, plan_promotion_id: null,
    })),
    ...rawSvcPackages.filter((p: any) => p.is_active).map((p: any): ServiceOption => ({
      id: p.id, type: 'session_package', name: p.name,
      price: p.price, original_price: null, currency: p.currency ?? 'EGP',
      subtitle: `${trainerTypeLabel(p.trainer_type)}${p.session_count ? ` \u00b7 ${p.session_count} sessions` : ''}`,
      creates_assignment: true, trainer_type: p.trainer_type ?? null,
      allowed_branch_ids: null, plan_promotion_id: null,
    })),
  ];

  const rawTrainers = trainersData?.data ?? trainersData ?? [];
  const trainerOptions: TrainerOption[] = rawTrainers.map((t: any) => ({
    id: t.id,
    name: t.name,
    trainer_type: t.trainer_type ?? 'personal_trainer',
  }));

  const rawPromoCodes = promoCodesData?.data ?? promoCodesData ?? [];
  const promoCodes: PromoCode[] = rawPromoCodes.filter((c: any) => c.is_active).map((c: any) => ({
    id: c.id, code: c.code, name: c.name ?? c.code,
    discount_type: c.discount_type, discount_value: Number(c.discount_value),
    is_active: c.is_active,
  }));

  return <PaymentsTable payments={payments} memberOptions={memberOptions} serviceOptions={serviceOptions} trainerOptions={trainerOptions} branches={branches} gym={gym} permissions={permissions} promoCodes={promoCodes} />;
}
