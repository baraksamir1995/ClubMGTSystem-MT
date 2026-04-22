import { describe, it, expect } from 'vitest';
import {
  validateImageUpload,
  IMAGE_MIME_TO_EXT,
  MAX_IMAGE_BYTES,
} from '@/lib/upload-validation';

function makeFile(opts: { type: string; size?: number; name?: string }): File {
  const body = new Uint8Array(opts.size ?? 1024);
  return new File([body], opts.name ?? 'upload.bin', { type: opts.type });
}

describe('validateImageUpload', () => {
  it('rejects a null file', () => {
    const result = validateImageUpload(null);
    expect(result).toEqual({ ok: false, error: 'No file provided', status: 400 });
  });

  it('accepts each allowed MIME and returns the correct extension', () => {
    for (const [mime, ext] of Object.entries(IMAGE_MIME_TO_EXT)) {
      const file = makeFile({ type: mime, size: 1024 });
      const result = validateImageUpload(file);
      expect(result).toEqual({ ok: true, ext });
    }
  });

  it('rejects disallowed mime even if file.name ends with a valid extension', () => {
    const file = makeFile({ type: 'text/html', name: 'malware.jpg' });
    const result = validateImageUpload(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain('Invalid file type "text/html"');
    }
  });

  it('rejects files over the size limit', () => {
    const file = makeFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 });
    const result = validateImageUpload(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/5 MB size limit/);
    }
  });

  it('accepts file exactly at the byte limit', () => {
    const file = makeFile({ type: 'image/png', size: MAX_IMAGE_BYTES });
    const result = validateImageUpload(file);
    expect(result.ok).toBe(true);
  });

  it('respects a custom allowedMimes map', () => {
    const result = validateImageUpload(
      makeFile({ type: 'image/svg+xml' }),
      { 'image/svg+xml': 'svg' },
    );
    expect(result).toEqual({ ok: true, ext: 'svg' });
  });

  it('respects a custom maxBytes', () => {
    const file = makeFile({ type: 'image/jpeg', size: 2048 });
    const result = validateImageUpload(file, IMAGE_MIME_TO_EXT, 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/0 MB size limit/);
  });
});
