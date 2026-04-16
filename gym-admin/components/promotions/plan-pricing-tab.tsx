'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Percent, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PlanPromoModal from './plan-promo-modal';
import type { Plan } from '@/app/dashboard/plans/page';

export interface PlanPromotion {
  id: string;
  plan_id: string;
  plan_name: string;
  plan_price: number;
  currency: string;
  promo_price: number;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

interface Props {
  plans: Plan[];
}

export default function PlanPricingTab({ plans }: Props) {
  const [promotions,  setPromotions]  = useState<PlanPromotion[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState<{ open: boolean; existing?: PlanPromotion }>({ open: false });
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    fetch('/api/promos/plan-pricing')
      .then(r => r.json())
      .then(d => setPromotions(d.promotions ?? []))
      .catch(() => toast.error('Failed to load plan promotions'))
      .finally(() => setLoading(false));
  }, []);

  const deletePromo = async (promo: PlanPromotion) => {
    if (!confirm(`Remove promotional pricing for "${promo.plan_name}"?`)) return;
    setDeletingId(promo.id);
    try {
      const res = await fetch(`/api/promos/plan-pricing/${promo.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete'); return; }
      setPromotions(prev => prev.filter(p => p.id !== promo.id));
      toast.success('Promotion removed');
    } catch { toast.error('Network error'); }
    finally { setDeletingId(null); }
  };

  const getStatus = (promo: PlanPromotion) => {
    if (promo.valid_until < today)  return 'expired';
    if (promo.valid_from > today)   return 'upcoming';
    return 'active';
  };

  const statusConfig = {
    active:   { label: 'Active',    icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-400/10' },
    upcoming: { label: 'Upcoming',  icon: Clock,        cls: 'text-blue-400 bg-blue-400/10'       },
    expired:  { label: 'Expired',   icon: XCircle,      cls: 'text-gray-400 bg-gray-600/30'       },
  };

  const activePlansWithNoPromo = plans.filter(p =>
    p.is_active && !promotions.find(pr => pr.plan_id === p.id && pr.valid_until >= today)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Active promotions highlight */}
        {promotions.filter(p => getStatus(p) === 'active').length > 0 && (
          <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl px-5 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">
              <span className="font-semibold">{promotions.filter(p => getStatus(p) === 'active').length}</span> plan{promotions.filter(p => getStatus(p) === 'active').length !== 1 ? 's' : ''} currently have active promotional pricing
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">{promotions.length} promotion{promotions.length !== 1 ? 's' : ''} total</p>
          <button
            onClick={() => setModal({ open: true })}
            disabled={activePlansWithNoPromo.length === 0}
            title={activePlansWithNoPromo.length === 0 ? 'All active plans already have promotions' : ''}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
            <Plus className="w-4 h-4" /> Set Promotion
          </button>
        </div>

        {promotions.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
            <Percent className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No plan promotions set</p>
            <button onClick={() => setModal({ open: true })}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Set first promotion
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {promotions.map(promo => {
              const status = getStatus(promo);
              const { label, icon: Icon, cls } = statusConfig[status];
              const planPrice  = Number(promo.plan_price)  || 0;
              const promoPrice = Number(promo.promo_price) || 0;
              const discount   = planPrice - promoPrice;
              const pct        = planPrice > 0 ? Math.round((discount / planPrice) * 100) : 0;

              return (
                <div key={promo.id} className={`bg-gray-800 border rounded-xl p-5 flex items-center gap-4 ${status === 'expired' ? 'border-gray-700 opacity-60' : status === 'active' ? 'border-emerald-400/20' : 'border-gray-700'}`}>
                  {/* Plan info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold truncate">{promo.plan_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cls}`}>
                        <Icon className="w-3 h-3" />{label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(promo.valid_from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' – '}
                      {new Date(promo.valid_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-gray-500 line-through">{promo.currency} {planPrice.toFixed(2)}</span>
                      <span className="text-lg font-bold text-white">{promo.currency} {promoPrice.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <p className="text-xs text-emerald-400 mt-0.5">Save {promo.currency} {discount.toFixed(2)} ({pct}% off)</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setModal({ open: true, existing: promo })}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deletePromo(promo)} disabled={deletingId === promo.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal.open && (
        <PlanPromoModal
          plans={plans}
          existing={modal.existing}
          onClose={() => setModal({ open: false })}
          onSaved={p => {
            setPromotions(prev => modal.existing
              ? prev.map(x => x.id === p.id ? p : x)
              : [p, ...prev]
            );
          }}
        />
      )}
    </>
  );
}
