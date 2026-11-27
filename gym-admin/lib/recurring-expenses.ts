/**
 * Recurring expenses — shared types + pure helpers for the Financial
 * Overview (form state → API payload, client-side validation, schedule
 * labels). Kept free of React so it can be unit-tested directly.
 *
 * Server contract: clby-api RecurringExpenseController (see
 * docs/recurring-expenses.md). The API re-validates everything.
 */

export const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type Frequency = typeof FREQUENCIES[number];

export type ScheduleStatus = 'active' | 'paused' | 'ended';
/** Stored occurrence states. "Upcoming" occurrences are computed, not stored
 *  (except `scheduled` = an upcoming one edited ahead of time). */
export type OccurrenceStatus = 'recorded' | 'scheduled' | 'skipped' | 'cancelled';

export type ExpenseKind = 'one_off' | 'recurring';

/** Expenses table "type" filter (kind, or the parent schedule's status). */
export const TYPE_FILTERS = ['all', 'one_off', 'recurring', 'active', 'paused', 'ended'] as const;
export type TypeFilter = typeof TYPE_FILTERS[number];

/** Compact schedule info attached to occurrence rows by GET /expenses. */
export interface RecurringRef {
  id: string;
  frequency: Frequency;
  interval: number;
  recurrence_day: number;
  recurrence_month: number | null;
  start_date: string;
  end_date: string | null;
  status: ScheduleStatus;
  next_occurrence: string | null;
}

export interface RecurringSchedule extends RecurringRef {
  title: string;
  amount: number;
  currency: string;
  category: string;
  payment_method: string | null;
  vendor: string | null;
  description: string | null;
  generated_through: string | null;
  previous_id: string | null;
  created_at: string;
  updated_at: string;
  recorded_count?: number;
  recorded_total?: number;
  last_recorded_date?: string | null;
}

export interface OccurrenceRow {
  id: string;
  scheduled_date: string;
  expense_date: string;
  title: string;
  amount: number;
  currency: string;
  status: OccurrenceStatus;
  recorded_at: string | null;
  updated_at: string;
}

export interface ScheduleEvent {
  action: string;
  actor_name: string | null;
  actor_id: string | null;
  expense_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ScheduleDetail extends RecurringSchedule {
  continued_by: string | null;
  occurrences: OccurrenceRow[];
  upcoming: string[];
  events: ScheduleEvent[];
  audit: {
    created_by: string | null;
    updated_by: string | null;
    paused_at: string | null; paused_by: string | null;
    resumed_at: string | null; resumed_by: string | null;
    ended_at: string | null; ended_by: string | null;
  };
}

export interface UpcomingItem {
  recurring_expense_id: string;
  expense_id: string | null;
  scheduled_date: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  vendor: string | null;
  frequency: Frequency;
  interval: number;
  modified: boolean;
}

/** Form state for the add/edit modal. Every field is a string (inputs). */
export interface ExpenseFormState {
  kind: ExpenseKind;
  title: string;
  amount: string;
  expense_date: string;
  category: string;
  vendor: string;
  payment_method: string;
  description: string;
  // Recurring only
  frequency: Frequency;
  interval: string;
  start_date: string;
  end_date: string;
  recurrence_day: string;
  recurrence_month: string;
}

export type FormErrorKey =
  | 'required' | 'amountInvalid' | 'intervalInvalid' | 'endBeforeStart'
  | 'startInPast' | 'dayInvalid' | 'monthInvalid' | 'dayNotInMonth';

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormState, FormErrorKey>>;

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const INT_RE = /^\d+$/;

/** Days a fixed month can have (Feb allows 29; falls back to 28 in non-leap years). */
export const MAX_DAY_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** ISO weekday (1 Mon … 7 Sun) of a Y-m-d date. */
export function isoWeekday(ymd: string): number {
  const d = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Sensible schedule defaults derived from a start date. */
export function scheduleDefaultsFor(frequency: Frequency, startDate: string): Pick<ExpenseFormState, 'recurrence_day' | 'recurrence_month'> {
  if (!startDate) return { recurrence_day: '', recurrence_month: '' };
  if (frequency === 'weekly') return { recurrence_day: String(isoWeekday(startDate)), recurrence_month: '' };
  const day = String(Number(startDate.slice(8, 10)));
  return {
    recurrence_day: day,
    recurrence_month: frequency === 'yearly' ? String(Number(startDate.slice(5, 7))) : '',
  };
}

/**
 * Client-side validation mirroring the API rules. `minStart` is the
 * earliest allowed start date (create: a year back; edit: today).
 */
export function validateExpenseForm(f: ExpenseFormState, opts: { minStart?: string } = {}): ExpenseFormErrors {
  const e: ExpenseFormErrors = {};
  if (!f.title.trim()) e.title = 'required';
  const amt = f.amount.trim();
  if (!amt) e.amount = 'required';
  else if (!AMOUNT_RE.test(amt) || Number(amt) <= 0) e.amount = 'amountInvalid';
  if (!f.category) e.category = 'required';

  if (f.kind === 'one_off') {
    if (!f.expense_date) e.expense_date = 'required';
    return e;
  }

  if (!f.frequency) e.frequency = 'required';
  if (!f.interval.trim()) e.interval = 'required';
  else if (!INT_RE.test(f.interval.trim()) || Number(f.interval) < 1 || Number(f.interval) > 99) e.interval = 'intervalInvalid';

  if (!f.start_date) e.start_date = 'required';
  else if (opts.minStart && f.start_date < opts.minStart) e.start_date = 'startInPast';
  if (f.end_date && f.start_date && f.end_date < f.start_date) e.end_date = 'endBeforeStart';

  const day = Number(f.recurrence_day);
  if (!f.recurrence_day) e.recurrence_day = 'required';
  else if (!Number.isInteger(day) || day < 1 || day > (f.frequency === 'weekly' ? 7 : 31)) e.recurrence_day = 'dayInvalid';

  if (f.frequency === 'yearly') {
    const month = Number(f.recurrence_month);
    if (!f.recurrence_month) e.recurrence_month = 'required';
    else if (!Number.isInteger(month) || month < 1 || month > 12) e.recurrence_month = 'monthInvalid';
    else if (!e.recurrence_day && day > MAX_DAY_IN_MONTH[month - 1]) e.recurrence_day = 'dayNotInMonth';
  }
  return e;
}

const basics = (f: ExpenseFormState) => ({
  title: f.title.trim(),
  amount: Number(f.amount),
  category: f.category,
  vendor: f.vendor.trim() || null,
  payment_method: f.payment_method || null,
  description: f.description.trim() || null,
});

/** One-off payload: exactly the pre-existing fields — never any recurrence config. */
export function oneOffPayload(f: ExpenseFormState) {
  return { ...basics(f), expense_date: f.expense_date };
}

/** Recurring definition payload for POST/PUT /expenses/recurring. */
export function recurringPayload(f: ExpenseFormState) {
  return {
    ...basics(f),
    frequency: f.frequency,
    interval: Number(f.interval || 1),
    start_date: f.start_date,
    end_date: f.end_date || null,
    recurrence_day: Number(f.recurrence_day),
    recurrence_month: f.frequency === 'yearly' ? Number(f.recurrence_month) : null,
  };
}

type T = (key: string, values?: Record<string, string | number>) => string;

/** Localised weekday / month names for a locale. */
export function weekdayName(isoDay: number, locale: string): string {
  // 2024-01-01 was a Monday.
  const d = new Date(Date.UTC(2024, 0, isoDay));
  return d.toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });
}
export function monthName(month: number, locale: string): string {
  return new Date(Date.UTC(2024, month - 1, 1)).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' });
}

/**
 * Human schedule, e.g. "Every month on day 1", "Every 2 weeks on Friday",
 * "Every year on 15 March". `t` is scoped to payments.financial.recurring.
 */
export function scheduleLabel(s: Pick<RecurringRef, 'frequency' | 'interval' | 'recurrence_day' | 'recurrence_month'>, t: T, locale: string): string {
  const n = s.interval || 1;
  switch (s.frequency) {
    case 'weekly':
      return t('scheduleWeekly', { count: n, day: weekdayName(s.recurrence_day, locale) });
    case 'monthly':
      return t('scheduleMonthly', { count: n, day: s.recurrence_day });
    case 'quarterly':
      return t('scheduleQuarterly', { count: n, day: s.recurrence_day });
    case 'yearly':
      return t('scheduleYearly', { count: n, day: s.recurrence_day, month: monthName(s.recurrence_month ?? 1, locale) });
  }
}
