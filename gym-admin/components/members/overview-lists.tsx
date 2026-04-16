'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, Clock } from 'lucide-react';
import { fmtTime12, parsePgTimestamp, fmtDateGym } from '@/lib/time';
import type { MemberPayment } from './payment-history-tab';

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

const methodLabel: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', card: 'Card', other: 'Other',
};

interface AttendanceLog {
  id: string;
  check_in_at: string;
  method: string | null;
  access_point: string | null;
}

interface Props {
  payments: MemberPayment[];
  attendanceLogs: AttendanceLog[];
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

export default function OverviewLists({ payments, attendanceLogs, memberships, promoMap }: Props) {
  const [payPage, setPayPage] = useState(1);
  const [attPage, setAttPage] = useState(1);
  const [planPage, setPlanPage] = useState(1);

  const payPages  = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const attPages  = Math.max(1, Math.ceil(attendanceLogs.length / PAGE_SIZE));
  const planPages = Math.max(1, Math.ceil(memberships.length / PAGE_SIZE));

  const pagedPayments     = payments.slice((payPage - 1) * PAGE_SIZE, payPage * PAGE_SIZE);
  const pagedAttendance   = attendanceLogs.slice((attPage - 1) * PAGE_SIZE, attPage * PAGE_SIZE);
  const pagedMemberships  = memberships.slice((planPage - 1) * PAGE_SIZE, planPage * PAGE_SIZE);

  return (
    <>
      {/* Payment History */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Payment History</h2>
          {payments.length > 0 && (
            <span className="ml-auto text-xs text-gray-500">{payments.length} records</span>
          )}
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">No payments recorded.</p>
        ) : (
          <>
            <div className="space-y-0">
              {pagedPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-700/50 last:border-0">
                  <div>
                    <p className="text-sm text-white">{p.item_name ?? methodLabel[p.payment_method] ?? 'Payment'}</p>
                    <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-400">{fmt(p.amount, p.currency)}</p>
                    <span className={`text-xs capitalize ${
                      p.status === 'paid' ? 'text-emerald-400'
                      : p.status === 'pending' ? 'text-amber-400'
                      : p.status === 'overdue' ? 'text-red-400'
                      : 'text-blue-400'
                    }`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
            <Pager page={payPage} total={payPages} onChange={p => { setPayPage(p); }} />
          </>
        )}
      </div>

      {/* Attendance */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Attendance</h2>
          {attendanceLogs.length > 0 && (
            <span className="ml-auto text-xs text-gray-500">{attendanceLogs.length} records</span>
          )}
        </div>
        {attendanceLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No attendance records.</p>
        ) : (
          <>
            <div className="space-y-0">
              {pagedAttendance.map(log => (
                <div key={log.id} className="flex items-center justify-between py-2.5 border-b border-gray-700/50 last:border-0">
                  <div>
                    <p className="text-sm text-white">{fmtDateGym(log.check_in_at)}</p>
                    <p className="text-xs text-gray-500">{fmtTime12(log.check_in_at)}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    {log.access_point && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{log.access_point}</span>
                    )}
                    <span className="text-xs text-gray-400 capitalize">{log.method ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
            <Pager page={attPage} total={attPages} onChange={p => { setAttPage(p); }} />
          </>
        )}
      </div>

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
