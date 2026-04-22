import { describe, it, expect, beforeEach } from 'vitest';
import {
  fmt12,
  parsePgTimestamp,
  fmtTime12,
  fmtDateGym,
  fmtDateTimeGym,
  setGymTimezone,
  getGymTimezone,
} from '@/lib/time';

beforeEach(() => setGymTimezone('Africa/Cairo'));

describe('fmt12', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(fmt12(null)).toBe('');
    expect(fmt12(undefined)).toBe('');
    expect(fmt12('')).toBe('');
  });

  it('formats morning times', () => {
    expect(fmt12('09:00')).toBe('9:00 AM');
    expect(fmt12('00:30')).toBe('12:30 AM');
  });

  it('formats noon and midnight boundaries', () => {
    expect(fmt12('12:00')).toBe('12:00 PM');
    expect(fmt12('00:00')).toBe('12:00 AM');
  });

  it('formats evening times', () => {
    expect(fmt12('14:30')).toBe('2:30 PM');
    expect(fmt12('23:59')).toBe('11:59 PM');
  });

  it('ignores seconds portion of HH:MM:SS', () => {
    expect(fmt12('08:15:42')).toBe('8:15 AM');
  });
});

describe('parsePgTimestamp', () => {
  it('parses ISO string with Z suffix', () => {
    const d = parsePgTimestamp('2026-04-15T16:53:18.000000Z');
    expect(d.toISOString()).toBe('2026-04-15T16:53:18.000Z');
  });

  it('normalises space separator and short timezone offset', () => {
    const d = parsePgTimestamp('2026-04-15 16:53:18+00');
    expect(d.toISOString()).toBe('2026-04-15T16:53:18.000Z');
  });

  it('assumes UTC when no timezone info present', () => {
    const d = parsePgTimestamp('2026-04-15 16:53:18');
    expect(d.toISOString()).toBe('2026-04-15T16:53:18.000Z');
  });

  it('handles +02:00 style offset correctly', () => {
    const d = parsePgTimestamp('2026-04-15 18:53:18+02:00');
    expect(d.toISOString()).toBe('2026-04-15T16:53:18.000Z');
  });
});

describe('getGymTimezone / setGymTimezone', () => {
  it('defaults to Africa/Cairo', () => {
    expect(getGymTimezone()).toBe('Africa/Cairo');
  });

  it('setGymTimezone updates the value', () => {
    setGymTimezone('UTC');
    expect(getGymTimezone()).toBe('UTC');
  });
});

describe('fmtTime12 / fmtDateGym / fmtDateTimeGym', () => {
  it('returns empty string for null/undefined', () => {
    expect(fmtTime12(null)).toBe('');
    expect(fmtDateGym(undefined)).toBe('');
    expect(fmtDateTimeGym(null)).toBe('');
  });

  it('formats a UTC ISO into Africa/Cairo time', () => {
    const iso = '2026-04-15T12:00:00Z';
    // Cairo is UTC+2 in April 2026 (no DST), so 12:00 UTC → 2:00 PM
    expect(fmtTime12(iso)).toMatch(/2:00\s?PM/);
  });

  it('formats date in en-GB short format', () => {
    const iso = '2026-04-15T12:00:00Z';
    expect(fmtDateGym(iso)).toBe('15 Apr 2026');
  });

  it('combines date and time', () => {
    const iso = '2026-04-15T12:00:00Z';
    const combined = fmtDateTimeGym(iso);
    expect(combined).toContain('15 Apr 2026');
    expect(combined).toMatch(/2:00\s?PM/);
  });

  it('respects current timezone setting', () => {
    setGymTimezone('UTC');
    const iso = '2026-04-15T12:00:00Z';
    expect(fmtTime12(iso)).toMatch(/12:00\s?PM/);
  });
});
