import { describe, it, expect } from 'vitest';
import {
  isoWeekday,
  oneOffPayload,
  recurringPayload,
  scheduleDefaultsFor,
  scheduleLabel,
  validateExpenseForm,
  type ExpenseFormState,
} from '@/lib/recurring-expenses';
import en from '@/messages/en/payments.json';
import ar from '@/messages/ar/payments.json';

const base: ExpenseFormState = {
  kind: 'one_off', title: 'Internet', amount: '1000', expense_date: '2026-11-27', category: 'utilities',
  vendor: ' ISP ', payment_method: 'bank_transfer', description: '',
  frequency: 'monthly', interval: '1', start_date: '2026-12-01', end_date: '', recurrence_day: '1', recurrence_month: '',
};

describe('validateExpenseForm', () => {
  it('one-off: only the original fields are required', () => {
    expect(validateExpenseForm(base)).toEqual({});
    expect(validateExpenseForm({ ...base, title: ' ', amount: '0', expense_date: '', category: '' })).toEqual({
      title: 'required', amount: 'amountInvalid', expense_date: 'required', category: 'required',
    });
    // Broken recurrence fields don't matter for a one-off.
    expect(validateExpenseForm({ ...base, interval: 'x', start_date: '', recurrence_day: '' })).toEqual({});
  });

  it('recurring: schedule fields are required and checked', () => {
    const r = { ...base, kind: 'recurring' as const };
    expect(validateExpenseForm(r)).toEqual({});
    // expense_date isn't a recurring field.
    expect(validateExpenseForm({ ...r, expense_date: '' })).toEqual({});
    expect(validateExpenseForm({ ...r, start_date: '', recurrence_day: '', interval: '' })).toEqual({
      start_date: 'required', recurrence_day: 'required', interval: 'required',
    });
    expect(validateExpenseForm({ ...r, interval: '0' }).interval).toBe('intervalInvalid');
    expect(validateExpenseForm({ ...r, interval: '1.5' }).interval).toBe('intervalInvalid');
    expect(validateExpenseForm({ ...r, end_date: '2026-11-30' }).end_date).toBe('endBeforeStart');
    expect(validateExpenseForm({ ...r, frequency: 'weekly', recurrence_day: '8' }).recurrence_day).toBe('dayInvalid');
    expect(validateExpenseForm({ ...r, recurrence_day: '32' }).recurrence_day).toBe('dayInvalid');
    expect(validateExpenseForm({ ...r, recurrence_day: '31' })).toEqual({}); // clamps server-side
  });

  it('recurring yearly: needs a month and a day that month can have', () => {
    const y = { ...base, kind: 'recurring' as const, frequency: 'yearly' as const };
    expect(validateExpenseForm(y).recurrence_month).toBe('required');
    expect(validateExpenseForm({ ...y, recurrence_month: '2', recurrence_day: '30' }).recurrence_day).toBe('dayNotInMonth');
    expect(validateExpenseForm({ ...y, recurrence_month: '2', recurrence_day: '29' })).toEqual({});
  });

  it('minStart bounds the start date (edit applies from today)', () => {
    const r = { ...base, kind: 'recurring' as const, start_date: '2026-11-20' };
    expect(validateExpenseForm(r, { minStart: '2026-11-27' }).start_date).toBe('startInPast');
    expect(validateExpenseForm(r, { minStart: '2025-11-26' })).toEqual({});
  });
});

describe('payloads', () => {
  it('one-off payload never carries recurrence config', () => {
    const p = oneOffPayload({ ...base, kind: 'recurring' });
    expect(p).toEqual({
      title: 'Internet', amount: 1000, category: 'utilities', vendor: 'ISP',
      payment_method: 'bank_transfer', description: null, expense_date: '2026-11-27',
    });
    for (const k of ['frequency', 'interval', 'start_date', 'end_date', 'recurrence_day', 'recurrence_month']) {
      expect(p).not.toHaveProperty(k);
    }
  });

  it('recurring payload: numbers, null end date, month only for yearly', () => {
    const p = recurringPayload({ ...base, kind: 'recurring' });
    expect(p).toMatchObject({ frequency: 'monthly', interval: 1, start_date: '2026-12-01', end_date: null, recurrence_day: 1, recurrence_month: null });
    expect(p).not.toHaveProperty('expense_date');
    const y = recurringPayload({ ...base, kind: 'recurring', frequency: 'yearly', recurrence_month: '3', recurrence_day: '15', interval: '2' });
    expect(y).toMatchObject({ recurrence_month: 3, recurrence_day: 15, interval: 2 });
  });
});

describe('schedule defaults + labels', () => {
  it('derives the day from the start date', () => {
    expect(isoWeekday('2026-12-04')).toBe(5); // Friday
    expect(isoWeekday('2026-12-06')).toBe(7); // Sunday
    expect(scheduleDefaultsFor('weekly', '2026-12-04')).toEqual({ recurrence_day: '5', recurrence_month: '' });
    expect(scheduleDefaultsFor('monthly', '2026-12-04')).toEqual({ recurrence_day: '4', recurrence_month: '' });
    expect(scheduleDefaultsFor('yearly', '2026-03-09')).toEqual({ recurrence_day: '9', recurrence_month: '3' });
  });

  it('labels a schedule via the message keys', () => {
    const calls: [string, Record<string, unknown> | undefined][] = [];
    const t = (k: string, v?: Record<string, string | number>) => { calls.push([k, v]); return k; };
    scheduleLabel({ frequency: 'weekly', interval: 2, recurrence_day: 5, recurrence_month: null }, t, 'en');
    scheduleLabel({ frequency: 'yearly', interval: 1, recurrence_day: 15, recurrence_month: 3 }, t, 'en');
    expect(calls[0]).toEqual(['scheduleWeekly', { count: 2, day: 'Friday' }]);
    expect(calls[1]).toEqual(['scheduleYearly', { count: 1, day: 15, month: 'March' }]);
  });
});

describe('messages', () => {
  // Every key added for recurring expenses must exist in both locales.
  const keys = (o: unknown, p = ''): string[] =>
    o && typeof o === 'object'
      ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
      : [p];
  it('en and ar payments.financial have the same keys', () => {
    expect(keys(ar.financial).sort()).toEqual(keys(en.financial).sort());
  });
});
