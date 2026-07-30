'use client';

import { useState, useMemo } from 'react';
import { Download, Filter, DollarSign, CheckCircle, Clock, AlertCircle, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, type BadgeProps, Button, Input } from '@/components/ui';
import { useTranslations } from 'next-intl';

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

export default function PaymentHistoryTab({ payments, memberName, memberNumber }: Props) {
  const t = useTranslations('members.payments');
  const tc = useTranslations('common');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [page, setPage]         = useState(1);

  // Build status config from translations
  const statusConfig: Record<string, { label: string; variant: BadgeProps['variant']; icon: React.ElementType }> = {
    paid:          { label: t('paymentStatus.paid'),         variant: 'success', icon: CheckCircle },
    pending:       { label: t('paymentStatus.pending'),      variant: 'warning', icon: Clock },
    overdue:       { label: t('paymentStatus.overdue'),      variant: 'danger',  icon: AlertCircle },
    refunded:      { label: t('paymentStatus.refunded'),     variant: 'neutral', icon: RotateCcw },
    partial_refund:{ label: t('paymentStatus.partRefunded'), variant: 'neutral', icon: RotateCcw },
  };

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
      [
        t('col.date'), t('col.serviceItem'), 'Specialist', t('col.method'),
        tc('amount'), tc('currency'), tc('status'), tc('notes'),
      ],
      ...filtered.map(p => [
        new Date(p.created_at).toLocaleDateString('en-GB'),
        p.item_name ?? '',
        p.specialist_name ?? '',
        t(`method.${p.payment_method}` as any) ?? p.payment_method,
        p.amount.toString(),
        p.currency,
        p.status,
        p.notes ?? '',
      ]),
      [],
      [t('totalPaid'), '', fmt(totalPaid, currency)],
      [t('outstanding'), '', fmt(totalPending, currency)],
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-faint mb-1">{t('totalPaid')}</p>
          <p className="text-xl font-bold text-success">{fmt(totalPaid, filtered[0]?.currency ?? 'EGP')}</p>
          <p className="text-xs text-fg-faint mt-0.5">
            {t('payments', { count: filtered.filter(p => p.status === 'paid').length })}
          </p>
        </div>
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-faint mb-1">{t('outstanding')}</p>
          <p className="text-xl font-bold text-warning">{fmt(totalPending, filtered[0]?.currency ?? 'EGP')}</p>
          <p className="text-xs text-fg-faint mt-0.5">
            {t('pending', { count: filtered.filter(p => p.status === 'pending' || p.status === 'overdue').length })}
          </p>
        </div>
        <div className="bg-surface-2 border border-line rounded-xl p-4">
          <p className="text-xs text-fg-faint mb-1">{t('refunded')}</p>
          <p className="text-xl font-bold text-info">{fmt(totalRefunded, filtered[0]?.currency ?? 'EGP')}</p>
          <p className="text-xs text-fg-faint mt-0.5">
            {t('refunds', { count: filtered.filter(p => p.status === 'refunded' || p.status === 'partial_refund').length })}
          </p>
        </div>
      </div>

      {/* Filters + Download */}
      <div className="bg-surface-2 border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-fg-muted" />
          <span className="text-sm font-medium text-fg">{t('filterPeriod')}</span>
          {(fromDate || toDate) && (
            <Button variant="ghost" size="sm" className="ms-auto" onClick={() => { setFromDate(''); setToDate(''); }}>{tc('clear')}</Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={downloadStatement}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className={fromDate || toDate ? '' : 'ms-auto'}>
            {t('downloadStatement')}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-faint mb-1">{t('from')}</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="[color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-xs text-fg-faint mb-1">{t('to')}</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="[color-scheme:dark]" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-fg-muted" />
          <span className="text-sm font-medium text-fg">{t('transactions')}</span>
          <span className="ms-auto text-xs text-fg-faint">{t('records', { count: filtered.length })}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <DollarSign className="w-8 h-8 text-fg-faint mx-auto mb-2" />
            <p className="text-sm text-fg-faint">
              {(fromDate || toDate) ? t('noPaymentsRange') : t('noPayments')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                    <th scope="col" className="text-start px-4 py-3">{t('col.date')}</th>
                    <th scope="col" className="text-start px-4 py-3">{t('col.serviceItem')}</th>
                    <th scope="col" className="text-start px-4 py-3">{t('col.method')}</th>
                    <th scope="col" className="text-start px-4 py-3">{t('col.source')}</th>
                    <th scope="col" className="text-start px-4 py-3">{t('col.status')}</th>
                    <th scope="col" className="text-end px-4 py-3">{t('col.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginated.map(p => {
                  const sc = statusConfig[p.status] ?? statusConfig.pending;
                  const Icon = sc.icon;
                  return (
                    <tr key={p.id} className="hover:bg-surface-3/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-fg text-sm">
                          {new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        {p.paid_at && p.status === 'paid' && (
                          <p className="text-xs text-fg-faint">
                            {t('paidOn', { date: new Date(p.paid_at).toLocaleDateString('en-GB') })}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.item_name ? (
                          <span className="text-fg font-medium">{p.item_name}</span>
                        ) : (
                          <span className="text-fg-faint">—</span>
                        )}
                        {p.specialist_name && (
                          <p className="text-xs text-fg-muted mt-0.5">{p.specialist_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-fg-muted">
                        {t(`method.${p.payment_method}` as any) ?? p.payment_method}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.source === 'mobile_app' ? 'neutral' : 'brand'} size="sm">
                          {p.source === 'mobile_app' ? t('source.mobile') : t('source.admin')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sc.variant}>
                          <Icon className="w-3 h-3" aria-hidden />
                          {sc.label}
                        </Badge>
                        {p.notes && (
                          <p className="text-xs text-fg-faint mt-0.5 max-w-[180px] truncate" title={p.notes}>{p.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {isRefundEntry(p) ? (
                          <span className="font-semibold text-info">
                            -{fmt(p.amount, p.currency)}
                          </span>
                        ) : p.discount_amount && p.discount_amount > 0 ? (
                          <div>
                            <p className="text-xs text-fg-faint line-through">{fmt(p.original_amount ?? p.amount, p.currency)}</p>
                            <p className="font-semibold text-success">{fmt(p.amount, p.currency)}</p>
                            {p.promo_code && (
                              <p className="text-xs text-brand mt-0.5 font-mono">{p.promo_code}</p>
                            )}
                          </div>
                        ) : (
                          <span className="font-semibold text-fg">
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-line">
                <p className="text-xs text-fg-faint">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page"
                    className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="w-4 h-4" aria-hidden />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} type="button" onClick={() => setPage(n)}
                      className={`w-7 h-7 text-xs rounded-lg transition-colors ${n === page ? 'bg-brand text-brand-ink font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface-3'}`}>
                      {n}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page"
                    className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="w-4 h-4" aria-hidden />
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
