'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Percent, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import PlanPromoModal from './plan-promo-modal';
import type { Plan } from '@/app/dashboard/plans/page';
import { Button } from '@/components/ui';

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
  const t  = useTranslations('promotions');
  const tc = useTranslations('common');
  const [promotions,  setPromotions]  = useState<PlanPromotion[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState<{ open: boolean; existing?: PlanPromotion }>({ open: false });
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    fetch('/api/promos/plan-pricing')
      .then(r => r.json())
      .then(d => setPromotions(d.promotions ?? []))
      .catch(() => toast.error(t('failedToLoadPlanPromos')))
      .finally(() => setLoading(false));
  }, [t]);

  const deletePromo = async (promo: PlanPromotion) => {
    if (!confirm(t('removePromoPricingConfirm', { name: promo.plan_name }))) return;
    setDeletingId(promo.id);
    try {
      const res = await fetch(`/api/promos/plan-pricing/${promo.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(t('failedToDelete')); return; }
      setPromotions(prev => prev.filter(p => p.id !== promo.id));
      toast.success(t('promotionRemoved'));
    } catch { toast.error(tc('networkError')); }
    finally { setDeletingId(null); }
  };

  const getStatus = (promo: PlanPromotion) => {
    if (promo.valid_until < today)  return 'expired';
    if (promo.valid_from > today)   return 'upcoming';
    return 'active';
  };

  const statusConfig = {
    active:   { label: t('statusActive'),   icon: CheckCircle2, cls: 'text-success bg-success-soft' },
    upcoming: { label: t('statusUpcoming'), icon: Clock,        cls: 'text-info bg-info-soft'  },
    expired:  { label: t('statusExpired'),  icon: XCircle,      cls: 'text-fg-muted bg-surface-4'    },
  };

  const activePlansWithNoPromo = plans.filter(p =>
    p.is_active && !promotions.find(pr => pr.plan_id === p.id && pr.valid_until >= today)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 text-brand animate-spin" />
      </div>
    );
  }

  const activeCount = promotions.filter(p => getStatus(p) === 'active').length;

  return (
    <>
      <div className="space-y-4">
        {/* Active promotions highlight */}
        {activeCount > 0 && (
          <div className="bg-success-soft border border-success/40 rounded-xl px-5 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" aria-hidden />
            <p className="text-sm text-success">
              {activeCount === 1
                ? t('planPricingActiveNotice')
                : t('planPricingActiveNoticePlural', { count: activeCount })}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-fg-muted">
            {promotions.length === 1
              ? t('promotionsTotal')
              : t('promotionsTotalPlural', { count: promotions.length })}
          </p>
          <Button
            variant="primary" size="sm"
            onClick={() => setModal({ open: true })}
            disabled={activePlansWithNoPromo.length === 0}
            title={activePlansWithNoPromo.length === 0 ? t('allPlansHavePromos') : ''}
            leftIcon={<Plus className="w-4 h-4" />}>
            {t('setPromotion')}
          </Button>
        </div>

        {promotions.length === 0 ? (
          <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
            <Percent className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-fg-muted text-sm">{t('noPlanPromotionsSet')}</p>
            <Button variant="primary" className="mt-4" onClick={() => setModal({ open: true })} leftIcon={<Plus className="w-4 h-4" />}>
              {t('setFirstPromotion')}
            </Button>
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
                <div key={promo.id} className={`bg-surface-2 border rounded-xl p-5 flex flex-wrap items-center gap-4 ${status === 'expired' ? 'border-line opacity-60' : status === 'active' ? 'border-success/40' : 'border-line'}`}>
                  {/* Plan info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-fg font-semibold truncate">{promo.plan_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cls}`}>
                        <Icon className="w-3 h-3" aria-hidden />{label}
                      </span>
                    </div>
                    <p className="text-xs text-fg-faint">
                      {new Date(promo.valid_from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' – '}
                      {new Date(promo.valid_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="text-end flex-shrink-0">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-fg-faint line-through">{promo.currency} {planPrice.toFixed(2)}</span>
                      <span className="text-lg font-bold text-fg">{promo.currency} {promoPrice.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <p className="text-xs text-success mt-0.5">{t('savePct', { currency: promo.currency, amount: discount.toFixed(2), pct })}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setModal({ open: true, existing: promo })} aria-label={t('editPlanPromotion')}
                      className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">
                      <Pencil className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button onClick={() => deletePromo(promo)} disabled={deletingId === promo.id} aria-label="Remove promotion"
                      className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger-soft transition-colors">
                      <Trash2 className="w-3.5 h-3.5" aria-hidden />
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
