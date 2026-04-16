'use client';

import { useState } from 'react';
import { X, RotateCcw, AlertTriangle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Payment } from '@/app/dashboard/payments/page';

interface Props {
  payment: Payment;
  onClose: () => void;
  onRefunded: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

export default function RefundModal({ payment, onClose, onRefunded }: Props) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [amount, setAmount]         = useState(payment.amount.toString());
  const [reason, setReason]         = useState('');
  const [loading, setLoading]       = useState(false);

  const isPaymob       = !!payment.paymob_transaction_id;
  const alreadyRefunded = payment.refunded_amount ?? 0;
  const maxRefundable   = payment.amount - alreadyRefunded;
  const refundAmount    = parseFloat(amount) || 0;
  const isValid = refundAmount > 0 && refundAmount <= maxRefundable && reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const newStatus = refundType === 'full' ? 'refunded' : 'partial_refund';
      const notes = refundType === 'full'
        ? `Refunded: ${reason.trim()}`
        : `Partial refund ${fmt(refundAmount, payment.currency)} of ${fmt(payment.amount, payment.currency)}: ${reason.trim()}`;

      const res = await fetch(`/api/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundAmount, reason: reason.trim(), refundType }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to process refund'); return; }

      toast.success('Refund processed successfully');
      onClose();
      onRefunded();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Process Refund</h2>
            {isPaymob && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-medium">
                <Zap className="w-3 h-3" /> Paymob
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Original payment info */}
          <div className="bg-gray-700/50 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">Original Payment</p>
            <p className="text-white font-semibold">{payment.full_name}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-400">
                {new Date(payment.paid_at ?? payment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              <span className="text-lg font-bold text-emerald-400">{fmt(payment.amount, payment.currency)}</span>
            </div>
          </div>

          {/* Refund type */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Refund Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['full', 'partial'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setRefundType(t); if (t === 'full') setAmount(maxRefundable.toString()); }}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    refundType === t
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {t === 'full' ? `Full Refund (${fmt(maxRefundable, payment.currency)})` : 'Partial Refund'}
                </button>
              ))}
            </div>
          </div>

          {/* Partial amount */}
          {refundType === 'partial' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Refund Amount
                <span className="ml-2 text-gray-500">(max {fmt(maxRefundable, payment.currency)})</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">{payment.currency}</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="0.01"
                  max={maxRefundable}
                  step="0.01"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              {refundAmount > maxRefundable && (
                <p className="text-xs text-red-400 mt-1">
                  Cannot exceed remaining refundable amount of {fmt(maxRefundable, payment.currency)}
                </p>
              )}
            </div>
          )}

          {/* Already refunded banner */}
          {alreadyRefunded > 0 && (
            <div className="flex items-center justify-between bg-gray-700/50 rounded-xl px-4 py-2.5 text-xs">
              <span className="text-gray-400">Already refunded</span>
              <span className="text-amber-400 font-semibold">{fmt(alreadyRefunded, payment.currency)}</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Reason <span className="text-red-400">*</span></label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Enter refund reason..."
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              {isPaymob
                ? `This will send a real refund request to Paymob for ${fmt(refundAmount || payment.amount, payment.currency)}. The money will be returned to the member's original payment method.`
                : `This will mark the payment as ${refundType === 'full' ? 'fully refunded' : 'partially refunded'} and record the reason in the payment history.`
              }
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {loading
            ? (isPaymob ? 'Sending to Paymob…' : 'Processing…')
            : `Refund ${fmt(refundAmount || payment.amount, payment.currency)}`
          }
          </button>
        </div>
      </div>
    </div>
  );
}
