import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import EventModal from '@/components/events/event-modal';
import type { GymEvent } from '@/lib/types/store-events';
import enEvents from '@/messages/en/events.json';
import arEvents from '@/messages/ar/events.json';
import enCommon from '@/messages/en/common.json';
import arCommon from '@/messages/ar/common.json';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const baseEvent: GymEvent = {
  id: 'e1', title: 'Open mat', description: null, location: null,
  image_url: 'https://cdn.test/old.jpg',
  starts_at: '2030-01-10T18:00:00Z', ends_at: null, registration_deadline: null,
  capacity: null, is_paid: false, price_cents: null, currency: 'EGP', is_published: true,
  configuration_label: null, configurations: [], plan_targets: [],
  registrations_count: 0, pending_count: 0, attended_count: 0,
};

function setup(event: GymEvent | null, locale: 'en' | 'ar' = 'en') {
  const messages = locale === 'ar'
    ? { events: arEvents, common: arCommon }
    : { events: enEvents, common: enCommon };
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={messages as never} timeZone="UTC">
      <EventModal event={event} plans={[]} onClose={() => {}} onSaved={onSaved} />
    </NextIntlClientProvider>,
  );
  return { onSaved };
}

const preview = () => screen.getByTestId('event-cover-preview');
const pickFile = (file: File) =>
  fireEvent.change(screen.getByTestId('event-cover-input'), { target: { files: [file] } });

describe('EventModal cover image', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the placeholder and an Upload button when there is no image', () => {
    setup({ ...baseEvent, image_url: null });
    expect(preview().querySelector('img')).toBeNull();
    expect(preview()).toHaveTextContent('No image');
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('previews the existing image with Replace and Remove', () => {
    setup(baseEvent);
    expect(preview().querySelector('img')).toHaveAttribute('src', 'https://cdn.test/old.jpg');
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('uploads a picked image, previews it, and saves its URL', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/events/image') {
        return new Response(JSON.stringify({ url: 'https://cdn.test/new.jpg' }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'ok' }), { status: 200 });
    });
    const { onSaved } = setup(baseEvent);

    pickFile(new File(['x'], 'cover.png', { type: 'image/png' }));
    await waitFor(() =>
      expect(preview().querySelector('img')).toHaveAttribute('src', 'https://cdn.test/new.jpg'));
    expect(fetchMock).toHaveBeenCalledWith('/api/events/image', expect.objectContaining({ method: 'POST' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls.find(([u]) => u === '/api/events/e1')!;
    expect(JSON.parse(init.body).image_url).toBe('https://cdn.test/new.jpg');
  });

  it('Remove clears the image and saves null', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));
    const { onSaved } = setup(baseEvent);

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(preview().querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).image_url).toBeNull();
  });

  it('rejects non-image files without uploading', () => {
    setup(baseEvent);
    pickFile(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(preview().querySelector('img')).toHaveAttribute('src', 'https://cdn.test/old.jpg');
  });

  it('renders the Arabic strings', () => {
    setup({ ...baseEvent, image_url: null }, 'ar');
    expect(screen.getByText(arEvents.modal.cover)).toBeInTheDocument();
    expect(screen.getByText(arEvents.modal.coverHint)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: arEvents.modal.uploadImage })).toBeInTheDocument();
  });
});
