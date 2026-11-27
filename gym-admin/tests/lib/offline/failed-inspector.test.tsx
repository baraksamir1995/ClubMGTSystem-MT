import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { FailedInspector } from '@/components/attendance/front-desk/failed-inspector';
import enAttendance from '@/messages/en/attendance.json';
import arAttendance from '@/messages/ar/attendance.json';
import enCommon from '@/messages/en/common.json';
import arCommon from '@/messages/ar/common.json';
import type { OutboxRow, ReviewEvent } from '@/lib/offline/types';
import { row } from './helpers';

/** A row exactly as AttendanceOfflineController::events returns it (captured live on :8082). */
const serverRow: ReviewEvent = {
  event_id: 'f2d6d6ed-feb8-4fcf-aa8c-e10f83a3db6d',
  kind: 'attendance',
  method: 'staff_qr',
  result: 'rejected',
  code: 'qr_member_mismatch',
  message: 'The scanned pass belongs to another member.',
  flags: [],
  needs_review: false,
  attendance_id: null,
  service_log_id: null,
  attempts: 2,
  device_recorded_at: '2026-11-26T19:51:52.534Z',
  device_timezone: 'Africa/Cairo',
  server_received_at: '2026-11-26T19:51:52.559Z',
  processed_at: '2026-11-26T19:51:52.592Z',
  member: { gym_member_id: 'm-1', member_number: 42, full_name: 'Sara Ali' },
  actor: { user_id: 'u-1', type: 'gym_admin', full_name: 'Joe' },
  device: { device_id: 'd-1', label: 'admin web 0.1.0', platform: 'web', app: 'admin', app_version: '0.1.0' },
  branch_id: null,
  class_session_id: null,
  studio_id: null,
  service_assignment_id: null,
};

function setup(locale: 'en' | 'ar', localRejected: OutboxRow[] = []) {
  const messages = {
    attendance: locale === 'ar' ? arAttendance : enAttendance,
    common: locale === 'ar' ? arCommon : enCommon,
  } as never;
  render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <FailedInspector localRejected={localRejected} memberName={() => 'Local Member'} online />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
}

afterEach(() => vi.unstubAllGlobals());

describe('FailedInspector', () => {
  it('renders the real server row shape: nested member / actor / device and method; translated code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [serverRow], next_cursor: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = setup('en');
    await user.click(screen.getByRole('button', { name: 'Load from server' }));
    expect(await screen.findByText('Sara Ali')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('staff_qr')).toBeInTheDocument();
    expect(screen.getByText('The pass belongs to a different member.')).toBeInTheDocument();
    expect(screen.getByText(/By Joe/)).toBeInTheDocument();
    expect(screen.getByText(/Device admin web 0\.1\.0/)).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/attendance/offline/events?needs_review=1');
  });

  it('unknown server codes fall back to the server message; Arabic translation for known codes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ ...serverRow, code: 'some_store_code', message: 'Server says no.' }], next_cursor: null }), { status: 200 }),
      ),
    );
    const user = setup('en');
    await user.click(screen.getByRole('button', { name: 'Load from server' }));
    expect(await screen.findByText('Server says no.')).toBeInTheDocument();
  });

  it('local rejected rows show the translated reason (AR)', () => {
    setup('ar', [row({ event_id: 'r1', sync_status: 'rejected', result_code: 'membership_frozen', result_message: 'Membership is frozen.' })]);
    expect(screen.getByText('الاشتراك مجمّد.')).toBeInTheDocument();
  });
});
