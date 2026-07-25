'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Tag, ShieldAlert } from 'lucide-react';
import { Button, Field, Select, Input, Textarea, EmptyState, Badge } from '@/components/ui';
import {
  salesApi, SalesApiError, DISCOUNT_TYPES, OBJECTION_REASONS,
  labelize, fmtDate, fmtDateTime,
} from './lib';

interface PlanOption {
  id: string;
  name: string;
  price: number;
  currency?: string;
  is_active?: boolean;
}

interface Props {
  lead: any;        // SalesLeadDetail
  readOnly: boolean;
  onChanged: () => void;
}

function offerStatusVariant(status: string): 'neutral' | 'success' | 'danger' {
  if (status === 'accepted') return 'success';
  if (status === 'declined') return 'danger';
  return 'neutral';
}

/** Offers tab — offer builder + objection log. */
export default function DetailOffers({ lead, readOnly, onChanged }: Props) {
  const [plans, setPlans] = useState<PlanOption[]>([]);

  // Offer form
  const [planId, setPlanId] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [discountType, setDiscountType] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [incentiveNotes, setIncentiveNotes] = useState('');
  const [savingOffer, setSavingOffer] = useState(false);

  // Objection form
  const [objReason, setObjReason] = useState('');
  const [objNotes, setObjNotes] = useState('');
  const [savingObj, setSavingObj] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Existing gym-admin proxy — returns a plain array of plans.
        const res = await fetch('/api/plans');
        if (!res.ok) return;
        const json = await res.json();
        const list: PlanOption[] = Array.isArray(json) ? json : json.data ?? [];
        if (!cancelled) setPlans(list.filter((p) => p.is_active !== false));
      } catch { /* plan dropdown stays empty — offer still works */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const pickPlan = (id: string) => {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan && !quotedPrice) setQuotedPrice(String(plan.price ?? ''));
  };

  const offers: any[] = [...(lead.offers ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const objections: any[] = [...(lead.objections ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const submitOffer = async () => {
    const price = Number(quotedPrice);
    if (!Number.isFinite(price) || price < 0) { toast.error('Enter a valid quoted price.'); return; }
    setSavingOffer(true);
    try {
      await salesApi(`leads/${lead.id}/offers`, {
        method: 'POST',
        body: {
          plan_id: planId || undefined,
          quoted_price: price,
          discount_type: discountType || undefined,
          discount_value: discountValue !== '' ? Number(discountValue) : undefined,
          valid_until: validUntil || undefined,
          incentive_notes: incentiveNotes.trim() || undefined,
        },
      });
      setPlanId(''); setQuotedPrice(''); setDiscountType(''); setDiscountValue('');
      setValidUntil(''); setIncentiveNotes('');
      toast.success('Offer created');
      onChanged();
    } catch (e) {
      toast.error(e instanceof SalesApiError ? e.message : 'Network error');
    } finally {
      setSavingOffer(false);
    }
  };

  const submitObjection = async () => {
    if (!objReason) { toast.error('Pick an objection reason.'); return; }
    setSavingObj(true);
    try {
      await salesApi(`leads/${lead.id}/objections`, {
        method: 'POST',
        body: { reason: objReason, notes: objNotes.trim() || undefined },
      });
      setObjReason(''); setObjNotes('');
      toast.success('Objection logged');
      onChanged();
    } catch (e) {
      toast.error(e instanceof SalesApiError ? e.message : 'Network error');
    } finally {
      setSavingObj(false);
    }
  };

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? null;

  return (
    <div className="space-y-6">
      {/* ── Offers ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-fg">Offers</h3>

        {!readOnly && (
          <div className="p-4 bg-surface-2 border border-line rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Plan">
                <Select value={planId} onChange={(e) => pickPlan(e.target.value)}>
                  <option value="">No specific plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.price}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Quoted price" required>
                <Input type="number" inputMode="decimal" min={0} step="0.01"
                  value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} />
              </Field>
              <Field label="Discount type">
                <Select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                  <option value="">None</option>
                  {DISCOUNT_TYPES.map((d) => (
                    <option key={d} value={d}>{labelize(d)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Discount value">
                <Input type="number" inputMode="decimal" min={0} step="0.01"
                  value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                  disabled={!discountType} />
              </Field>
              <Field label="Valid until">
                <Input type="date" value={validUntil}
                  min={new Date().toLocaleDateString('en-CA')}
                  onChange={(e) => setValidUntil(e.target.value)} />
              </Field>
            </div>
            <Field label="Incentive notes" hint="Free PT session, waived joining fee, bring-a-friend…">
              <Textarea rows={2} value={incentiveNotes} onChange={(e) => setIncentiveNotes(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={submitOffer} isLoading={savingOffer}
              className="w-full sm:w-auto" leftIcon={<Tag className="w-4 h-4" />}>
              Create offer
            </Button>
          </div>
        )}

        {offers.length === 0 ? (
          <EmptyState size="sm" icon={Tag} title="No offers yet"
            description="Build an offer to present pricing to this lead." />
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => (
              <li key={o.id} className="p-3 bg-surface-2 border border-line rounded-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-fg">{o.quoted_price}</span>
                  {planName(o.plan_id) && <span className="text-xs text-fg-muted">{planName(o.plan_id)}</span>}
                  <Badge size="sm" variant={offerStatusVariant(o.status)}>{labelize(o.status)}</Badge>
                  <span className="text-xs text-fg-faint ms-auto">{fmtDateTime(o.created_at)}</span>
                </div>
                <div className="text-xs text-fg-muted mt-1 space-x-2">
                  {o.discount_type && (
                    <span>{labelize(o.discount_type)}{o.discount_value ? `: ${o.discount_value}` : ''}</span>
                  )}
                  {o.valid_until && <span>Valid until {fmtDate(o.valid_until)}</span>}
                </div>
                {o.incentive_notes && <p className="text-xs text-fg-muted mt-1">{o.incentive_notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Objections ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-fg">Objections</h3>

        {!readOnly && (
          <div className="p-4 bg-surface-2 border border-line rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Reason" required>
                <Select value={objReason} onChange={(e) => setObjReason(e.target.value)}>
                  <option value="">Select…</option>
                  {OBJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>{labelize(r)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes">
                <Input value={objNotes} onChange={(e) => setObjNotes(e.target.value)}
                  placeholder="What exactly is holding them back?" />
              </Field>
            </div>
            <Button variant="secondary" onClick={submitObjection} isLoading={savingObj}
              className="w-full sm:w-auto" leftIcon={<ShieldAlert className="w-4 h-4" />}>
              Log objection
            </Button>
          </div>
        )}

        {objections.length > 0 && (
          <ul className="space-y-2">
            {objections.map((o) => (
              <li key={o.id} className="p-3 bg-surface-2 border border-line rounded-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-fg">{labelize(o.reason)}</span>
                  <span className="text-xs text-fg-faint ms-auto">{fmtDateTime(o.created_at)}</span>
                </div>
                {o.notes && <p className="text-xs text-fg-muted mt-1">{o.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
