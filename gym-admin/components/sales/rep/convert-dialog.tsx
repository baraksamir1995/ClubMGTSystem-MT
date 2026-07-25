'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, Button, Field, Select, Input } from '@/components/ui';
import { salesApi, SalesApiError, PAYMENT_METHODS, labelize, fmtDate, localDateStr } from './lib';

interface OfferOption {
  id: string;
  quoted_price: number | string;
  valid_until: string | null;
  status: string;
  plan_id: string | null;
}

interface Props {
  leadId: string;
  leadName?: string;
  /** The lead's offers — convert requires picking the accepted one. */
  offers: OfferOption[];
  onClose: () => void;
  onConverted: () => void;
}

/** Close the sale: accepted offer + payment + price + start date. */
export default function ConvertDialog({ leadId, leadName, offers, onClose, onConverted }: Props) {
  const openOffers = offers.filter((o) => o.status !== 'declined');
  const [offerId, setOfferId] = useState(openOffers.length === 1 ? openOffers[0].id : '');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [finalPrice, setFinalPrice] = useState(() =>
    openOffers.length === 1 ? String(openOffers[0].quoted_price ?? '') : '');
  const [startDate, setStartDate] = useState(() => localDateStr(new Date()));
  const [agreementRef, setAgreementRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickOffer = (id: string) => {
    setOfferId(id);
    const offer = openOffers.find((o) => o.id === id);
    if (offer && !finalPrice) setFinalPrice(String(offer.quoted_price ?? ''));
  };

  const submit = async () => {
    if (!offerId) { setError('Pick the accepted offer.'); return; }
    const price = Number(finalPrice);
    if (!Number.isFinite(price) || price < 0) { setError('Enter a valid final price.'); return; }
    if (!startDate) { setError('Pick a start date.'); return; }
    setSaving(true);
    setError(null);
    try {
      await salesApi(`leads/${leadId}/convert`, {
        method: 'POST',
        body: {
          offer_id: offerId,
          payment_method: paymentMethod,
          final_price: price,
          start_date: startDate,
          agreement_ref: agreementRef.trim() || undefined,
        },
      });
      toast.success('Lead converted — welcome aboard!');
      onConverted();
    } catch (e) {
      setError(e instanceof SalesApiError ? e.message : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="sm" closeOnBackdrop={false}>
      <Modal.Header>Convert {leadName ? `“${leadName}”` : 'lead'}</Modal.Header>
      <Modal.Body>
        {openOffers.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No offers on this lead yet. Create an offer first — conversion records which offer was accepted.
          </p>
        ) : (
          <div className="space-y-4">
            {error && <p className="text-sm text-danger">{error}</p>}
            <Field label="Accepted offer" required>
              <Select value={offerId} onChange={(e) => pickOffer(e.target.value)}>
                <option value="">Select an offer…</option>
                {openOffers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {`${o.quoted_price} EGP${o.valid_until ? ` · valid until ${fmtDate(o.valid_until)}` : ''}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Payment method" required>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{labelize(m)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Final price" required>
              <Input type="number" inputMode="decimal" min={0} step="0.01"
                value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} />
            </Field>
            <Field label="Membership start date" required>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Agreement ref" hint="Optional — contract / receipt number.">
              <Input value={agreementRef} onChange={(e) => setAgreementRef(e.target.value)} maxLength={100} />
            </Field>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>Cancel</Button>
        {openOffers.length > 0 && (
          <Button variant="primary" fullWidth onClick={submit} isLoading={saving}>Convert</Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
