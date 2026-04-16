/**
 * Shared file upload validation for gym-admin API routes.
 *
 * Security notes:
 *  - We validate `file.type` (the MIME reported by the browser) AND derive the
 *    extension from that MIME — never from `file.name`, which is fully attacker-
 *    controlled.  A client can rename `malware.html` to `logo.jpg` but cannot
 *    change the browser-negotiated Content-Type when the server enforces it here.
 *  - Storage should also enforce a MIME allowlist that mirrors this map.
 */

export const IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export type ValidationResult =
  | { ok: true;  ext: string }
  | { ok: false; error: string; status: 400 };

/**
 * Validate that `file` is an allowed image type within the size limit.
 * Returns `{ ok: true, ext }` on success or `{ ok: false, error, status }` on failure.
 */
export function validateImageUpload(
  file: File | null,
  allowedMimes: Record<string, string> = IMAGE_MIME_TO_EXT,
  maxBytes: number = MAX_IMAGE_BYTES,
): ValidationResult {
  if (!file) {
    return { ok: false, error: 'No file provided', status: 400 };
  }

  const ext = allowedMimes[file.type];
  if (!ext) {
    const allowed = Object.keys(allowedMimes).join(', ');
    return {
      ok: false,
      error: `Invalid file type "${file.type}". Allowed types: ${allowed}`,
      status: 400,
    };
  }

  if (file.size > maxBytes) {
    const limitMb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `File exceeds the ${limitMb} MB size limit`, status: 400 };
  }

  return { ok: true, ext };
}
