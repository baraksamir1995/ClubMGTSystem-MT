/**
 * Gym timezone — loaded from settings or defaulted.
 * Set once at app init via setGymTimezone().
 */
let _gymTimezone = 'Africa/Cairo'; // Default — overridden by gym settings

export function setGymTimezone(tz: string) {
  _gymTimezone = tz;
}

export function getGymTimezone(): string {
  return _gymTimezone;
}

/**
 * Convert a "HH:MM" or "HH:MM:SS" time string to 12-hour format with AM/PM.
 * e.g. "09:00" → "9:00 AM", "14:30" → "2:30 PM"
 */
export function fmt12(time: string | null | undefined): string {
  if (!time) return '';
  const [hStr, mStr] = time.slice(0, 5).split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m} ${period}`;
}

/**
 * Normalise a Postgres/ISO timestamp so JS Date parses the timezone correctly.
 * Handles:
 *   "2026-04-15 16:53:18+00"     → "2026-04-15T16:53:18+00:00"
 *   "2026-04-15T16:53:18.000000Z" → works as-is
 *   "2026-04-15 16:53:18"         → treated as UTC by appending Z
 */
export function parsePgTimestamp(pg: string): Date {
  let s = pg.replace(' ', 'T');
  // Fix short timezone offset: +00 → +00:00
  s = s.replace(/([+-])(\d{2})$/, '$1$2:00');
  // If no timezone info at the end, assume UTC. The check is anchored so that
  // hyphens inside the date (e.g. "2026-04-15") don't falsely satisfy it.
  if (!/(Z|[+-]\d{2}(:\d{2})?)$/.test(s)) s += 'Z';
  return new Date(s);
}

/**
 * Format a Date or ISO string's time portion as 12-hour with AM/PM.
 * Always uses the gym's timezone for consistency.
 */
export function fmtTime12(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parsePgTimestamp(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: _gymTimezone,
  });
}

/**
 * Format a Date or ISO string as a short date in the gym's timezone.
 * e.g. "15 Apr 2026"
 */
export function fmtDateGym(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parsePgTimestamp(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: _gymTimezone,
  });
}

/**
 * Format a Date or ISO string as date + time in the gym's timezone.
 */
export function fmtDateTimeGym(date: Date | string | null | undefined): string {
  if (!date) return '';
  return `${fmtDateGym(date)} ${fmtTime12(date)}`;
}
