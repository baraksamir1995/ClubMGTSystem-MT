/**
 * Client-side API error → user-facing message.
 *
 * The API proxy routes forward Laravel's descriptive `{ error }` / `{ message }`
 * to the browser, but on unhandled exceptions Laravel returns literal
 * "Server Error" (or an HTML error page), and fetch failures surface as
 * "Failed to fetch". None of that should ever reach a toast.
 *
 * Usage in a component (with next-intl):
 *
 *   const tErr = useTranslations('common.errors');
 *   ...
 *   const res = await apiFetch('/api/classes', { method: 'POST', body });
 *   const json = await res.json().catch(() => null);
 *   if (!res.ok) {
 *     toast.error(apiErrorMessage(json, res.status, tErr));
 *     return;
 *   }
 *
 * `apiErrorMessage` prefers the server's descriptive message when it is safe
 * to show (not an internal/raw error), otherwise falls back to a translated
 * message keyed off the HTTP status.
 */

/** Translator signature compatible with next-intl's useTranslations(). */
type Translate = (key: string) => string;

/** English fallbacks for contexts without a translator (mirrors common.errors). */
const EN_FALLBACKS: Record<string, string> = {
  badRequest: 'The request could not be processed. Please check your input and try again.',
  sessionExpired: 'Your session has expired. Please log in again.',
  noPermission: 'You do not have permission to perform this action.',
  notFound: 'The requested item could not be found. It may have been deleted.',
  conflict: 'This conflicts with an existing record. Please refresh and try again.',
  validation: 'Some fields are invalid. Please review your input and try again.',
  tooManyRequests: 'Too many requests. Please wait a moment and try again.',
  serverError: 'Something went wrong on our end. Please try again in a moment.',
  network: 'Could not reach the server. Please check your connection and try again.',
  unknown: 'Something went wrong. Please try again.',
};

/** Map an HTTP status to a common.errors translation key. */
export function statusErrorKey(status: number): string {
  if (status === 400) return 'badRequest';
  if (status === 401) return 'sessionExpired';
  if (status === 403) return 'noPermission';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 429) return 'tooManyRequests';
  if (status >= 500) return 'serverError';
  return 'unknown';
}

/**
 * Raw/internal messages that must never be shown to the user.
 * Anything matching these gets replaced by the status-based fallback.
 */
const UNSAFE_PATTERNS = [
  /^server error\.?$/i,          // Laravel's default 500 message
  /^internal server error/i,
  /an internal error occurred/i, // our own sanitize-error generic
  /sqlstate/i,
  /exception/i,
  /stack trace/i,
  /^<!doctype/i,
  /<html/i,
  /failed to fetch/i,
  /networkerror/i,
  /unexpected token/i,           // JSON parse errors
  /unexpected end of json/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /call to undefined/i,
  /undefined (method|property|index|variable)/i,
  /^error$/i,
  /^unknown error/i,
];

/** True when a server-provided message is descriptive AND safe to display. */
export function isDisplayableMessage(msg: unknown): msg is string {
  if (typeof msg !== 'string') return false;
  const trimmed = msg.trim();
  if (trimmed.length < 4 || trimmed.length > 200) return false;
  return !UNSAFE_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * Extract the most descriptive safe message from a parsed error body:
 * `{ error }`, `{ message }`, or the first entry of a Laravel 422 `errors` bag.
 * Returns null when nothing displayable is present.
 */
export function extractServerMessage(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as Record<string, unknown>;

  // Laravel validation bag: { errors: { field: ["msg", ...] } } — most specific.
  if (body.errors && typeof body.errors === 'object') {
    const first = Object.values(body.errors as Record<string, unknown>)[0];
    const msg = Array.isArray(first) ? first[0] : first;
    if (isDisplayableMessage(msg)) return msg;
  }
  if (isDisplayableMessage(body.error)) return body.error;
  if (isDisplayableMessage(body.message)) return body.message;
  return null;
}

/**
 * Build the message to show the user for a failed API response.
 *
 * @param json    Parsed response body (or null if parsing failed)
 * @param status  HTTP status of the response
 * @param t       Optional translator scoped to `common.errors`
 */
export function apiErrorMessage(json: unknown, status: number, t?: Translate): string {
  const server = extractServerMessage(json);
  if (server) return server;
  const key = statusErrorKey(status);
  if (t) {
    try { return t(key); } catch { /* missing key — fall through */ }
  }
  return EN_FALLBACKS[key] ?? EN_FALLBACKS.unknown;
}

/**
 * Message for a thrown fetch error (network down, CORS, aborted).
 * Never shows the raw error — always the friendly network message.
 */
export function networkErrorMessage(t?: Translate): string {
  if (t) {
    try { return t('network'); } catch { /* missing key — fall through */ }
  }
  return EN_FALLBACKS.network;
}

/**
 * One-call helper: parse the response body and return a user-facing error
 * message for a non-OK response.
 *
 *   if (!res.ok) { toast.error(await responseErrorMessage(res, tErr)); return; }
 */
export async function responseErrorMessage(res: Response, t?: Translate): Promise<string> {
  const json = await res.json().catch(() => null);
  return apiErrorMessage(json, res.status, t);
}
