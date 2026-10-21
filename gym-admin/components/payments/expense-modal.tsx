'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { fmtDateTimeGym } from '@/lib/time';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';

export const EXPENSE_CATEGORIES = [
  'rent', 'salaries', 'equipment', 'utilities', 'marketing',
  'maintenance', 'software', 'transportation', 'other',
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// Mirrors Expense::PAYMENT_METHODS on the API — payments.payment_method
// minus payment_link, which only exists for collecting from members.
export const EXPENSE_METHODS = ['cash', 'bank_transfer', 'card', 'other'] as const;

/** Label for an expense payment method via the shared `payments.method`
 *  strings; `fallback` when none is recorded. */
export function expenseMethodLabel(tm: (key: string) => string, m: string | null, fallback = ''): string {
  switch (m) {
    case 'cash':          return tm('cash');
    case 'bank_transfer': return tm('bankTransfer');
    case 'card':          return tm('card');
    case 'other':         return tm('other');
    default:              return fallback;
  }
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  /** Gym-local business date, Y-m-d. */
  expense_date: string;
  category: ExpenseCategory;
  vendor: string | null;
  payment_method: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseModalMode = 'create' | 'edit' | 'view';

interface Props {
  open: boolean;
  mode: ExpenseModalMode;
  expense: Expense | null;
  /** Today in the gym's timezone, Y-m-d — the default expense date. */
  today: string;
  canEdit: boolean;
  fmtMoney: (n: number) => string;
  fmtDay: (ymd: string) => string;
  onClose: () => void;
  onModeChange: (mode: ExpenseModalMode) => void;
  onSaved: () => void;
}

interface FormState {
  title: string;
  amount: string;
  expense_date: string;
  category: string;
  vendor: string;
  payment_method: string;
  description: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function initialForm(expense: Expense | null, today: string): FormState {
  return {
    title: expense?.title ?? '',
    amount: expense ? String(expense.amount) : '',
    expense_date: expense?.expense_date ?? today,
    category: expense?.category ?? '',
    vendor: expense?.vendor ?? '',
    payment_method: expense?.payment_method ?? '',
    description: expense?.description ?? '',
  };
}

export default function ExpenseModal({
  open, mode, expense, today, canEdit, fmtMoney, fmtDay, onClose, onModeChange, onSaved,
}: Props) {
  const t = useTranslations('payments.financial');
  const tm = useTranslations('payments.method');
  const tc = useTranslations('common');

  const [form, setForm] = useState<FormState>(() => initialForm(expense, today));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // Re-seed whenever the modal is (re)opened on a different record or mode.
  useEffect(() => {
    if (open) {
      setForm(initialForm(expense, today));
      setErrors({});
    }
  }, [open, expense, mode, today]);

  const methodLabel = (m: string | null) => expenseMethodLabel(tm, m, t('form.noMethod'));

  const set = (k: keyof FormState) => (e: { target: { value: string } }) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.title.trim()) e.title = t('form.required');
    const amt = form.amount.trim();
    if (!amt) e.amount = t('form.required');
    else if (!AMOUNT_RE.test(amt) || Number(amt) <= 0) e.amount = t('form.amountInvalid');
    if (!form.expense_date) e.expense_date = t('form.required');
    if (!form.category) e.category = t('form.required');
    return e;
  };

  const save = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        amount: Number(form.amount),
        expense_date: form.expense_date,
        category: form.category,
        vendor: form.vendor.trim() || null,
        payment_method: form.payment_method || null,
        description: form.description.trim() || null,
      };
      const res = await fetch(mode === 'edit' && expense ? `/api/expenses/${expense.id}` : '/api/expenses', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the API's per-field messages inline where they map.
        if (json.errors) {
          const server: Errors = {};
          for (const [k, v] of Object.entries(json.errors as Record<string, string[]>)) {
            if (k in form) server[k as keyof FormState] = v[0];
          }
          setErrors(server);
        }
        toast.error(json.error ?? t('toast.saveFailed'));
        return;
      }
      toast.success(mode === 'edit' ? t('toast.updated') : t('toast.created'));
      onSaved();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'view' && expense) {
    const rows: [string, string][] = [
      [t('form.amount'), fmtMoney(expense.amount)],
      [t('form.category'), t(`categories.${expense.category}` as any)],
      [t('form.date'), fmtDay(expense.expense_date)],
      [t('form.vendor'), expense.vendor || '—'],
      [t('form.method'), methodLabel(expense.payment_method)],
      [t('form.created'), fmtDateTimeGym(expense.created_at)],
      [t('form.updated'), fmtDateTimeGym(expense.updated_at)],
    ];
    return (
      <Modal open={open} onClose={onClose} size="md">
        <Modal.Header>{t('form.viewTitle')}</Modal.Header>
        <Modal.Body>
          <p className="text-lg font-semibold text-fg break-words">{expense.title}</p>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <dt className="text-fg-muted">{k}</dt>
                <dd className="text-fg text-end break-words min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
          {expense.description && (
            <div className="mt-4">
              <p className="text-xs text-fg-muted uppercase tracking-wide font-medium mb-1">{t('form.description')}</p>
              <p className="text-sm text-fg whitespace-pre-wrap break-words">{expense.description}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={onClose}>{tc('close')}</Button>
          {canEdit && (
            <Button variant="primary" fullWidth onClick={() => onModeChange('edit')} leftIcon={<Pencil className="w-4 h-4" />}>
              {tc('edit')}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" closeOnBackdrop={!saving}>
      <Modal.Header>{mode === 'edit' ? t('form.editTitle') : t('form.newTitle')}</Modal.Header>
      <Modal.Body>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); save(); }}
          noValidate
        >
          <Field label={t('form.title')} required error={errors.title}>
            <Input value={form.title} onChange={set('title')} placeholder={t('form.titlePlaceholder')} maxLength={255} autoFocus />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('form.amount')} required error={errors.amount}>
              <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} />
            </Field>
            <Field label={t('form.date')} required error={errors.expense_date}>
              <Input type="date" value={form.expense_date} onChange={set('expense_date')} />
            </Field>
            <Field label={t('form.category')} required error={errors.category}>
              <Select value={form.category} onChange={set('category')}>
                <option value="">{t('form.selectCategory')}</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{t(`categories.${c}` as any)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('form.method')} error={errors.payment_method}>
              <Select value={form.payment_method} onChange={set('payment_method')}>
                <option value="">{t('form.noMethod')}</option>
                {EXPENSE_METHODS.map(m => (
                  <option key={m} value={m}>{methodLabel(m)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('form.vendor')} error={errors.vendor}>
            <Input value={form.vendor} onChange={set('vendor')} maxLength={255} />
          </Field>
          <Field label={t('form.description')} error={errors.description}>
            <Textarea rows={3} value={form.description} onChange={set('description')} maxLength={5000} />
          </Field>
          {/* Lets Enter submit from any single-line input. */}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={save} isLoading={saving}>
          {mode === 'edit' ? t('form.saveEdit') : t('form.saveNew')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
