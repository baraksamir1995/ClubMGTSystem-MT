'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileText, RefreshCw, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage, networkErrorMessage, responseErrorMessage } from '@/lib/api-error';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  is_active: boolean;
  created_at: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceMonthly, setPriceMonthly] = useState('');
  const [priceAnnual, setPriceAnnual] = useState('');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/plans');
      if (!res.ok) { toast.error(`Couldn't load plans — ${await responseErrorMessage(res)}`); return; }
      const json = await res.json();
      setPlans(json.data ?? []);
    } catch { toast.error(networkErrorMessage()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const resetForm = () => {
    setName(''); setDescription(''); setPriceMonthly(''); setPriceAnnual('');
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (plan: Plan) => {
    setName(plan.name);
    setDescription(plan.description ?? '');
    setPriceMonthly(String(plan.price_monthly));
    setPriceAnnual(String(plan.price_annual));
    setEditingId(plan.id);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !priceMonthly || !priceAnnual) {
      toast.error('Fill in all required fields'); return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        price_monthly: parseFloat(priceMonthly),
        price_annual: parseFloat(priceAnnual),
      };

      const res = editingId
        ? await fetch(`/api/super-admin/plans/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/super-admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(`Couldn't ${editingId ? 'update' : 'create'} plan — ${apiErrorMessage(json, res.status)}`); return; }
      toast.success(editingId ? 'Plan updated' : 'Plan created');
      setShowForm(false);
      resetForm();
      fetchPlans();
    } catch { toast.error(networkErrorMessage()); }
    finally { setSaving(false); }
  };

  const deletePlan = async (plan: Plan) => {
    if (!confirm(`Delete "${plan.name}"?`)) return;
    try {
      const res = await fetch(`/api/super-admin/plans/${plan.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(`Couldn't delete plan — ${apiErrorMessage(json, res.status)}`); return; }
      setPlans(prev => prev.filter(p => p.id !== plan.id));
      toast.success('Plan deleted');
    } catch { toast.error(networkErrorMessage()); }
  };

  const toggleActive = async (plan: Plan) => {
    try {
      const res = await fetch(`/api/super-admin/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      if (!res.ok) { toast.error(`Couldn't update plan status — ${await responseErrorMessage(res)}`); return; }
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_active: !p.is_active } : p));
    } catch { toast.error(networkErrorMessage()); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(n);

  const inp = 'w-full px-3 py-2 bg-surface-3 border border-line-strong rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Gym Plans</h1>
          <p className="text-sm text-fg-muted mt-0.5">Manage subscription plans for gyms</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" aria-hidden /> Add Plan
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 p-4">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-fg">{editingId ? 'Edit Plan' : 'New Plan'}</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} aria-label="Close" className="text-fg-muted hover:text-fg"><X className="w-5 h-5" aria-hidden /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Plan Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Starter, Pro, Enterprise" className={inp} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Monthly Price (EGP) *</label>
                  <input type="number" min="0" step="1" value={priceMonthly} onChange={e => setPriceMonthly(e.target.value)} placeholder="0" className={inp} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Annual Price (EGP) *</label>
                  <input type="number" min="0" step="1" value={priceAnnual} onChange={e => setPriceAnnual(e.target.value)} placeholder="0" className={inp} required />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Check className="w-3.5 h-3.5" aria-hidden />}
                  {editingId ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-brand animate-spin" />
        </div>
      )}

      {!loading && plans.length === 0 && (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 text-fg-faint mx-auto mb-3" aria-hidden />
          <p className="text-sm text-fg-muted">No plans yet. Create your first plan.</p>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">PLAN</th>
                <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">MONTHLY</th>
                <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">ANNUAL</th>
                <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">STATUS</th>
                <th scope="col" className="text-right text-xs text-fg-muted font-medium px-5 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plans.map(plan => (
                <tr key={plan.id} className="hover:bg-surface-3/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-fg font-medium">{plan.name}</p>
                    {plan.description && <p className="text-xs text-fg-faint mt-0.5">{plan.description}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-fg">{fmt(plan.price_monthly)}</td>
                  <td className="px-5 py-3.5 text-fg">{fmt(plan.price_annual)}</td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(plan)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${plan.is_active ? 'bg-success-soft text-success' : 'bg-surface-3 text-fg-muted'}`}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(plan)} aria-label="Edit plan" className="p-1.5 text-fg-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" aria-hidden />
                      </button>
                      <button onClick={() => deletePlan(plan)} aria-label="Delete plan" className="p-1.5 text-fg-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
