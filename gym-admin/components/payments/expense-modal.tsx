'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarClock, Pencil, Receipt, Repeat } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { fmtDateTimeGym } from '@/lib/time';
import { apiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { Badge, Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import {
  FREQUENCIES,
  MAX_DAY_IN_MONTH,
  monthName,
  oneOffPayload,
  recurringPayload,
  scheduleDefaultsFor,
  scheduleLabel,
  validateExpenseForm,
  weekdayName,
  type ExpenseFormErrors,
  type ExpenseFormState,
  type ExpenseKind,
  type Frequency,
  type OccurrenceStatus,
  type RecurringRef,
  type RecurringSchedule,
} from '@/lib/recurring-expenses';

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
  /** Null for a one-off expense. */
  recurring_expense_id?: string | null;
  scheduled_date?: string | null;
  status?: OccurrenceStatus;
  currency?: string;
  recurring?: RecurringRef | null;
}

/**
 * What the modal is doing:
 *   create        — new expense; One-off / Recurring selector at the top.
 *   view / edit   — an expense row. For a recurring occurrence, edit is
 *                   "this occurrence only".
 *   editSchedule  — "this and future occurrences" of a schedule, from `from`.
 *   editUpcoming  — "this occurrence only" for a not-yet-recorded date.
 */
export type ExpenseModalTarget =
  | { mode: 'create' }
  | { mode: 'view'; expense: Expense }
  | { mode: 'edit'; expense: Expense }
  | { mode: 'editSchedule'; schedule: RecurringSchedule; from: string }
  | { mode: 'editUpcoming'; schedule: RecurringSchedule; date: string; values?: Partial<Pick<Expense, 'title' | 'amount' | 'category' | 'vendor' | 'payment_method' | 'description'>> };

interface Props {
  target: ExpenseModalTarget | null;
  /** Today in the gym's timezone, Y-m-d — the default expense date. */
  today: string;
  canEdit: boolean;
  fmtMoney: (n: number, currency?: string) => string;
  fmtDay: (ymd: string) => string;
  onClose: () => void;
  onTargetChange: (target: ExpenseModalTarget) => void;
  onOpenSchedule?: (scheduleId: string) => void;
  onSaved: () => void;
}

const DAYS_31 = Array.from({ length: 31 }, (_, i) => i + 1);

function yearAgo(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 366);
  return d.toISOString().slice(0, 10);
}

function initialForm(target: ExpenseModalTarget | null, today: string): ExpenseFormState {
  const base: ExpenseFormState = {
    kind: 'one_off', title: '', amount: '', expense_date: today, category: '', vendor: '',
    payment_method: '', description: '',
    frequency: 'monthly', interval: '1', start_date: today, end_date: '',
    ...scheduleDefaultsFor('monthly', today),
  };
  if (!target || target.mode === 'create') return base;

  if (target.mode === 'view' || target.mode === 'edit') {
    const e = target.expense;
    return {
      ...base,
      title: e.title, amount: String(e.amount), expense_date: e.expense_date, category: e.category,
      vendor: e.vendor ?? '', payment_method: e.payment_method ?? '', description: e.description ?? '',
    };
  }

  const s = target.schedule;
  const v = target.mode === 'editUpcoming' ? target.values ?? {} : {};
  return {
    ...base,
    kind: 'recurring',
    title: v.title ?? s.title,
    amount: String(v.amount ?? s.amount),
    category: v.category ?? s.category,
    vendor: (v.vendor !== undefined ? v.vendor : s.vendor) ?? '',
    payment_method: (v.payment_method !== undefined ? v.payment_method : s.payment_method) ?? '',
    description: (v.description !== undefined ? v.description : s.description) ?? '',
    frequency: s.frequency,
    interval: String(s.interval),
    start_date: target.mode === 'editSchedule' ? target.from : s.start_date,
    end_date: s.end_date ?? '',
    recurrence_day: String(s.recurrence_day),
    recurrence_month: s.recurrence_month ? String(s.recurrence_month) : '',
  };
}

export default function ExpenseModal({
  target, today, canEdit, fmtMoney, fmtDay, onClose, onTargetChange, onOpenSchedule, onSaved,
}: Props) {
  const t = useTranslations('payments.financial');
  const tr = useTranslations('payments.financial.recurring');
  const tm = useTranslations('payments.method');
  const tc = useTranslations('common');
  const tErr = useTranslations('common.errors');
  const locale = useLocale();

  const open = target !== null;
  const mode = target?.mode ?? 'create';

  const [form, setForm] = useState<ExpenseFormState>(() => initialForm(target, today));
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof ExpenseFormState, string>>>({});
  const [saving, setSaving] = useState(false);
  // Once the admin picks a day/month by hand, a start-date change no
  // longer overwrites it.
  const [dayTouched, setDayTouched] = useState(false);

  // Re-seed whenever the modal is (re)opened on a different record or mode.
  useEffect(() => {
    if (open) {
      setForm(initialForm(target, today));
      setErrors({});
      setServerErrors({});
      setDayTouched(target?.mode === 'editSchedule');
    }
  }, [open, target, today]);

  const methodLabel = (m: string | null) => expenseMethodLabel(tm, m, t('form.noMethod'));

  const set = (k: keyof ExpenseFormState) => (e: { target: { value: string } }) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const setKind = (kind: ExpenseKind) => {
    setForm(f => ({ ...f, kind }));
    setErrors({});
    setServerErrors({});
  };

  const setFrequency = (frequency: Frequency) => setForm(f => ({
    ...f, frequency,
    // A weekday and a day-of-month aren't interchangeable: re-derive.
    ...scheduleDefaultsFor(frequency, f.start_date || today),
  }));

  const setStart = (start_date: string) => setForm(f => ({
    ...f, start_date,
    ...(dayTouched || !start_date ? {} : scheduleDefaultsFor(f.frequency, start_date)),
  }));

  const isScheduleEdit = mode === 'editSchedule';
  const isUpcomingEdit = mode === 'editUpcoming';
  const showRecurring = form.kind === 'recurring' && !isUpcomingEdit && (mode === 'create' || isScheduleEdit);
  const minStart = isScheduleEdit ? today : yearAgo(today);

  const errText = (k: keyof ExpenseFormState): string | undefined => {
    if (serverErrors[k]) return serverErrors[k];
    const key = errors[k];
    if (!key) return undefined;
    if (key === 'required') return t('form.required');
    if (key === 'amountInvalid') return t('form.amountInvalid');
    if (key === 'startInPast') return isScheduleEdit ? tr('errors.startInPast') : tr('errors.startTooOld');
    return tr(`errors.${key}` as any);
  };

  const save = async () => {
    const e = validateExpenseForm(
      isUpcomingEdit || mode === 'edit' ? { ...form, kind: 'one_off', expense_date: form.expense_date || today } : form,
      { minStart },
    );
    setErrors(e);
    setServerErrors({});
    if (Object.keys(e).length > 0) return;

    let url = '/api/expenses';
    let method: 'POST' | 'PUT' = 'POST';
    let payload: Record<string, unknown>;
    let okMsg = t('toast.created');

    if (target?.mode === 'edit') {
      url = `/api/expenses/${target.expense.id}`; method = 'PUT';
      payload = oneOffPayload(form); okMsg = t('toast.updated');
    } else if (target?.mode === 'editSchedule') {
      url = `/api/expenses/recurring/${target.schedule.id}`; method = 'PUT';
      payload = recurringPayload(form); okMsg = tr('toast.updated');
    } else if (target?.mode === 'editUpcoming') {
      url = `/api/expenses/recurring/${target.schedule.id}/occurrences/${target.date}`; method = 'PUT';
      const { expense_date: _omit, ...rest } = oneOffPayload(form);
      payload = rest; okMsg = tr('toast.occurrenceUpdated');
    } else if (form.kind === 'recurring') {
      url = '/api/expenses/recurring';
      payload = recurringPayload(form); okMsg = tr('toast.created');
    } else {
      // One-off: exactly the pre-existing payload, never any recurrence config.
      payload = oneOffPayload(form);
    }

    setSaving(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the API's per-field messages inline where they map.
        if (json?.errors) {
          const server: Partial<Record<keyof ExpenseFormState, string>> = {};
          for (const [k, v] of Object.entries(json.errors as Record<string, string[]>)) {
            if (k in form) server[k as keyof ExpenseFormState] = v[0];
          }
          setServerErrors(server);
        }
        toast.error(apiErrorMessage(json, res.status, tErr) || t('toast.saveFailed'));
        return;
      }
      toast.success(okMsg);
      onSaved();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setSaving(false);
    }
  };

  // ── View ────────────────────────────────────────────────────────────
  if (target?.mode === 'view') {
    const expense = target.expense;
    const r = expense.recurring ?? null;
    const money = (n: number) => fmtMoney(n, expense.currency);
    const rows: [string, React.ReactNode][] = [
      [t('form.amount'), money(expense.amount)],
      [t('form.category'), t(`categories.${expense.category}` as any)],
      [t('form.date'), fmtDay(expense.expense_date)],
      [t('form.vendor'), expense.vendor || '—'],
      [t('form.method'), methodLabel(expense.payment_method)],
    ];
    if (r) {
      rows.push(
        [t('col.type'), tr('typeLabel', { frequency: t(`frequency.${r.frequency}` as any) })],
        [tr('scheduleSection'), scheduleLabel(r, tr as any, locale)],
        [t('col.status'), <Badge key="s" size="sm" variant={statusVariant(r.status)}>{t(`scheduleStatus.${r.status}` as any)}</Badge>],
        [tr('nextOccurrence'), r.next_occurrence ? fmtDay(r.next_occurrence) : '—'],
      );
    }
    rows.push(
      [t('form.created'), fmtDateTimeGym(expense.created_at)],
      [t('form.updated'), fmtDateTimeGym(expense.updated_at)],
    );
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
          {r && onOpenSchedule && (
            <Button className="mt-4" variant="ghost" size="sm" leftIcon={<CalendarClock className="w-4 h-4" />} onClick={() => onOpenSchedule(r.id)}>
              {tr('viewSchedule')}
            </Button>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={onClose}>{tc('close')}</Button>
          {canEdit && (
            <Button variant="primary" fullWidth onClick={() => onTargetChange({ mode: 'edit', expense })} leftIcon={<Pencil className="w-4 h-4" />}>
              {tc('edit')}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────
  const heading =
    mode === 'edit' ? t('form.editTitle')
      : isScheduleEdit ? tr('editScheduleTitle')
        : isUpcomingEdit && target?.mode === 'editUpcoming' ? tr('editOccurrenceTitle', { date: fmtDay(target.date) })
          : t('form.newTitle');
  const submitLabel =
    mode === 'edit' || isUpcomingEdit ? t('form.saveEdit')
      : isScheduleEdit ? tr('saveSchedule')
        : form.kind === 'recurring' ? tr('saveNew') : t('form.saveNew');
  const editingOccurrence = target?.mode === 'edit' && !!target.expense.recurring_expense_id;

  return (
    <Modal open={open} onClose={onClose} size="lg" closeOnBackdrop={!saving}>
      <Modal.Header>{heading}</Modal.Header>
      <Modal.Body>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); save(); }}
          noValidate
        >
          {mode === 'create' && (
            <KindSelector
              value={form.kind}
              onChange={setKind}
              label={t('kind.label')}
              options={[
                { value: 'one_off', title: t('kind.oneOff'), hint: t('kind.oneOffHint'), icon: <Receipt className="w-4 h-4" aria-hidden /> },
                { value: 'recurring', title: t('kind.recurring'), hint: t('kind.recurringHint'), icon: <Repeat className="w-4 h-4" aria-hidden /> },
              ]}
            />
          )}

          {(editingOccurrence || isUpcomingEdit) && (
            <p className="text-xs text-fg-muted bg-surface-2 border border-line rounded-lg px-3 py-2">{tr('editOccurrenceHint')}</p>
          )}

          <Field label={t('form.title')} required error={errText('title')}>
            <Input value={form.title} onChange={set('title')} placeholder={t('form.titlePlaceholder')} maxLength={255} autoFocus />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('form.amount')} required error={errText('amount')}>
              <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} />
            </Field>
            {form.kind === 'one_off' && mode !== 'editUpcoming' && (
              <Field label={t('form.date')} required error={errText('expense_date')}>
                <Input type="date" value={form.expense_date} onChange={set('expense_date')} />
              </Field>
            )}
            <Field label={t('form.category')} required error={errText('category')}>
              <Select value={form.category} onChange={set('category')}>
                <option value="">{t('form.selectCategory')}</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{t(`categories.${c}` as any)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('form.method')} error={errText('payment_method')}>
              <Select value={form.payment_method} onChange={set('payment_method')}>
                <option value="">{t('form.noMethod')}</option>
                {EXPENSE_METHODS.map(m => (
                  <option key={m} value={m}>{methodLabel(m)}</option>
                ))}
              </Select>
            </Field>
          </div>

          {showRecurring && (
            <ScheduleFields
              form={form}
              today={today}
              isScheduleEdit={isScheduleEdit}
              locale={locale}
              errText={errText}
              onFrequency={setFrequency}
              onStart={setStart}
              onField={(k, v) => { if (k === 'recurrence_day' || k === 'recurrence_month') setDayTouched(true); setForm(f => ({ ...f, [k]: v })); }}
            />
          )}

          <Field label={t('form.vendor')} error={errText('vendor')}>
            <Input value={form.vendor} onChange={set('vendor')} maxLength={255} />
          </Field>
          <Field label={t('form.description')} error={errText('description')}>
            <Textarea rows={3} value={form.description} onChange={set('description')} maxLength={5000} />
          </Field>
          {/* Lets Enter submit from any single-line input. */}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={save} isLoading={saving}>{submitLabel}</Button>
      </Modal.Footer>
    </Modal>
  );
}

export function statusVariant(s: string): 'success' | 'warning' | 'neutral' | 'danger' | 'brand' {
  switch (s) {
    case 'active': case 'recorded': return 'success';
    case 'paused': case 'scheduled': return 'warning';
    case 'cancelled': return 'danger';
    case 'upcoming': return 'brand';
    default: return 'neutral';
  }
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

/** One-off / Recurring selectable cards (a radio group). */
function KindSelector({
  value, onChange, label, options,
}: {
  value: ExpenseKind;
  onChange: (v: ExpenseKind) => void;
  label: string;
  options: { value: ExpenseKind; title: string; hint: string; icon: React.ReactNode }[];
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-fg-muted mb-1.5">
        {label} <span className="text-danger" aria-hidden>*</span>
      </legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(o => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex items-start gap-3 text-start rounded-xl border px-3 py-2.5 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                active ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:bg-surface-3',
              )}
            >
              <span className={cn('mt-0.5 flex-shrink-0', active ? 'text-brand' : 'text-fg-muted')}>{o.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{o.title}</span>
                <span className="block text-xs text-fg-muted">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ScheduleFields({
  form, today, isScheduleEdit, locale, errText, onFrequency, onStart, onField,
}: {
  form: ExpenseFormState;
  today: string;
  isScheduleEdit: boolean;
  locale: string;
  errText: (k: keyof ExpenseFormState) => string | undefined;
  onFrequency: (f: Frequency) => void;
  onStart: (d: string) => void;
  onField: (k: keyof ExpenseFormState, v: string) => void;
}) {
  const t = useTranslations('payments.financial');
  const tr = useTranslations('payments.financial.recurring');
  const n = Math.max(1, Number(form.interval) || 1);
  const month = Number(form.recurrence_month) || 0;
  const maxDay = form.frequency === 'yearly' && month ? MAX_DAY_IN_MONTH[month - 1] : 31;
  const weekdays = useMemo(() => [1, 2, 3, 4, 5, 6, 7].map(d => ({ d, name: weekdayName(d, locale) })), [locale]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ m: i + 1, name: monthName(i + 1, locale) })), [locale]);

  const dayHint = form.frequency === 'weekly' ? undefined
    : form.frequency === 'yearly' ? (month === 2 && form.recurrence_day === '29' ? tr('yearlyFebHint') : undefined)
      : Number(form.recurrence_day) > 28 ? tr('dayHint') : (form.frequency === 'quarterly' ? tr('quarterHint') : undefined);

  return (
    <fieldset className="space-y-4 rounded-xl border border-line p-3 sm:p-4">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-fg-muted">{tr('scheduleSection')}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={tr('frequency')} required error={errText('frequency')}>
          <Select value={form.frequency} onChange={e => onFrequency(e.target.value as Frequency)}>
            {FREQUENCIES.map(f => <option key={f} value={f}>{t(`frequency.${f}` as any)}</option>)}
          </Select>
        </Field>
        <Field label={tr('interval')} required error={errText('interval')} hint={tr('intervalHint')}>
          <div className="flex items-center gap-2">
            <Input
              type="number" inputMode="numeric" min="1" max="99" step="1" className="w-24"
              value={form.interval} onChange={e => onField('interval', e.target.value)}
            />
            <span className="text-sm text-fg-muted">{tr(`intervalUnit.${form.frequency}` as any, { count: n })}</span>
          </div>
        </Field>

        {form.frequency === 'weekly' && (
          <Field label={tr('weekday')} required error={errText('recurrence_day')}>
            <Select value={form.recurrence_day} onChange={e => onField('recurrence_day', e.target.value)}>
              <option value="" />
              {weekdays.map(w => <option key={w.d} value={w.d}>{w.name}</option>)}
            </Select>
          </Field>
        )}
        {form.frequency === 'yearly' && (
          <Field label={tr('month')} required error={errText('recurrence_month')}>
            <Select value={form.recurrence_month} onChange={e => onField('recurrence_month', e.target.value)}>
              <option value="" />
              {months.map(m => <option key={m.m} value={m.m}>{m.name}</option>)}
            </Select>
          </Field>
        )}
        {form.frequency !== 'weekly' && (
          <Field label={tr('dayOfMonth')} required error={errText('recurrence_day')} hint={dayHint}>
            <Select value={form.recurrence_day} onChange={e => onField('recurrence_day', e.target.value)}>
              <option value="" />
              {DAYS_31.filter(d => d <= maxDay).map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={isScheduleEdit ? tr('effectiveFrom') : tr('startDate')}
          required
          error={errText('start_date')}
          hint={isScheduleEdit ? tr('effectiveHint') : (form.start_date && form.start_date < today ? tr('startPastHint') : tr('startHint'))}
        >
          <Input type="date" value={form.start_date} min={isScheduleEdit ? today : undefined} onChange={e => onStart(e.target.value)} />
        </Field>
        <Field label={tr('endDate')} error={errText('end_date')} hint={tr('endHint')}>
          <Input type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => onField('end_date', e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-fg-faint">{tr('upcomingNotCounted')}</p>
    </fieldset>
  );
}
