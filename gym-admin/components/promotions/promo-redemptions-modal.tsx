'use client';

import { useState, useEffect } from 'react';
import { X, Users, Loader2, Tag, TrendingUp, AlertTriangle } from 'lucide-react';
import type { PromoCode } from '@/app/dashboard/promotions/page';

interface Redemption {
  member_number: string;
  full_name: string | null;
  plan_name: string;
  original_price: number;
  discount_amount: number;
  final_price: number;
  currency: string;
  redeemed_at: string;
}

interface Props {
  promo: PromoCode;
  onClose: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export default function PromoRedemptionsModal({ promo, onClose }: Props) {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    fetch(`/api/promos/${promo.id}/redemptions`)
      .then(r => r.json())
      .then(d => setRedemptions(d.redemptions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [promo.id]);

  const remaining = promo.max_uses != null ? promo.max_uses - promo.usage_count : null;
  const usagePct  = promo.max_uses ? Math.round((promo.usage_count / promo.max_uses) * 100) : null;
  const totalSavings = redemptions.reduce((sum, r) => sum + Number(r.discount_amount), 0);
  const currency = redemptions[0]?.currency ?? 'EGP';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center flex-shrink-0">
              <Tag className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white font-mono tracking-wider">{promo.code}</h2>
              <p className="text-xs text-gray-400">{promo.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-gray-700 flex-shrink-0">
          {/* Usage */}
          <div className="bg-gray-700/40 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Total Redemptions</p>
            <p className="text-2xl font-bold text-white">{promo.usage_count}</p>
            {promo.max_uses && (
              <p className="text-xs text-gray-500 mt-0.5">of {promo.max_uses} max</p>
            )}
          </div>

          {/* Remaining */}
          <div className={`rounded-xl p-3 ${remaining === 0 ? 'bg-red-400/10' : remaining != null && remaining <= 5 ? 'bg-amber-400/10' : 'bg-gray-700/40'}`}>
            <p className="text-xs text-gray-400 mb-1">Remaining Uses</p>
            <p className={`text-2xl font-bold ${remaining === 0 ? 'text-red-400' : remaining != null && remaining <= 5 ? 'text-amber-400' : 'text-white'}`}>
              {remaining != null ? remaining : '∞'}
            </p>
            {usagePct != null && (
              <div className="mt-1.5">
                <div className="h-1 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usagePct >= 100 ? 'bg-red-400' : usagePct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(usagePct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{usagePct}% used</p>
              </div>
            )}
            {remaining === 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <p className="text-xs text-red-400">Limit reached</p>
              </div>
            )}
          </div>

          {/* Total savings given */}
          <div className="bg-gray-700/40 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Total Discounts Given</p>
            <p className="text-xl font-bold text-emerald-400">{fmt(totalSavings, currency)}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {promo.discount_type === 'percent' ? `${promo.discount_value}% off` : `${fmt(promo.discount_value, currency)} off`} per use
            </p>
          </div>
        </div>

        {/* Redemptions list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : redemptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Users className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">No redemptions yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800 z-10">
                <tr className="border-b border-gray-700">
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">MEMBER</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">PLAN</th>
                  <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">DATE</th>
                  <th className="text-right text-xs text-gray-400 font-medium px-5 py-3">PRICE PAID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {redemptions.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-700/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium">{r.full_name ?? '—'}</p>
                      <p className="text-xs text-gray-500 font-mono">{r.member_number}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-300 text-sm">{r.plan_name}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {new Date(r.redeemed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <p className="text-xs text-gray-500 line-through">{fmt(r.original_price, r.currency)}</p>
                      <p className="text-sm font-semibold text-emerald-400">{fmt(r.final_price, r.currency)}</p>
                      <p className="text-xs text-emerald-600">− {fmt(r.discount_amount, r.currency)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
