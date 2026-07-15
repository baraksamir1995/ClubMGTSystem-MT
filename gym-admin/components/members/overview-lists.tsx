'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui';
import { useTranslations } from 'next-intl';

const PAGE_SIZE = 5;

const fmt = (amount: number, currency?: string | null) => {
  const ccy = currency || 'EGP';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${ccy} ${amount.toFixed(2)}`;
  }
};

const statusVariant: Record<string, BadgeProps['variant']> = {
  active:    'success',
  inactive:  'neutral',
  expired:   'danger',
  exhausted: 'danger',
  suspended: 'warning',
  cancelled: 'neutral',
  paused:    'neutral',
};

interface Props {
  memberships: any[];
  promoMap: Record<string, any>;
}

function Pager({ page, total, onChange, tPage }: { page: number; total: number; onChange: (p: number) => void; tPage: string }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t border-line mt-3">
      <p className="text-xs text-fg-faint">{tPage}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => onChange(Math.min(total, page + 1))}
          disabled={page === total}
          className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default function OverviewLists({ memberships, promoMap }: Props) {
  const t = useTranslations('members.detail');
  const [planPage, setPlanPage] = useState(1);

  const planPages = Math.max(1, Math.ceil(memberships.length / PAGE_SIZE));

  const pagedMemberships  = memberships.slice((planPage - 1) * PAGE_SIZE, planPage * PAGE_SIZE);

  return (
    <>
      {/* Plan History */}
      {memberships.length > 0 && (
        <div className="bg-surface-2 border border-line rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-brand" aria-hidden />
            <h2 className="text-sm font-semibold text-fg">{t('planHistory')}</h2>
            <span className="ms-auto text-xs text-fg-faint">{t('planHistoryRecords', { count: memberships.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                  <th scope="col" className="text-start pb-3">{t('planHistoryCol.plan')}</th>
                  <th scope="col" className="text-start pb-3">{t('planHistoryCol.start')}</th>
                  <th scope="col" className="text-start pb-3">{t('planHistoryCol.expiry')}</th>
                  <th scope="col" className="text-start pb-3">{t('planHistoryCol.pricePaid')}</th>
                  <th scope="col" className="text-start pb-3">{t('planHistoryCol.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pagedMemberships.map((m: any) => {
                  const p = (m.plan ?? m.membership_plans) as any;
                  const promo = m.promo_code_id ? promoMap[m.promo_code_id] : null;
                  const hasDiscount = m.discount_amount && Number(m.discount_amount) > 0;
                  const currency = p?.currency ?? 'EGP';
                  return (
                    <tr key={m.id}>
                      <td className="py-3 pe-4">
                        <p className="text-fg font-medium">{p?.name ?? '—'}</p>
                        <p className="text-xs text-fg-faint capitalize">{p?.plan_type ?? ''}</p>
                      </td>
                      <td className="py-3 pe-4 text-fg-muted text-xs">
                        {m.start_date ? new Date(m.start_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3 pe-4 text-fg-muted text-xs">
                        {m.end_date ? new Date(m.end_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3 pe-4">
                        {m.final_price != null ? (
                          <div>
                            {hasDiscount && (
                              <p className="text-xs text-fg-faint line-through">{fmt(m.original_price, currency)}</p>
                            )}
                            <p className={`text-sm font-semibold ${hasDiscount ? 'text-success' : 'text-fg'}`}>
                              {fmt(m.final_price, currency)}
                            </p>
                            {hasDiscount && (
                              <p className="text-xs text-success mt-0.5">
                                − {fmt(m.discount_amount, currency)}
                                {promo && <span className="ms-1 font-mono text-brand">({promo.code})</span>}
                                {m.plan_promotion_id && !promo && <span className="ms-1 text-info">(promo pricing)</span>}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-fg-faint">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge variant={statusVariant[m.status] ?? 'neutral'} className="capitalize">{m.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager
            page={planPage}
            total={planPages}
            onChange={p => { setPlanPage(p); }}
            tPage={t('page', { page: planPage, total: planPages })}
          />
        </div>
      )}
    </>
  );
}
