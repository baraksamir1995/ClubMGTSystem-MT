/**
 * QR decoding for the staff scanner: native `BarcodeDetector` where the browser
 * has it with `qr_code` support (Chrome/Edge/Android), else `jsqr` (pure JS,
 * loaded on demand) on a canvas frame. All decoding is local; no frames leave
 * the device.
 */

export interface QrDecoder {
  name: 'barcode-detector' | 'jsqr';
  decode(video: HTMLVideoElement): Promise<string | null>;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorCtor {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

export async function nativeQrSupported(g: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): Promise<boolean> {
  const Ctor = g.BarcodeDetector as BarcodeDetectorCtor | undefined;
  if (typeof Ctor !== 'function') return false;
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? [];
    return formats.includes('qr_code');
  } catch {
    return false;
  }
}

export async function createQrDecoder(): Promise<QrDecoder> {
  if (await nativeQrSupported()) {
    const Ctor = (globalThis as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ['qr_code'] });
    return {
      name: 'barcode-detector',
      async decode(video) {
        if (video.readyState < 2) return null;
        const found = await detector.detect(video);
        return found[0]?.rawValue ?? null;
      },
    };
  }
  const jsQR = (await import('jsqr')).default;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return {
    name: 'jsqr',
    async decode(video) {
      if (!ctx || video.readyState < 2 || !video.videoWidth) return null;
      // downscale large frames: faster, still plenty for a phone-screen QR
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      return code?.data ?? null;
    },
  };
}
