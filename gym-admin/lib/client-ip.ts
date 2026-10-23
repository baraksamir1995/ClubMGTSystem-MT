/**
 * Client IP for rate limiting in route handlers.
 *
 * Everything in X-Forwarded-For before the last hop is client-supplied and
 * spoofable; the reverse proxy in front of this container (Traefik) appends
 * the address it actually saw. Keying limits on the first entry let a client
 * rotate a fake header for a fresh bucket on every request.
 */
export function clientIp(request: Request): string {
  const parts = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? request.headers.get('x-real-ip') ?? 'unknown';
}
