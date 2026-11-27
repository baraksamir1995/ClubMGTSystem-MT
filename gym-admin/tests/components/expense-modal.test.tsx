import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import ExpenseModal, { type ExpenseModalTarget } from '@/components/payments/expense-modal';
import payments from '@/messages/en/payments.json';
import common from '@/messages/en/common.json';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }));

const fetchMock = vi.fn();

function setup(target: ExpenseModalTarget = { mode: 'create' }) {
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ payments, common } as never} timeZone="UTC">
      <ExpenseModal
        target={target}
        today="2026-11-27"
        canEdit
        fmtMoney={(n) => `EGP ${n}`}
        fmtDay={(d) => d}
        onClose={() => {}}
        onTargetChange={() => {}}
        onSaved={onSaved}
      />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup(), onSaved };
}

const lastBody = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Expense title/), 'Internet');
  await user.type(screen.getByLabelText(/^Amount/), '1000');
  await user.selectOptions(screen.getByLabelText(/^Category/), 'utilities');
}

describe('ExpenseModal — expense type', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to One-off with the original fields and no schedule', () => {
    setup();
    const group = screen.getByRole('radiogroup', { name: /Expense type/ });
    expect(within(group).getByRole('radio', { name: /One-off/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/Expense date/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Frequency/)).toBeNull();
  });

  it('switching to Recurring shows and requires the schedule fields', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: /Recurring/ }));
    expect(screen.getByLabelText(/Frequency/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start date/)).toBeInTheDocument();
    expect(screen.getByLabelText(/End date/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Expense date/)).toBeNull();

    await fillBasics(user);
    await user.clear(screen.getByLabelText(/Start date/));
    await user.click(screen.getByRole('button', { name: 'Add recurring expense' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
  });

  it('submits a recurring definition to the recurring endpoint', async () => {
    const { user, onSaved } = setup();
    await user.click(screen.getByRole('radio', { name: /Recurring/ }));
    await fillBasics(user);
    // Start date defaults to today (27 Nov) → day-of-month defaults to 27; pick the 1st.
    await user.selectOptions(screen.getByLabelText(/Day of the month/), '1');
    await user.click(screen.getByRole('button', { name: 'Add recurring expense' }));

    expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/expenses/recurring');
    expect(lastBody()).toMatchObject({
      title: 'Internet', amount: 1000, category: 'utilities', frequency: 'monthly',
      interval: 1, start_date: '2026-11-27', end_date: null, recurrence_day: 1, recurrence_month: null,
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('weekly shows a weekday picker defaulted from the start date', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: /Recurring/ }));
    await user.selectOptions(screen.getByLabelText(/Frequency/), 'weekly');
    const day = screen.getByLabelText(/Day of the week/) as HTMLSelectElement;
    expect(day.value).toBe('5'); // 2026-11-27 is a Friday
  });

  it('switching back to One-off does not submit recurrence configuration', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: /Recurring/ }));
    await user.selectOptions(screen.getByLabelText(/Frequency/), 'yearly');
    await user.click(screen.getByRole('radio', { name: /One-off/ }));
    await fillBasics(user);
    await user.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/expenses');
    const body = lastBody();
    expect(body).toMatchObject({ title: 'Internet', amount: 1000, expense_date: '2026-11-27', category: 'utilities' });
    expect(Object.keys(body).sort()).toEqual(['amount', 'category', 'description', 'expense_date', 'payment_method', 'title', 'vendor']);
  });

  it('editing an upcoming occurrence only sends the basic fields to the occurrence endpoint', async () => {
    const schedule = {
      id: '11111111-1111-1111-1111-111111111111', title: 'Internet', amount: 1000, currency: 'EGP',
      category: 'utilities', payment_method: null, vendor: null, description: null,
      frequency: 'monthly', interval: 1, start_date: '2026-12-01', end_date: null, recurrence_day: 1,
      recurrence_month: null, status: 'active', next_occurrence: '2026-12-01', generated_through: null,
      previous_id: null, created_at: '', updated_at: '',
    } as const;
    const { user } = setup({ mode: 'editUpcoming', schedule: { ...schedule }, date: '2027-01-01' });
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByLabelText(/Frequency/)).toBeNull();
    const amount = screen.getByLabelText(/^Amount/);
    await user.clear(amount);
    await user.type(amount, '1500');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(fetchMock.mock.calls.at(-1)![0]).toBe(`/api/expenses/recurring/${schedule.id}/occurrences/2027-01-01`);
    expect(fetchMock.mock.calls.at(-1)![1].method).toBe('PUT');
    const body = lastBody();
    expect(body.amount).toBe(1500);
    expect(body).not.toHaveProperty('expense_date');
    expect(body).not.toHaveProperty('frequency');
  });
});
