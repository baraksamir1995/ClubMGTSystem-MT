import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en/payments.json';
import RecordPaymentModal, { type CatalogEvent, type CatalogProduct } from '@/components/payments/record-payment-modal';
import type { MemberOption, ServiceOption } from '@/app/dashboard/payments/page';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) },
}));

const member: MemberOption = {
  id: 'm-1', member_number: '7', full_name: 'Sara Ali', email: 'sara@example.com',
  active_membership_id: null, plan_name: null, plan_price: null, currency: 'EGP',
};

const membership: ServiceOption = {
  id: 'plan-1', type: 'membership', name: 'Monthly', price: 800, original_price: null, currency: 'EGP',
  subtitle: '', creates_assignment: false, trainer_type: null, allowed_branch_ids: null,
  plan_promotion_id: null, is_plan: true,
};

const tee: CatalogProduct = {
  id: 'prod-1', name: 'Club Tee', image_url: null, price: 300, currency: 'EGP', stock: null,
  variants: [
    { id: 'var-s', name: 'S', price: 300, stock: 0 },
    { id: 'var-m', name: 'M', price: 320, stock: 4 },
  ],
};
const bottle: CatalogProduct = {
  id: 'prod-2', name: 'Bottle', image_url: null, price: 90, currency: 'EGP', stock: 10, variants: [],
};
const openDay: CatalogEvent = {
  id: 'ev-1', title: 'Open Day', starts_at: '2026-12-05T10:00:00Z', price: 150, currency: 'EGP',
  seats_left: 3, configuration_label: null, configurations: [], unavailable_reason: null,
};
const vipNight: CatalogEvent = {
  ...openDay, id: 'ev-2', title: 'VIP Night', unavailable_reason: 'plan_required',
};

type Call = { url: string; init?: RequestInit };
let calls: Call[];
let postResponse: { status: number; body: unknown };

beforeEach(() => {
  calls = [];
  postResponse = { status: 201, body: { data: { id: 'pay-1' } } };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith('/api/payment-catalog')) {
      return new Response(JSON.stringify({ products: [tee, bottle], events: [openDay, vipNight] }), { status: 200 });
    }
    return new Response(JSON.stringify(postResponse.body), { status: postResponse.status });
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toastError.mockReset();
  toastSuccess.mockReset();
  refresh.mockReset();
});

function setup() {
  const onClose = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ payments: en } as never}>
      <RecordPaymentModal
        memberOptions={[member]}
        serviceOptions={[membership]}
        trainerOptions={[]}
        branches={[]}
        promoCodes={[]}
        onClose={onClose}
      />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup(), onClose };
}

async function pickMember(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(en.recordModal.memberSearchPlaceholder), 'Sara');
  await user.click(screen.getByRole('button', { name: /Sara Ali/ }));
  // Catalog is re-fetched with the member for event eligibility.
  await waitFor(() => expect(calls.some(c => c.url === '/api/payment-catalog?gym_member_id=m-1')).toBe(true));
}

// The footer button submits via form="…", which happy-dom doesn't wire up.
const submit = () => fireEvent.submit(document.getElementById('record-payment-form')!);
const serviceSelect = () => screen.getAllByRole('combobox')[0] as HTMLSelectElement;
const amountInput = () => screen.getByPlaceholderText('0.00') as HTMLInputElement;
const postBody = () => {
  const post = calls.find(c => c.url === '/api/payments' && c.init?.method === 'POST');
  return post ? JSON.parse(String(post.init!.body)) : null;
};

describe('RecordPaymentModal — products and events', () => {
  it('lists store products and events, with ineligible events disabled and explained', async () => {
    const { user } = setup();
    await pickMember(user);

    const select = serviceSelect();
    await waitFor(() => expect(within(select).getByRole('group', { name: 'Store products' })).toBeTruthy());
    expect(within(select).getByRole('group', { name: 'Events' })).toBeTruthy();

    const vip = within(select).getByRole('option', { name: /VIP Night/ }) as HTMLOptionElement;
    expect(vip.disabled).toBe(true);
    expect(vip.textContent).toContain('Not eligible');
    expect((within(select).getByRole('option', { name: /Open Day/ }) as HTMLOptionElement).disabled).toBe(false);
  });

  it('records a variant product: price × qty prefilled, paid only, posts the line', async () => {
    const { user, onClose } = setup();
    await pickMember(user);
    await waitFor(() => within(serviceSelect()).getByRole('option', { name: /Club Tee/ }));
    await user.selectOptions(serviceSelect(), 'product:prod-1');

    const variant = screen.getByLabelText(/Option \/ size/) as HTMLSelectElement;
    expect((within(variant).getByRole('option', { name: /S — 300/ }) as HTMLOptionElement).disabled).toBe(true);
    await user.selectOptions(variant, 'var-m');
    expect(amountInput().value).toBe('320');

    const qty = screen.getByLabelText('Quantity');
    await user.clear(qty);
    await user.type(qty, '2');
    expect(amountInput().value).toBe('640');

    // Payment link and non-paid statuses are not offered for item sales.
    expect(screen.queryByRole('button', { name: en.method.paymentLink })).toBeNull();
    expect(screen.getByRole('button', { name: en.status.pending })).toBeDisabled();

    submit();
    await waitFor(() => expect(postBody()).not.toBeNull());
    expect(postBody()).toMatchObject({
      gym_member_id: 'm-1', service_type: 'product', product_id: 'prod-1', variant_id: 'var-m',
      quantity: 2, amount: 640, status: 'paid', currency: 'EGP',
    });
    expect(postBody()).not.toHaveProperty('plan_id');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it('requires a variant before submitting', async () => {
    const { user } = setup();
    await pickMember(user);
    await waitFor(() => within(serviceSelect()).getByRole('option', { name: /Club Tee/ }));
    await user.selectOptions(serviceSelect(), 'product:prod-1');
    await user.type(amountInput(), '300');
    submit();
    expect(toastError).toHaveBeenCalledWith(en.recordModal.itemErrors.variant_required);
    expect(postBody()).toBeNull();
  });

  it('records an event and shows the API rule failure in words', async () => {
    postResponse = { status: 422, body: { error: 'This event is full.', code: 'event_full' } };
    const { user, onClose } = setup();
    await pickMember(user);
    await waitFor(() => within(serviceSelect()).getByRole('option', { name: /Open Day/ }));
    await user.selectOptions(serviceSelect(), 'event:ev-1');
    expect(amountInput().value).toBe('150');

    submit();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(en.recordModal.itemErrors.event_full));
    expect(postBody()).toMatchObject({ service_type: 'event', event_id: 'ev-1', status: 'paid', amount: 150 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the membership flow as before', async () => {
    const { user } = setup();
    await pickMember(user);
    await user.selectOptions(serviceSelect(), 'plan-1');
    expect(amountInput().value).toBe('800');
    // Pending is still available for memberships.
    expect(screen.getByRole('button', { name: en.status.pending })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: en.method.paymentLink })).toBeTruthy();

    submit();
    await waitFor(() => expect(postBody()).not.toBeNull());
    const body = postBody();
    expect(body).toMatchObject({ service_type: 'membership', plan_id: 'plan-1', amount: 800, status: 'paid' });
    expect(body).not.toHaveProperty('product_id');
    expect(body).not.toHaveProperty('event_id');
  });

  it('switching from a product back to a membership clears the product line', async () => {
    const { user } = setup();
    await pickMember(user);
    await waitFor(() => within(serviceSelect()).getByRole('option', { name: /Bottle/ }));
    await user.selectOptions(serviceSelect(), 'product:prod-2');
    expect(amountInput().value).toBe('90');
    expect(screen.getByTestId('product-line')).toBeTruthy();
    await user.selectOptions(serviceSelect(), 'plan-1');
    expect(screen.queryByTestId('product-line')).toBeNull();
    expect(amountInput().value).toBe('800');
  });
});
