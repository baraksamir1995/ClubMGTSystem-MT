'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, CreditCard, Check, Trash2, RefreshCw, X, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

interface Invoice {
  id: string;
  gym_id: string;
  gym_name: string;
  saas_tier_id: string;
  plan_name: string | null;
  amount: number;
  currency: string;
  status: string;
  billing_period_start: string;
  billing_period_end: string;
  paid_at: string | null;
  created_at: string;
}

interface Gym { id: string; name: string }
interface Plan { id: string; name: string; price_monthly: number; price_annual: number; is_active?: boolean }

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGym, setFilterGym] = useState('');

  // Form
  const [gymId, setGymId] = useState('');
  const [planId, setPlanId] = useState('');
  const [amount, setAmount] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [status, setStatus] = useState<'pending' | 'paid'>('pending');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterGym) params.set('gym_id', filterGym);
      const qs = params.toString();
      const res = await fetch(`/api/super-admin/invoices${qs ? `?${qs}` : ''}`);
      const json = await res.json();
      if (res.ok) setInvoices(json.data ?? []);
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }, [filterStatus, filterGym]);

  const fetchGymsAndPlans = useCallback(async () => {
    try {
      const [gRes, pRes] = await Promise.all([
        fetch('/api/super-admin/gyms'),
        fetch('/api/super-admin/plans'),
      ]);
      const gJson = await gRes.json();
      const pJson = await pRes.json();
      if (gRes.ok) setGyms(gJson.data ?? []);
      if (pRes.ok) setPlans(pJson.data ?? []);
    } catch {}
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchGymsAndPlans(); }, [fetchGymsAndPlans]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gymId || !planId || !amount || !periodStart || !periodEnd) {
      toast.error('Fill in all fields'); return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/super-admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gym_id: gymId,
          saas_tier_id: planId,
          amount: parseFloat(amount),
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.errors ? Object.values(json.errors).flat().join(', ') : (json.error ?? 'Failed');
        toast.error(msg); return;
      }
      toast.success('Invoice created');
      setShowCreate(false);
      setGymId(''); setPlanId(''); setAmount(''); setPeriodStart(''); setPeriodEnd(''); setStatus('pending');
      fetchInvoices();
    } catch { toast.error('Network error'); }
    finally { setCreating(false); }
  };

  const markPaid = async (inv: Invoice) => {
    try {
      const res = await fetch(`/api/super-admin/invoices/${inv.id}`, { method: 'POST' });
      if (res.ok) {
        setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i));
        toast.success('Marked as paid');
      }
    } catch { toast.error('Failed'); }
  };

  const deleteInvoice = async (inv: Invoice) => {
    if (!confirm('Delete this invoice?')) return;
    try {
      const res = await fetch(`/api/super-admin/invoices/${inv.id}`, { method: 'DELETE' });
      if (res.ok) {
        setInvoices(prev => prev.filter(i => i.id !== inv.id));
        toast.success('Invoice deleted');
      }
    } catch { toast.error('Failed'); }
  };

  // Auto-fill amount when plan is selected
  const onPlanChange = (id: string) => {
    setPlanId(id);
    const plan = plans.find(p => p.id === id);
    if (plan) setAmount(String(plan.price_monthly));
  };

  const fmt = (n: number, cur = 'EGP') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; } };

  const statusBadge = (s: string) => {
    const cls = s === 'paid' ? 'bg-success-soft text-success' : s === 'overdue' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s}</span>;
  };

  const inp = 'w-full px-3 py-2 bg-surface-3 border border-line-strong rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors';

  // Summary
  const totalCollected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Payments</h1>
          <p className="text-sm text-fg-muted mt-0.5">Manage gym invoices and payments</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" aria-hidden /> Create Invoice
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-muted mb-1">Total Collected</p>
          <p className="text-xl font-bold text-success">{fmt(totalCollected)}</p>
        </div>
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-muted mb-1">Pending</p>
          <p className="text-xl font-bold text-warning">{fmt(totalPending)}</p>
        </div>
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-muted mb-1">Total Invoices</p>
          <p className="text-xl font-bold text-fg">{invoices.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-fg-muted" aria-hidden />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-brand">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={filterGym} onChange={e => setFilterGym(e.target.value)}
          className="bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-brand">
          <option value="">All gyms</option>
          {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {(filterStatus || filterGym) && (
          <button onClick={() => { setFilterStatus(''); setFilterGym(''); }}
            className="text-xs text-fg-muted hover:text-fg transition-colors">Clear</button>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 p-4">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-fg">Create Invoice</h2>
              <button onClick={() => setShowCreate(false)} aria-label="Close" className="text-fg-muted hover:text-fg"><X className="w-5 h-5" aria-hidden /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Gym *</label>
                <select value={gymId} onChange={e => setGymId(e.target.value)} className={inp} required>
                  <option value="">Select gym</option>
                  {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Plan *</label>
                <select value={planId} onChange={e => onPlanChange(e.target.value)} className={inp} required>
                  <option value="">Select plan</option>
                  {plans.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {fmt(p.price_monthly)}/mo</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Amount (EGP) *</label>
                <input type="number" min="0" step="1" value={amount} onChange={e => setAmount(e.target.value)} className={inp} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Period Start *</label>
                  <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className={inp} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Period End *</label>
                  <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className={inp} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as any)} className={inp}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">Cancel</button>
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden /> : null}
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-brand animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <CreditCard className="w-10 h-10 text-fg-faint mx-auto mb-3" aria-hidden />
          <p className="text-sm text-fg-muted">No invoices yet</p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">GYM</th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">PLAN</th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">PERIOD</th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">AMOUNT</th>
                  <th scope="col" className="text-left text-xs text-fg-muted font-medium px-5 py-3">STATUS</th>
                  <th scope="col" className="text-right text-xs text-fg-muted font-medium px-5 py-3">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-surface-3/20 transition-colors">
                    <td className="px-5 py-3.5 text-fg font-medium">{inv.gym_name}</td>
                    <td className="px-5 py-3.5 text-fg-muted">{inv.plan_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-fg-muted text-xs">
                      {fmtDate(inv.billing_period_start)} — {fmtDate(inv.billing_period_end)}
                    </td>
                    <td className="px-5 py-3.5 text-fg font-medium">{fmt(Number(inv.amount), inv.currency)}</td>
                    <td className="px-5 py-3.5">{statusBadge(inv.status)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status !== 'paid' && (
                          <button onClick={() => markPaid(inv)} title="Mark as paid" aria-label="Mark as paid"
                            className="p-1.5 text-fg-muted hover:text-success hover:bg-success-soft rounded-lg transition-colors">
                            <Check className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        )}
                        <button onClick={() => deleteInvoice(inv)} title="Delete" aria-label="Delete invoice"
                          className="p-1.5 text-fg-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
