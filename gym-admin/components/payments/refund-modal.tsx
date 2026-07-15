'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw, AlertTriangle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Payment } from '@/app/dashboard/payments/page';
import { Button, Input, Modal, Textarea } from '@/components/ui';

interface Props {
  payment: Payment;
  onClose: () => void;
  onRefunded: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

export default function RefundModal({ payment, onClose, onRefunded }: Props) {
  const t = useTranslations('payments');
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
      const res = await fetch(`/api/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundAmount, reason: reason.trim(), refundType }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('refund.failed')); return; }

      toast.success(t('refund.processedSuccess'));
      onClose();
      onRefunded();
    } catch {
      toast.error(t('toast.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-info" aria-hidden /> {t('refund.title')}
          {isPaymob && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-info-soft border border-info/40 text-info text-xs font-medium">
              <Zap className="w-3 h-3" aria-hidden /> Paymob
            </span>
          )}
        </span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Original payment info */}
        <div className="bg-surface-3/50 rounded-xl p-4">
          <p className="text-xs text-fg-muted mb-1">{t('refund.originalPayment')}</p>
          <p className="text-fg font-semibold">{payment.full_name}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-fg-muted">
              {new Date(payment.paid_at ?? payment.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-lg font-bold text-success">{fmt(payment.amount, payment.currency)}</span>
          </div>
        </div>

        {/* Refund type */}
        <div>
          <label className="block text-xs text-fg-muted mb-2">{t('refund.refundType')}</label>
          <div className="grid grid-cols-2 gap-2">
            {(['full', 'partial'] as const).map(tp => (
              <button
                key={tp}
                onClick={() => { setRefundType(tp); if (tp === 'full') setAmount(maxRefundable.toString()); }}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  refundType === tp
                    ? 'bg-brand/15 border-brand text-brand'
                    : 'bg-surface-3 border-line text-fg-muted hover:border-line-strong'
                }`}
              >
                {tp === 'full' ? t('refund.fullRefund', { amount: fmt(maxRefundable, payment.currency) }) : t('refund.partialRefund')}
              </button>
            ))}
          </div>
        </div>

        {/* Partial amount */}
        {refundType === 'partial' && (
          <div>
            <label className="block text-xs text-fg-muted mb-1.5">
              {t('refund.refundAmount')}
              <span className="ms-2 text-fg-faint">({t('refund.maxAmount', { amount: fmt(maxRefundable, payment.currency) })})</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-fg-muted">{payment.currency}</span>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="0.01"
                max={maxRefundable}
                step="0.01"
                placeholder="0.00"
              />
            </div>
            {refundAmount > maxRefundable && (
              <p className="text-xs text-danger mt-1">
                {t('refund.exceedsMax', { amount: fmt(maxRefundable, payment.currency) })}
              </p>
            )}
          </div>
        )}

        {/* Already refunded banner */}
        {alreadyRefunded > 0 && (
          <div className="flex items-center justify-between bg-surface-3/50 rounded-xl px-4 py-2.5 text-xs">
            <span className="text-fg-muted">{t('refund.alreadyRefunded')}</span>
            <span className="text-warning font-semibold">{fmt(alreadyRefunded, payment.currency)}</span>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-xs text-fg-muted mb-1.5">{t('refund.reason')} <span className="text-danger">*</span></label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder={t('refund.reasonPlaceholder')}
            className="resize-none"
          />
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 bg-warning-soft border border-warning/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-warning">
            {isPaymob
              ? t('refund.paymobWarning', { amount: fmt(refundAmount || payment.amount, payment.currency) })
              : t('refund.manualWarning', { status: refundType === 'full' ? t('refund.fullyRefunded') : t('refund.partiallyRefunded') })
            }
          </p>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{t('refund.cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={!isValid} isLoading={loading}>
          {t('refund.refundButton', { amount: fmt(refundAmount || payment.amount, payment.currency) })}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
