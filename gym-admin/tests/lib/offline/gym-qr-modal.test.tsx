import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enAttendance from '@/messages/en/attendance.json';
import enCommon from '@/messages/en/common.json';

import GymQRModal from '@/components/attendance/gym-qr-modal';

const BRANCH = { id: 'b0b0b0b0-1111-4222-8333-444444444444', name: 'Downtown' } as never;

function setup() {
  render(
    <NextIntlClientProvider locale="en" messages={{ attendance: enAttendance, common: enCommon } as never} timeZone="UTC">
      <GymQRModal gymId="g1" branches={[BRANCH]} onClose={() => undefined} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('GymQRModal (PHASE3 §5)', () => {
  it('shows the signed v2 static QR with "valid until"; the v1 token is not fetched', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('/qr?mode=static')
        ? new Response(JSON.stringify({ qr: '{"type":"gym_access","v":2}', mode: 'static', expires_at: '2027-11-27T00:00:00Z', kid: 'k1' }), { status: 200 })
        : new Response(JSON.stringify({ qr_token: 'v1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    setup();
    expect(await screen.findByText('Valid until November 27, 2027')).toBeInTheDocument();
    expect(screen.getByText(/Signed QR/)).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load the signed QR/)).toBeNull();
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual([`/api/branches/${(BRANCH as { id: string }).id}/qr?mode=static`]);
    expect(screen.queryByText(/kiosk/i)).toBeNull();
  });

  it('a fixed QR valid for years says it stays the same until Regenerate (no "Valid until")', async () => {
    const tenYears = new Date(Date.now() + 3650 * 86_400_000).toISOString();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ qr: '{"type":"gym_access","v":2}', mode: 'static', expires_at: tenYears, kid: 'k1' }), { status: 200 })),
    );
    setup();
    expect(await screen.findByText(/stays the same until you press Regenerate/)).toBeInTheDocument();
    expect(screen.queryByText(/Valid until/)).toBeNull();
  });

  it('falls back to the v1 QR with a note when the signed endpoint fails', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('/qr?mode=static')
        ? new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
        : new Response(JSON.stringify({ qr_token: 'v1-token' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    setup();
    expect(await screen.findByText(/Couldn't load the signed QR/)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.map((c) => String(c[0]))).toContain(`/api/branches/${(BRANCH as { id: string }).id}/qr-token`));
    expect(screen.queryByText(/Valid until/)).toBeNull();
  });

  it('network failure on the signed endpoint also falls back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/qr?mode=static')) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify({ qr_token: 't' }), { status: 200 });
      }),
    );
    setup();
    expect(await screen.findByText(/Couldn't load the signed QR/)).toBeInTheDocument();
  });
});
