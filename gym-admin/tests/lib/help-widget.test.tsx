import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import HelpWidget from '@/components/help/help-widget';
import en from '@/messages/en/help.json';
import ar from '@/messages/ar/help.json';

/**
 * Drives the widget the way an admin does: open it, type a question,
 * read the answer. These are the behaviours the feature exists for, so
 * they are asserted through the DOM rather than against internals.
 */
function setup(locale: 'en' | 'ar' = 'en') {
  const messages = { help: locale === 'ar' ? ar : en } as never;
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HelpWidget />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
}

const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Open help' }));
  return screen.getByRole('dialog', { name: 'Help' });
};

describe('HelpWidget', () => {
  it('starts closed and opens on click', async () => {
    const user = setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    const panel = await openPanel(user);
    expect(panel).toBeTruthy();
  });

  it('browses articles grouped by category', async () => {
    const user = setup();
    const panel = await openPanel(user);
    // Category headings and at least one known article.
    expect(within(panel).getByText('Payments')).toBeTruthy();
    expect(within(panel).getByText('How do I create a payment?')).toBeTruthy();
  });

  it('answers the headline question: creating a payment', async () => {
    const user = setup();
    const panel = await openPanel(user);

    await user.type(within(panel).getByRole('searchbox'), 'how do i create a payment');
    // Top result is the payment article.
    const hit = within(panel).getByText('How do I create a payment?');
    await user.click(hit);

    // The article view shows the real click path, step by step.
    expect(within(panel).getByText(/Go to "Payments" in the sidebar/)).toBeTruthy();
    expect(within(panel).getByText(/Click "Record Payment"/)).toBeTruthy();
  });

  it('answers the headline question: creating a member', async () => {
    const user = setup();
    const panel = await openPanel(user);

    await user.type(within(panel).getByRole('searchbox'), 'create a member');
    await user.click(within(panel).getByText('How do I create a member?'));

    expect(within(panel).getByText(/Click "Add Member" at the top right/)).toBeTruthy();
  });

  it('finds an article by a word the title never uses', async () => {
    const user = setup();
    const panel = await openPanel(user);
    await user.type(within(panel).getByRole('searchbox'), 'cash');
    expect(within(panel).getByText('How do I create a payment?')).toBeTruthy();
  });

  it('offers related topics and a support link when nothing matches', async () => {
    const user = setup();
    const panel = await openPanel(user);

    await user.type(within(panel).getByRole('searchbox'), 'zzzznothing');

    expect(within(panel).getByText('No guide matches that')).toBeTruthy();
    // The dead end still offers a way forward.
    expect(within(panel).getByText('Email support about this')).toBeTruthy();
  });

  it('suggests the payments guides when the query is money-flavoured', async () => {
    const user = setup();
    const panel = await openPanel(user);

    await user.type(within(panel).getByRole('searchbox'), 'zzz money zzz');

    expect(within(panel).getByText('You might be looking for')).toBeTruthy();
    expect(within(panel).getByText('How do I create a payment?')).toBeTruthy();
  });

  it('goes back from an article to the list', async () => {
    const user = setup();
    const panel = await openPanel(user);

    await user.click(within(panel).getByText('How do I create a member?'));
    expect(within(panel).getByText(/Click "Add Member" at the top right/)).toBeTruthy();

    await user.click(within(panel).getByRole('button', { name: 'Back to all guides' }));
    // Back on the browse list.
    expect(within(panel).getByRole('searchbox')).toBeTruthy();
  });

  it('closes with the close button', async () => {
    const user = setup();
    const panel = await openPanel(user);
    await user.click(within(panel).getByRole('button', { name: 'Close help' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape backs out of an article before closing the panel', async () => {
    const user = setup();
    const panel = await openPanel(user);

    await user.click(within(panel).getByText('How do I create a member?'));
    await user.keyboard('{Escape}');
    // Still open, but back on the list.
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('searchbox')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mounts without throwing and without console errors', () => {
    // A throw or a React warning at mount is what a blank dashboard
    // looks like in the browser, so assert on both.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => setup()).not.toThrow();
    const calls = err.mock.calls.map(c => String(c[0]));
    err.mockRestore();
    expect(calls, calls.join('\n')).toEqual([]);
  });

  it('works in Arabic, including an Arabic query', async () => {
    const user = setup('ar');
    await user.click(screen.getByRole('button', { name: 'فتح المساعدة' }));
    const panel = screen.getByRole('dialog', { name: 'المساعدة' });

    await user.type(within(panel).getByRole('searchbox'), 'دفعة');
    expect(within(panel).getByText('كيف أُنشئ دفعة؟')).toBeTruthy();
  });
});
