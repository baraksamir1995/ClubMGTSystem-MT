'use client';

import { useState, useMemo } from 'react';
import { Download, Filter, DollarSign, CheckCircle, Clock, AlertCircle, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 5;

export interface MemberPayment {
  id: string;
  amount: number;
  original_amount: number | null;
  discount_amount: number | null;
  promo_code: string | null;
  currency: string;
  payment_method: string;
  status: string;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  source: string;
  item_name: string | null;
  specialist_name: string | null;
}

interface Props {
  payments: MemberPayment[];
  memberName: string;
  memberNumber: string;
}

const fmt = (amount: number, currency?: string | null) => {
  const ccy = currency || 'EGP';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${ccy} ${amount.toFixed(2)}`;
  }
};

const methodLabel: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', card: 'Card', other: 'Other',
};

const statusConfig: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  paid:          { label: 'Paid',          cls: 'bg-emerald-400/10 text-emerald-400',  icon: CheckCircle },
  pending:       { label: 'Pending',       cls: 'bg-amber-400/10 text-amber-400',      icon: Clock },
  overdue:       { label: 'Overdue',       cls: 'bg-red-400/10 text-red-400',          icon: AlertCircle },
  refunded:      { label: 'Refunded',      cls: 'bg-blue-400/10 text-blue-400',        icon: RotateCcw },
  partial_refund:{ label: 'Part. Refunded',cls: 'bg-blue-400/10 text-blue-400',        icon: RotateCcw },
};

export default function PaymentHistoryTab({ payments, memberName, memberNumber }: Props) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [page, setPage]         = useState(1);

  const filtered = useMemo(() => {
    setPage(1);
    return payments.filter(p => {
      const d = new Date(p.created_at);
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate   && d > new Date(toDate + 'T23:59:59')) return false;
      return true;
    });
  }, [payments, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalPaid    = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = filtered.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
  const totalRefunded= filtered.filter(p => p.status === 'refunded' || p.status === 'partial_refund').reduce((s, p) => s + Number(p.amount), 0);
  const isRefundEntry = (p: MemberPayment) => p.status === 'refunded' || p.status === 'partial_refund';

  const downloadStatement = () => {
    const currency = filtered[0]?.currency ?? 'EGP';
    const rows = [
      ['Date', 'Service / Item', 'Specialist', 'Method', 'Amount', 'Currency', 'Status', 'Notes'],
      ...filtered.map(p => [
        new Date(p.created_at).toLocaleDateString('en-GB'),
        p.item_name ?? '',
        p.specialist_name ?? '',
        methodLabel[p.payment_method] ?? p.payment_method,
        p.amount.toString(),
        p.currency,
        p.status,
        p.notes ?? '',
      ]),
      [],
      ['Total Paid', '', fmt(totalPaid, currency)],
      ['Total Pending', '', fmt(totalPending, currency)],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const period = fromDate && toDate ? `_${fromDate}_to_${toDate}` : '';
    a.download = `statement_${memberNumber}${period}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Paid</p>
          <p className="text-xl font-bold text-emerald-400">{fmt(totalPaid, filtered[0]?.currency ?? 'EGP')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{filtered.filter(p => p.status === 'paid').length} payments</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Outstanding</p>
          <p className="text-xl font-bold text-amber-400">{fmt(totalPending, filtered[0]?.currency ?? 'EGP')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{filtered.filter(p => p.status === 'pending' || p.status === 'overdue').length} pending</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Refunded</p>
          <p className="text-xl font-bold text-blue-400">{fmt(totalRefunded, filtered[0]?.currency ?? 'EGP')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{filtered.filter(p => p.status === 'refunded' || p.status === 'partial_refund').length} refunds</p>
        </div>
      </div>

      {/* Filters + Download */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Filter Period</span>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              className="ml-auto text-xs text-gray-400 hover:text-white transition-colors">Clear</button>
          )}
          <button
            onClick={downloadStatement}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors ml-auto">
            <Download className="w-3.5 h-3.5" /> Download Statement
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 [color-scheme:dark]" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">Transactions</span>
          <span className="ml-auto text-xs text-gray-500">{filtered.length} records</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <DollarSign className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No payments{(fromDate || toDate) ? ' in this period' : ' recorded'}.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Service / Item</th>
                    <th className="text-left px-4 py-3">Method</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {paginated.map(p => {
                  const sc = statusConfig[p.status] ?? statusConfig.pending;
                  const Icon = sc.icon;
                  return (
                    <tr key={p.id} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white text-sm">
                          {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        {p.paid_at && p.status === 'paid' && (
                          <p className="text-xs text-gray-500">
                            Paid {new Date(p.paid_at).toLocaleDateString('en-GB')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.item_name ? (
                          <span className="text-white font-medium">{p.item_name}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                        {p.specialist_name && (
                          <p className="text-xs text-gray-400 mt-0.5">{p.specialist_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {methodLabel[p.payment_method] ?? p.payment_method}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.source === 'mobile_app' ? 'bg-blue-400/10 text-blue-400' : 'bg-purple-400/10 text-purple-400'
                        }`}>
                          {p.source === 'mobile_app' ? 'Mobile' : 'Admin'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.cls}`}>
                          <Icon className="w-3 h-3" />
                          {sc.label}
                        </span>
                        {p.notes && (
                          <p className="text-xs text-gray-500 mt-0.5 max-w-[180px] truncate" title={p.notes}>{p.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isRefundEntry(p) ? (
                          <span className="font-semibold text-blue-400">
                            -{fmt(p.amount, p.currency)}
                          </span>
                        ) : p.discount_amount && p.discount_amount > 0 ? (
                          <div>
                            <p className="text-xs text-gray-500 line-through">{fmt(p.original_amount ?? p.amount, p.currency)}</p>
                            <p className="font-semibold text-emerald-400">{fmt(p.amount, p.currency)}</p>
                            {p.promo_code && (
                              <p className="text-xs text-purple-400 mt-0.5 font-mono">{p.promo_code}</p>
                            )}
                          </div>
                        ) : (
                          <span className="font-semibold text-white">
                            {fmt(p.amount, p.currency)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-7 h-7 text-xs rounded-lg transition-colors ${n === page ? 'bg-purple-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
