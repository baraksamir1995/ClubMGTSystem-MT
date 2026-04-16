'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, ToggleLeft, ToggleRight, CreditCard, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import PlanModal from './plan-modal';
import DeactivatePlanModal from './deactivate-plan-modal';
import type { Plan } from '@/app/dashboard/plans/page';
import { can, type Permission } from '@/lib/get-permissions';

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

const planTypeColor: Record<string, string> = {
  duration:         'bg-blue-400/10 text-blue-400',
  sessions:         'bg-amber-400/10 text-amber-400',
  duration_session: 'bg-purple-400/10 text-purple-400',
  // legacy
  monthly:          'bg-blue-400/10 text-blue-400',
  annual:           'bg-blue-400/10 text-blue-400',
};

const billingCycleLabel: Record<string, string> = {
  'one-time':  'One-Time',
  'monthly':   'Monthly',
  'quarterly': 'Quarterly',
  'annual':    'Annual',
};

export default function PlansTable({ plans: initialPlans, branches, permissions }: { plans: Plan[]; branches: { id: string; name: string }[]; permissions: Permission[] | null }) {
  const branchMap = useMemo(() => Object.fromEntries(branches.map(b => [b.id, b.name])), [branches]);
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deactivatingPlan, setDeactivatingPlan] = useState<Plan | null>(null);

  const openCreate = () => { setEditingPlan(undefined); setModalOpen(true); };
  const openEdit = (p: Plan) => { setEditingPlan(p); setModalOpen(true); };

  const filtered = useMemo(() => {
    let list = [...plans];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (statusFilter === 'active')   list = list.filter(p => p.is_active);
    if (statusFilter === 'inactive') list = list.filter(p => !p.is_active);
    if (typeFilter !== 'all')        list = list.filter(p => p.plan_type === typeFilter);
    return list;
  }, [plans, search, statusFilter, typeFilter]);

  const totalActive   = plans.filter(p => p.is_active).length;
  const totalInactive = plans.filter(p => !p.is_active).length;

  const doToggle = async (plan: Plan, newActive: boolean) => {
    setTogglingId(plan.id);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newActive }),
      });
      if (!res.ok) { toast.error('Failed to update plan'); return; }
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: newActive } : p));
      toast.success(newActive ? 'Plan activated' : 'Plan deactivated');
      setDeactivatingPlan(null);
    } catch {
      toast.error('Network error');
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

  const selectCls = 'bg-gray-700 border border-gray-600 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 transition-colors';

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage membership plan types for your gym</p>
          </div>
          {can(permissions, 'members', 'create') && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New Plan
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Plans',   value: plans.length,   color: 'text-white',          filter: 'all' },
            { label: 'Active Plans',  value: totalActive,    color: 'text-emerald-400',    filter: 'active' },
            { label: 'Inactive Plans', value: totalInactive, color: 'text-gray-400',       filter: 'inactive' },
          ].map(s => (
            <button
              key={s.filter}
              onClick={() => setStatusFilter(statusFilter === s.filter as 'all' | 'active' | 'inactive' ? 'all' : s.filter as 'all' | 'active' | 'inactive')}
              className={`bg-gray-800 border rounded-xl p-4 text-left transition-colors ${
                statusFilter === s.filter ? 'border-purple-500' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by plan name or description…"
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')} className={selectCls}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={selectCls}>
              <option value="all">All Types</option>
              <option value="duration">Duration</option>
              <option value="sessions">Sessions Only</option>
              <option value="duration_session">Duration + Sessions</option>
            </select>
            <span className="ml-auto text-xs text-gray-500">{filtered.length} of {plans.length} plans</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {plans.length === 0 ? 'No plans yet. Create your first plan.' : 'No plans match your filters'}
              </p>
              {plans.length === 0 && can(permissions, 'members', 'create') && (
                <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Create your first plan
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Plan</th>
                    <th className="text-left px-5 py-3">Type</th>
                    <th className="text-left px-5 py-3">Price</th>
                    <th className="text-left px-5 py-3">Duration / Sessions</th>
                    <th className="text-left px-5 py-3">Branches</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filtered.map(plan => (
                    <tr key={plan.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className={`font-medium ${plan.is_active ? 'text-white' : 'text-gray-500'}`}>{plan.name}</p>
                        {plan.description && (
                          <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{plan.description}</p>
                        )}
                        {/* Benefits summary */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(plan.facilities ?? []).slice(0, 3).map(f => (
                            <span key={f} className="px-1.5 py-0.5 bg-gray-700/60 text-gray-400 text-xs rounded">{f}</span>
                          ))}
                          {(plan.facilities ?? []).length > 3 && (
                            <span className="px-1.5 py-0.5 bg-gray-700/60 text-gray-500 text-xs rounded">+{(plan.facilities ?? []).length - 3} more</span>
                          )}
                          {plan.visits_per_week && (
                            <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-400 text-xs rounded">{plan.visits_per_week}×/wk</span>
                          )}
                          {plan.visits_per_month && !plan.visits_per_week && (
                            <span className="px-1.5 py-0.5 bg-blue-900/40 text-blue-400 text-xs rounded">{plan.visits_per_month}×/mo</span>
                          )}
                          {(plan.add_ons ?? []).length > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-900/40 text-amber-400 text-xs rounded">{(plan.add_ons ?? []).length} perk{(plan.add_ons ?? []).length > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${planTypeColor[plan.plan_type] ?? 'bg-gray-400/10 text-gray-400'}`}>
                          {plan.plan_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-white font-medium">
                        {fmt(plan.price, plan.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {plan.plan_type === 'sessions'
                          ? plan.session_count ? `${plan.session_count} sessions` : '—'
                          : plan.duration_days
                            ? plan.duration_days >= 365 ? `${Math.round(plan.duration_days / 365)} yr`
                              : plan.duration_days >= 30  ? `${Math.round(plan.duration_days / 30)} mo`
                              : `${plan.duration_days} days`
                            : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {plan.access_scope === 'all_branches' ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">All Branches</span>
                        ) : plan.allowed_branch_ids && plan.allowed_branch_ids.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {plan.allowed_branch_ids.map(bid => (
                              <span key={bid} className="text-xs px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-400">
                                {branchMap[bid] ?? 'Unknown'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          plan.is_active ? 'bg-emerald-400/10 text-emerald-400' : 'bg-gray-400/10 text-gray-400'
                        }`}>
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'members', 'edit') && (
                            <button
                              onClick={() => openEdit(plan)}
                              title="Edit plan"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {can(permissions, 'members', 'edit') && (
                            <button
                              onClick={() => handleToggleClick(plan)}
                              disabled={togglingId === plan.id}
                              title={plan.is_active ? 'Deactivate' : 'Activate'}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                                plan.is_active
                                  ? 'text-gray-500 hover:text-amber-400 hover:bg-amber-400/10'
                                  : 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-400/10'
                              }`}
                            >
                              {plan.is_active
                                ? <ToggleRight className="w-4 h-4" />
                                : <ToggleLeft className="w-4 h-4" />}
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
