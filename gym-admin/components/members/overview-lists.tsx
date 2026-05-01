'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';

const PAGE_SIZE = 5;

const fmt = (amount: number, currency?: string | null) => {
  const ccy = currency || 'EGP';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${ccy} ${amount.toFixed(2)}`;
  }
};

const statusColor: Record<string, string> = {
  active:    'bg-emerald-400/10 text-emerald-400',
  inactive:  'bg-gray-400/10 text-gray-400',
  expired:   'bg-red-400/10 text-red-400',
  exhausted: 'bg-red-400/10 text-red-400',
  suspended: 'bg-amber-400/10 text-amber-400',
  cancelled: 'bg-gray-400/10 text-gray-400',
  paused:    'bg-blue-400/10 text-blue-400',
};

interface Props {
  memberships: any[];
  promoMap: Record<string, any>;
}

function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-700 mt-3">
      <p className="text-xs text-gray-500">Page {page} of {total}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onChange(Math.min(total, page + 1))}
          disabled={page === total}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function OverviewLists({ memberships, promoMap }: Props) {
  const [planPage, setPlanPage] = useState(1);

  const planPages = Math.max(1, Math.ceil(memberships.length / PAGE_SIZE));

  const pagedMemberships  = memberships.slice((planPage - 1) * PAGE_SIZE, planPage * PAGE_SIZE);

  return (
    <>
      {/* Plan History */}
      {memberships.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Plan History</h2>
            <span className="ml-auto text-xs text-gray-500">{memberships.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left pb-3">Plan</th>
                  <th className="text-left pb-3">Start</th>
                  <th className="text-left pb-3">Expiry</th>
                  <th className="text-left pb-3">Price Paid</th>
                  <th className="text-left pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {pagedMemberships.map((m: any) => {
                  const p = (m.plan ?? m.membership_plans) as any;
                  const promo = m.promo_code_id ? promoMap[m.promo_code_id] : null;
                  const hasDiscount = m.discount_amount && Number(m.discount_amount) > 0;
                  const currency = p?.currency ?? 'EGP';
                  return (
                    <tr key={m.id}>
                      <td className="py-3 pr-4">
                        <p className="text-white font-medium">{p?.name ?? '—'}</p>
                        <p className="text-xs text-gray-500 capitalize">{p?.plan_type ?? ''}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-400 text-xs">
                        {m.start_date ? new Date(m.start_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-400 text-xs">
                        {m.end_date ? new Date(m.end_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        {m.final_price != null ? (
                          <div>
                            {hasDiscount && (
                              <p className="text-xs text-gray-500 line-through">{fmt(m.original_price, currency)}</p>
                            )}
                            <p className={`text-sm font-semibold ${hasDiscount ? 'text-emerald-400' : 'text-white'}`}>
                              {fmt(m.final_price, currency)}
                            </p>
                            {hasDiscount && (
                              <p className="text-xs text-emerald-500 mt-0.5">
                                − {fmt(m.discount_amount, currency)}
                                {promo && <span className="ml-1 font-mono text-purple-400">({promo.code})</span>}
                                {m.plan_promotion_id && !promo && <span className="ml-1 text-blue-400">(promo pricing)</span>}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor[m.status] ?? 'bg-gray-400/10 text-gray-400'}`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={planPage} total={planPages} onChange={p => { setPlanPage(p); }} />
        </div>
      )}
    </>
  );
}
