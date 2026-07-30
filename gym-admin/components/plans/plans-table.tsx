'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, ToggleLeft, ToggleRight, CreditCard, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PlanModal from './plan-modal';
import DeactivatePlanModal from './deactivate-plan-modal';
import type { Plan, PageMeta, PlanStatusFilter, PlanTypeFilter } from '@/app/dashboard/plans/page';
import { can, type Permission } from '@/lib/get-permissions';
import { Badge, Button } from '@/components/ui';

interface Filters {
  search: string;
  status: PlanStatusFilter;
  type: PlanTypeFilter;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

const planTypeColor: Record<string, string> = {
  duration:         'bg-info-soft text-info',
  sessions:         'bg-warning-soft text-warning',
  duration_session: 'bg-brand/10 text-brand',
  // legacy
  monthly:          'bg-info-soft text-info',
  annual:           'bg-info-soft text-info',
};

export default function PlansTable({ plans: initialPlans, branches, permissions, meta, filters }: { plans: Plan[]; branches: { id: string; name: string }[]; permissions: Permission[] | null; meta?: PageMeta | null; filters: Filters }) {
  const t = useTranslations('plans');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const branchMap = useMemo(() => Object.fromEntries(branches.map(b => [b.id, b.name])), [branches]);
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | undefined>(undefined);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deactivatingPlan, setDeactivatingPlan] = useState<Plan | null>(null);

  // Keep local list in sync when server sends new data (page/filter change).
  useEffect(() => { setPlans(initialPlans); }, [initialPlans]);
  useEffect(() => { setSearchDraft(filters.search); }, [filters.search]);

  const statusFilter = filters.status;
  const typeFilter = filters.type;

  const pushFilters = (next: Partial<Filters & { page: number }>) => {
    const sp = new URLSearchParams();
    const search = next.search ?? filters.search;
    const status = next.status ?? filters.status;
    const type = next.type ?? filters.type;
    const page = next.page ?? 1; // reset to page 1 on any filter change
    if (search) sp.set('search', search);
    if (status !== 'all') sp.set('status', status);
    if (type !== 'all') sp.set('type', type);
    if (page > 1) sp.set('page', String(page));
    const qs = sp.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  };

  // Debounce search — push to URL 400ms after the user stops typing.
  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = setTimeout(() => pushFilters({ search: searchDraft, page: 1 }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const openCreate = () => { setEditingPlan(undefined); setModalOpen(true); };
  const openEdit = (p: Plan) => { setEditingPlan(p); setModalOpen(true); };

  const totalCount = meta?.counts?.total ?? plans.length;
  const totalActive = meta?.counts?.active ?? plans.filter(p => p.is_active).length;
  const totalInactive = meta?.counts?.inactive ?? plans.filter(p => !p.is_active).length;

  const doToggle = async (plan: Plan, newActive: boolean) => {
    setTogglingId(plan.id);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newActive }),
      });
      if (!res.ok) { toast.error(t('deactivateModal.toastFailed')); return; }
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: newActive } : p));
      toast.success(newActive ? t('deactivateModal.toastActivated') : t('deactivateModal.toastDeactivated'));
      setDeactivatingPlan(null);
    } catch {
      toast.error(t('deactivateModal.toastNetwork'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleClick = (plan: Plan) => {
    if (plan.is_active) {
      // Show confirmation modal before deactivating
      setDeactivatingPlan(plan);
    } else {
      // Activate immediately
      doToggle(plan, true);
    }
  };

  const planTypeLabel: Record<string, string> = {
    duration:         t('typeDuration'),
    sessions:         t('typeSessions'),
    duration_session: t('typeDurationSession'),
    monthly:          t('typeDuration'),
    annual:           t('typeDuration'),
  };

  const selectCls = 'bg-surface-3 border border-line text-sm text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors';

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
            <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
          </div>
          {can(permissions, 'members', 'create') && (
            <Button variant="primary" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>{t('newPlan')}</Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            { labelKey: 'totalPlans',    value: totalCount,    color: 'text-fg',          filter: 'all' as const },
            { labelKey: 'activePlans',   value: totalActive,   color: 'text-success', filter: 'active' as const },
            { labelKey: 'inactivePlans', value: totalInactive, color: 'text-fg-muted',    filter: 'inactive' as const },
          ]).map(s => (
            <button
              key={s.filter}
              onClick={() => pushFilters({ status: statusFilter === s.filter ? 'all' : s.filter, page: 1 })}
              className={`bg-surface-2 border rounded-xl p-4 text-start transition-colors ${statusFilter === s.filter ? "border-brand" : "border-line hover:border-line-strong"}`}
            >
              <p className="text-xs text-fg-muted mb-1">{t(s.labelKey as Parameters<typeof t>[0])}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" aria-hidden />
            <input
              type="text"
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full ps-9 pe-4 py-2 bg-surface border border-line rounded-lg text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand transition-colors"
            />
            {isPending && <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint animate-spin" />}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={statusFilter} onChange={e => pushFilters({ status: e.target.value as PlanStatusFilter, page: 1 })} className={selectCls}>
              <option value="all">{t('allStatusesOpt')}</option>
              <option value="active">{tc('active')}</option>
              <option value="inactive">{tc('inactive')}</option>
            </select>
            <select value={typeFilter} onChange={e => pushFilters({ type: e.target.value as PlanTypeFilter, page: 1 })} className={selectCls}>
              <option value="all">{t('allTypesOpt')}</option>
              <option value="duration">{t('durationType')}</option>
              <option value="sessions">{t('sessionsType')}</option>
              <option value="duration_session">{t('durationSessionType')}</option>
            </select>
            <span className="ms-auto text-xs text-fg-faint">
              {meta
                ? (meta.total === 1 ? t('results', { count: meta.total }) : t('resultsPlural', { count: meta.total }))
                : t('plansCount', { count: plans.length })}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          {plans.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-fg-muted text-sm">
                {totalCount === 0 ? t('noPlansYet') : t('noPlansMatch')}
              </p>
              {totalCount === 0 && can(permissions, 'members', 'create') && (
                <Button variant="primary" className="mt-4" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>{t('createFirstPlan')}</Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                    <th scope="col" className="text-start px-5 py-3">{t('colPlan')}</th>
                    <th scope="col" className="text-start px-5 py-3">{t('colType')}</th>
                    <th scope="col" className="text-start px-5 py-3">{tc('price')}</th>
                    <th scope="col" className="text-start px-5 py-3">{t('colDurationSessions')}</th>
                    <th scope="col" className="text-start px-5 py-3">{t('colBranches')}</th>
                    <th scope="col" className="text-start px-5 py-3">{tc('status')}</th>
                    <th scope="col" className="text-end px-5 py-3">{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {plans.map(plan => (
                    <tr key={plan.id} className="hover:bg-surface-3/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className={`font-medium ${plan.is_active ? 'text-fg' : 'text-fg-faint'}`}>{plan.name}</p>
                        {plan.description && (
                          <p className="text-xs text-fg-faint mt-0.5 max-w-xs truncate">{plan.description}</p>
                        )}
                        {/* Benefits summary */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(plan.facilities ?? []).slice(0, 3).map(f => (
                            <span key={f} className="px-1.5 py-0.5 bg-surface-3/60 text-fg-muted text-xs rounded">{f}</span>
                          ))}
                          {(plan.facilities ?? []).length > 3 && (
                            <span className="px-1.5 py-0.5 bg-surface-3/60 text-fg-faint text-xs rounded">{t('moreChips', { count: (plan.facilities ?? []).length - 3 })}</span>
                          )}
                          {plan.visits_per_week && (
                            <span className="px-1.5 py-0.5 bg-info-soft text-info text-xs rounded">{t('visitsPerWeek', { count: plan.visits_per_week })}</span>
                          )}
                          {plan.visits_per_month && !plan.visits_per_week && (
                            <span className="px-1.5 py-0.5 bg-info-soft text-info text-xs rounded">{t('visitsPerMonth', { count: plan.visits_per_month })}</span>
                          )}
                          {(plan.add_ons ?? []).length > 0 && (
                            <span className="px-1.5 py-0.5 bg-warning-soft text-warning text-xs rounded">
                              {(plan.add_ons ?? []).length === 1
                                ? t('perksCount', { count: (plan.add_ons ?? []).length })
                                : t('perksCountPlural', { count: (plan.add_ons ?? []).length })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${planTypeColor[plan.plan_type] ?? 'bg-surface-3 text-fg-muted'}`}>
                          {planTypeLabel[plan.plan_type] ?? plan.plan_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-fg font-medium">
                        {fmt(plan.price, plan.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-fg-muted">
                        {plan.plan_type === 'sessions'
                          ? plan.session_count ? t('sessionsSuffix', { count: plan.session_count }) : '—'
                          : plan.duration_days
                            ? plan.duration_days >= 365 ? t('yearSuffix', { count: Math.round(plan.duration_days / 365) })
                              : plan.duration_days >= 30  ? t('monthSuffix', { count: Math.round(plan.duration_days / 30) })
                              : t('daysSuffix', { count: plan.duration_days })
                            : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {plan.access_scope === 'all_branches' ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-success-soft text-success">{t('allBranches')}</span>
                        ) : plan.allowed_branch_ids && plan.allowed_branch_ids.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {plan.allowed_branch_ids.map(bid => (
                              <span key={bid} className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                                {branchMap[bid] ?? 'Unknown'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-fg-faint text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={plan.is_active ? 'success' : 'neutral'}>{plan.is_active ? tc('active') : tc('inactive')}</Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'members', 'edit') && (
                            <button
                              onClick={() => openEdit(plan)}
                              title={t('editPlan')}
                              aria-label={t('editPlan')}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors"
                            >
                              <Pencil className="w-4 h-4" aria-hidden />
                            </button>
                          )}
                          {can(permissions, 'members', 'edit') && (
                            <button
                              onClick={() => handleToggleClick(plan)}
                              disabled={togglingId === plan.id}
                              title={plan.is_active ? t('deactivate') : t('activate')}
                              aria-label={plan.is_active ? t('deactivate') : t('activate')}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                                plan.is_active
                                  ? 'text-fg-faint hover:text-warning hover:bg-warning-soft'
                                  : 'text-fg-faint hover:text-success hover:bg-success-soft'
                              }`}
                            >
                              {plan.is_active
                                ? <ToggleRight className="w-4 h-4" aria-hidden />
                                : <ToggleLeft className="w-4 h-4" aria-hidden />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-line">
              <p className="text-xs text-fg-faint">
                {t('showing', { from: (meta.current_page - 1) * meta.per_page + 1, to: Math.min(meta.current_page * meta.per_page, meta.total), total: meta.total })}
              </p>
              <div className="flex items-center gap-2">
                {meta.current_page > 1 ? (
                  <button
                    onClick={() => pushFilters({ page: meta.current_page - 1 })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-fg-muted hover:text-fg bg-surface-3 hover:bg-surface-4 rounded-md transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {t('prev')}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-fg-faint bg-surface-2 rounded-md cursor-not-allowed">
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {t('prev')}
                  </span>
                )}
                <span className="text-xs text-fg-muted px-2">
                  {t('page', { current: meta.current_page, last: meta.last_page })}
                </span>
                {meta.current_page < meta.last_page ? (
                  <button
                    onClick={() => pushFilters({ page: meta.current_page + 1 })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-fg-muted hover:text-fg bg-surface-3 hover:bg-surface-4 rounded-md transition-colors"
                  >
                    {t('next')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-fg-faint bg-surface-2 rounded-md cursor-not-allowed">
                    {t('next')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {modalOpen && <PlanModal plan={editingPlan} branches={branches} onClose={() => { setModalOpen(false); setEditingPlan(undefined); }} />}
      {deactivatingPlan && (
        <DeactivatePlanModal
          plan={deactivatingPlan}
          onConfirm={() => doToggle(deactivatingPlan, false)}
          onClose={() => setDeactivatingPlan(null)}
        />
      )}
    </>
  );
}
