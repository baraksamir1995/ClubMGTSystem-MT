import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enAttendance from '@/messages/en/attendance.json';
import enCommon from '@/messages/en/common.json';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

import ManualLogModal, { type OutboxCheckin } from '@/components/attendance/manual-log-modal';

const BRANCH = { id: 'b1', name: 'Main' } as never;
const cachedMember = { id: 'm-cached', member_number: '42', full_name: 'Sara Cached', plan_type: null };

function setup(outbox: OutboxCheckin | null, onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ attendance: enAttendance, common: enCommon } as never} timeZone="UTC">
      <ManualLogModal
        members={[{ id: 'm-online', member_number: '1', full_name: 'Omar Online', plan_type: null }]}
        accessPoints={[]}
        sessionEntryPoints={[]}
        sessionOptions={[]}
        branches={[BRANCH]}
        onClose={onClose}
        onSaved={vi.fn()}
        outbox={outbox}
      />
    </NextIntlClientProvider>,
  );
  return { user: userEvent.setup(), onClose };
}

function outbox(over: Partial<OutboxCheckin> = {}): OutboxCheckin {
  return {
    path: 'outbox',
    isOffline: true,
    policyEnabled: true,
    asOf: '2026-11-27T08:00:00Z',
    search: vi.fn(async (q: string) => (q.toLowerCase().includes('sara') ? [cachedMember] : [])),
    record: vi.fn(async () => ({ ok: true as const, event: {} as never })),
    afterRecord: vi.fn(),
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe('Manual Check-in modal — offline outbox path (Amendment 4)', () => {
  it('offline: searches the cached list, records via the outbox ("now", gym entry), says it will sync', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ob = outbox();
    const { user, onClose } = setup(ob);
    expect(screen.getByText(/Searching the saved member list/)).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/search/i), 'sara');
    await user.click(await screen.findByText('Sara Cached'));
    await user.click(screen.getByRole('button', { name: 'Log Check-in' }));
    expect(ob.record).toHaveBeenCalledWith({ member_id: 'm-cached', branch_id: 'b1', class_session_id: null });
    expect(toast.success).toHaveBeenCalledWith('Saved on this device — will sync when back online');
    expect(ob.afterRecord).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled(); // never the online endpoint
  });

  it('a local refusal is shown (e.g. double tap) and the modal stays open', async () => {
    const ob = outbox({ record: vi.fn(async () => ({ ok: false as const, reason: 'double_tap' as const })) });
    const { user, onClose } = setup(ob);
    await user.type(screen.getByPlaceholderText(/search/i), 'sara');
    await user.click(await screen.findByText('Sara Cached'));
    await user.click(screen.getByRole('button', { name: 'Log Check-in' }));
    expect(toast.error).toHaveBeenCalledWith(enAttendance.offline.results.double_tap);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offline with the gym policy off: explains and the save button is disabled', async () => {
    setup(outbox({ policyEnabled: false }));
    expect(screen.getByText(/Offline check-in is turned off for this gym/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log Check-in' })).toBeDisabled();
  });

  it('online + policy enabled: same outbox path, "syncing now" message', async () => {
    const ob = outbox({ isOffline: false });
    const { user } = setup(ob);
    await user.type(screen.getByPlaceholderText(/search/i), 'sara');
    await user.click(await screen.findByText('Sara Cached'));
    await user.click(screen.getByRole('button', { name: 'Log Check-in' }));
    expect(toast.success).toHaveBeenCalledWith('Saved — syncing now');
  });

  it('online + policy off (legacy path): unchanged — props member list, POST /api/attendance, no outbox', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'att-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const ob = outbox({ path: 'legacy', isOffline: false, policyEnabled: false });
    const { user } = setup(ob);
    await user.click(screen.getByText('Omar Online'));
    await user.click(screen.getByRole('button', { name: 'Log Check-in' }));
    expect(ob.record).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/attendance', expect.objectContaining({ method: 'POST' }));
  });
});
