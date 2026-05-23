'use client';

/* eslint-disable no-restricted-syntax --
 * This is an intentionally LIGHT-themed printable invoice/receipt rendered on
 * white "paper" (and printed verbatim via handlePrint). It deliberately uses
 * dark-on-white colors (text-gray-900/700, bg-gray-100) rather than the dark-UI
 * design tokens — `text-fg` etc. are near-white and would be invisible here.
 */

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, Printer, Mail, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Payment } from '@/app/dashboard/payments/page';

interface GymInfo {
  name: string;
  logo_url: string | null;
}

interface Props {
  payment: Payment;
  gym: GymInfo;
  onClose: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

const methodLabel: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', card: 'Card', other: 'Other',
};

export default function InvoiceModal({ payment, gym, onClose }: Props) {
  const t = useTranslations('payments');
  const [sending, setSending] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const isReceipt   = payment.status === 'paid';
  const docType     = isReceipt ? t('invoice.receipt') : t('invoice.invoice');
  const docNumber   = `${isReceipt ? 'RCP' : 'INV'}-${payment.id.slice(0, 8).toUpperCase()}`;
  const issueDate   = new Date(payment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const paidDate    = payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

  const handlePrint = () => {
    const content = invoiceRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${docType} ${docNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #111; padding: 48px; }
            .invoice-wrap { max-width: 680px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
            .gym-name { font-size: 22px; font-weight: 700; color: #111; }
            .doc-type { font-size: 28px; font-weight: 800; color: #7c3aed; text-align: right; letter-spacing: 2px; }
            .doc-number { font-size: 13px; color: #666; text-align: right; margin-top: 4px; }
            .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
            .info-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
            .info-value { font-size: 14px; color: #111; font-weight: 500; }
            .info-sub { font-size: 12px; color: #666; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin: 24px 0; }
            th { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
            td { padding: 14px 12px; font-size: 14px; color: #111; border-bottom: 1px solid #f3f4f6; }
            .amount-row td { font-weight: 700; font-size: 16px; border-bottom: none; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; }
            .status-paid { background: #d1fae5; color: #065f46; }
            .status-pending { background: #fef3c7; color: #92400e; }
            .status-overdue { background: #fee2e2; color: #991b1b; }
            .paid-stamp { position: fixed; top: 80px; right: 60px; transform: rotate(-20deg); font-size: 48px; font-weight: 900; color: #d1fae5; border: 6px solid #d1fae5; padding: 8px 20px; border-radius: 8px; opacity: 0.5; letter-spacing: 4px; }
            .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #999; }
          </style>
        </head>
        <body>
          <div class="invoice-wrap">
            ${content}
          </div>
          ${isReceipt ? `<div class="paid-stamp">${t('invoice.paidStamp')}</div>` : ''}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const handleSendEmail = async () => {
    if (!payment.email) { toast.error(t('invoice.noEmail')); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/payments/${payment.id}/send-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, docNumber, gym }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('invoice.sendFailed')); return; }
      toast.success(`${docType.charAt(0) + docType.slice(1).toLowerCase()} sent to ${payment.email}`);
    } catch {
      toast.error(t('toast.networkError'));
    } finally {
      setSending(false);
    }
  };

  const statusCls = {
    paid:           'status-paid',
    pending:        'status-pending',
    overdue:        'status-overdue',
    partial_refund: 'status-pending',
    refunded:       'status-overdue',
  }[payment.status] ?? 'status-pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              isReceipt ? 'bg-emerald-100 text-emerald-700' : 'bg-accent/10 text-accent'
            }`}>{docType}</span>
            <span className="text-sm font-mono text-gray-500">{docNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSendEmail} disabled={sending || !payment.email}
              title={payment.email ? `Send to ${payment.email}` : t('invoice.noEmail')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium transition-colors disabled:opacity-40">
              <Mail className="w-3.5 h-3.5" />
              {sending ? t('invoice.sending') : t('invoice.sendEmail')}
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors">
              <Printer className="w-3.5 h-3.5" />
              {t('invoice.print')}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div ref={invoiceRef} className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 max-w-lg mx-auto">

            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                {gym.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- printed verbatim; next/image unsuitable for print window
                  <img src={gym.logo_url} alt={gym.name} className="w-12 h-12 rounded-xl object-cover mb-2" />
                )}
                <p className="gym-name text-lg font-bold text-gray-900">{gym.name}</p>
              </div>
              <div className="text-end">
                <p className={`text-2xl font-black tracking-widest ${isReceipt ? 'text-emerald-600' : 'text-accent'}`}>
                  {docType}
                </p>
                <p className="text-sm font-mono text-gray-400 mt-1">{docNumber}</p>
                {isReceipt && (
                  <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full tracking-wide">
                    ✓ {t('invoice.paidStamp')}
                  </span>
                )}
              </div>
            </div>

            <hr className="border-gray-100 mb-6" />

            {/* Bill to + dates */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('invoice.billTo')}</p>
                <p className="font-semibold text-gray-900">{payment.full_name}</p>
                {payment.email && <p className="text-sm text-gray-500 mt-0.5">{payment.email}</p>}
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{payment.member_number}</p>
              </div>
              <div className="text-end">
                <div className="mb-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('invoice.issueDate')}</p>
                  <p className="text-sm font-medium text-gray-700">{issueDate}</p>
                </div>
                {paidDate && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('invoice.paidDate')}</p>
                    <p className="text-sm font-medium text-emerald-600">{paidDate}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Line items */}
            {(() => {
              const hasDiscount = payment.discount_amount != null && payment.discount_amount > 0;
              const originalAmt = payment.original_amount ?? payment.amount;
              return (
                <table className="w-full text-sm mb-6">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-start pb-2 text-xs text-gray-400 uppercase tracking-wider font-medium">{t('invoice.description')}</th>
                      <th className="text-start pb-2 text-xs text-gray-400 uppercase tracking-wider font-medium">{t('invoice.method')}</th>
                      <th className="text-end pb-2 text-xs text-gray-400 uppercase tracking-wider font-medium">{t('invoice.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={hasDiscount ? '' : 'border-b border-gray-50'}>
                      <td className="py-3">
                        <p className="font-medium text-gray-900">
                          {payment.service_name ?? t('invoice.payment')}
                        </p>
                        {payment.service_type && (
                          <p className="text-xs text-gray-400 mt-0.5 capitalize">
                            {payment.service_type.replace(/_/g, ' ')}
                          </p>
                        )}
                        {payment.specialist_name && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {t('invoice.specialist', { name: payment.specialist_name })}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t('invoice.source', { source: payment.source === 'mobile_app' ? t('invoice.mobileApp') : t('invoice.admin') })}
                        </p>
                      </td>
                      <td className="py-3 text-gray-500">{methodLabel[payment.payment_method] ?? payment.payment_method}</td>
                      <td className="py-3 text-end font-semibold text-gray-900">
                        {hasDiscount
                          ? <span className="line-through text-gray-400">{fmt(originalAmt, payment.currency)}</span>
                          : fmt(payment.amount, payment.currency)
                        }
                      </td>
                    </tr>
                    {hasDiscount && (
                      <>
                        <tr className="border-b border-gray-50">
                          <td className="py-2 text-emerald-600 text-xs font-medium" colSpan={2}>
                            🏷 {t('invoice.offerDiscount')}
                          </td>
                          <td className="py-2 text-end text-emerald-600 font-semibold text-xs">
                            − {fmt(payment.discount_amount!, payment.currency)}
                          </td>
                        </tr>
                        <tr className="border-b border-gray-50">
                          <td className="py-2 font-semibold text-gray-900" colSpan={2}>
                            {t('invoice.offerPrice')}
                          </td>
                          <td className="py-2 text-end font-bold text-gray-900">
                            {fmt(payment.amount, payment.currency)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              );
            })()}

            {/* Total */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                    payment.status === 'overdue' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {payment.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : payment.status === 'overdue' ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </span>
                </div>
                <div className="text-end">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{t('invoice.totalPaid')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{fmt(payment.amount, payment.currency)}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {payment.notes && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('invoice.notes')}</p>
                <p className="text-sm text-gray-600">{payment.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">{t('invoice.thankYou', { gym: gym.name })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
