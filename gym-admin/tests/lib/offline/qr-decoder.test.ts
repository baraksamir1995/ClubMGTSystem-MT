import { describe, it, expect } from 'vitest';
import { nativeQrSupported } from '@/lib/offline/qr-decoder';
import { todaysSessions } from '@/components/attendance/front-desk/manual-checkin';

describe('QR decoder selection', () => {
  it('uses BarcodeDetector only when it supports qr_code', async () => {
    expect(await nativeQrSupported({})).toBe(false);
    class WithQr { static getSupportedFormats = async () => ['ean_13', 'qr_code']; }
    class WithoutQr { static getSupportedFormats = async () => ['ean_13']; }
    class Broken { static getSupportedFormats = async () => { throw new Error('x'); }; }
    expect(await nativeQrSupported({ BarcodeDetector: WithQr })).toBe(true);
    expect(await nativeQrSupported({ BarcodeDetector: WithoutQr })).toBe(false);
    expect(await nativeQrSupported({ BarcodeDetector: Broken })).toBe(false);
  });

  it('jsqr fallback module loads and decodes nothing from a blank frame', async () => {
    const jsQR = (await import('jsqr')).default;
    expect(jsQR(new Uint8ClampedArray(4 * 20 * 20), 20, 20)).toBeNull();
  });
});

describe("manual check-in: today's cached sessions", () => {
  it('keeps only sessions starting on the device-local day', () => {
    const now = new Date(2026, 10, 26, 12, 0, 0);
    const s = (id: string, d: Date) => ({ id, class_id: null, name: id, branch_id: null, studio_id: null, starts_at: d.toISOString(), ends_at: null });
    const list = [
      s('yesterday', new Date(2026, 10, 25, 23, 0)),
      s('morning', new Date(2026, 10, 26, 7, 0)),
      s('night', new Date(2026, 10, 26, 23, 30)),
      s('tomorrow', new Date(2026, 10, 27, 0, 0)),
    ];
    expect(todaysSessions(list, now).map((x) => x.id)).toEqual(['morning', 'night']);
  });
});
