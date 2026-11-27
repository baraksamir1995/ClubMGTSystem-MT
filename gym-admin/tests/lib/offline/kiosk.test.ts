import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB } from 'idb';
import { freshIndexedDb, openTestDb, putRows, row, GYM, USER } from './helpers';
import {
  KIOSK_EARLY_TOLERANCE_MS,
  KIOSK_REFRESH_MS,
  KIOSK_RETRY_MS,
  KIOSK_WARN_MS,
  downloadKioskBatch,
  kioskStatus,
  parseRotatingBatch,
  shouldAttemptRefresh,
  shouldRefreshBatch,
} from '@/lib/offline/kiosk';
import {
  DB_VERSION,
  dbNameFor,
  getKioskBatch,
  getMeta,
  listOutbox,
  openOfflineDb,
  putKioskBatch,
  replaceSnapshot,
  wipeCache,
  type OfflineDB,
} from '@/lib/offline/db';
import { clearServerClockAnchor, estimateServerNow, type TimeSource } from '@/lib/offline/server-clock';
import type { KioskBatch, RotatingToken } from '@/lib/offline/types';

const BRANCH = 'b0b0b0b0-1111-4222-8333-444444444444';
const T0 = 1_795_000_000; // unix s, start of the batch
const HOUR_S = 3600;

/** n consecutive 60 s tokens starting at `start` (unix s). */
function tokens(n: number, start = T0): RotatingToken[] {
  return Array.from({ length: n }, (_, i) => ({ qr: `QR-${i}`, iat: start + i * 60, exp: start + (i + 1) * 60 }));
}
const batchOf = (n: number, start = T0) => ({ tokens: tokens(n, start) });
const ms = (s: number) => s * 1000;

describe('kioskStatus: token selection', () => {
  const b = batchOf(12 * 60); // 12 h

  it('picks the token whose [iat, exp) contains now, across boundaries', () => {
    expect(kioskStatus(b, ms(T0)).token?.qr).toBe('QR-0');
    expect(kioskStatus(b, ms(T0 + 59) + 999).token?.qr).toBe('QR-0');
    expect(kioskStatus(b, ms(T0 + 60)).token?.qr).toBe('QR-1');
    expect(kioskStatus(b, ms(T0 + 61 * 60 + 30)).token?.qr).toBe('QR-61');
  });

  it('countdown to the next code and remaining batch time', () => {
    const s = kioskStatus(b, ms(T0 + 15));
    expect(s.msToNext).toBe(45_000);
    expect(s.remainingMs).toBe(ms(12 * HOUR_S - 15));
    expect(s.endsAtMs).toBe(ms(T0 + 12 * HOUR_S));
  });

  it('shows the first code slightly early (≤ tolerance), not earlier', () => {
    expect(kioskStatus(b, ms(T0) - KIOSK_EARLY_TOLERANCE_MS).token?.qr).toBe('QR-0');
    expect(kioskStatus(b, ms(T0) - KIOSK_EARLY_TOLERANCE_MS - 1)).toMatchObject({ phase: 'not_started', token: null });
  });

  it('exhausted at/after the last exp; empty without a batch', () => {
    expect(kioskStatus(b, ms(T0 + 12 * HOUR_S))).toMatchObject({ phase: 'exhausted', token: null, remainingMs: 0 });
    expect(kioskStatus(null, ms(T0))).toMatchObject({ phase: 'empty', token: null, endsAtMs: null });
    expect(kioskStatus({ tokens: [] }, ms(T0))).toMatchObject({ phase: 'empty' });
  });

  it('warns under 1 h left (contract), ok at exactly 1 h', () => {
    const end = T0 + 12 * HOUR_S;
    expect(kioskStatus(b, ms(end) - KIOSK_WARN_MS).phase).toBe('ok');
    expect(kioskStatus(b, ms(end) - KIOSK_WARN_MS + 1).phase).toBe('low');
    expect(kioskStatus(b, ms(end) - 1)).toMatchObject({ phase: 'low', token: { qr: `QR-${12 * 60 - 1}` } });
  });

  it('a gap in the batch shows nothing until the next code is within the tolerance', () => {
    const gappy = { tokens: [...tokens(2, T0), ...tokens(2, T0 + 600)] };
    expect(kioskStatus(gappy, ms(T0 + 300))).toMatchObject({ phase: 'not_started', token: null });
    expect(kioskStatus(gappy, ms(T0 + 600) - 30_000).token?.qr).toBe('QR-0');
  });
});

describe('refresh scheduling', () => {
  const b = batchOf(12 * 60);
  const end = ms(T0 + 12 * HOUR_S);

  it('refreshes only when online and < 6 h left (or nothing to show)', () => {
    expect(shouldRefreshBatch(kioskStatus(b, end - KIOSK_REFRESH_MS), true)).toBe(false);
    expect(shouldRefreshBatch(kioskStatus(b, end - KIOSK_REFRESH_MS + 1), true)).toBe(true);
    expect(shouldRefreshBatch(kioskStatus(b, end - KIOSK_REFRESH_MS + 1), false)).toBe(false);
    expect(shouldRefreshBatch(kioskStatus(null, 0), true)).toBe(true);
    expect(shouldRefreshBatch(kioskStatus(b, end), true)).toBe(true);
    expect(shouldRefreshBatch(kioskStatus(b, end), false)).toBe(false);
  });

  it('automatic attempts are throttled (5 min) so a failing server is not hammered', () => {
    const st = kioskStatus(null, 0);
    expect(shouldAttemptRefresh(st, true, null, 1_000)).toBe(true);
    expect(shouldAttemptRefresh(st, true, 1_000, 1_000 + KIOSK_RETRY_MS - 1)).toBe(false);
    expect(shouldAttemptRefresh(st, true, 1_000, 1_000 + KIOSK_RETRY_MS)).toBe(true);
    expect(shouldAttemptRefresh(st, false, null, 1_000)).toBe(false);
  });
});

describe('parseRotatingBatch', () => {
  it('keeps well-formed tokens, sorted; rejects unusable bodies', () => {
    const p = parseRotatingBatch({
      kid: 'k1',
      generated_at: '2026-11-27T10:00:00Z',
      tokens: [
        { qr: 'B', iat: 160, exp: 220 },
        { qr: 'A', iat: 100, exp: 160 },
        { qr: '', iat: 1, exp: 2 },
        { qr: 'bad', iat: 5.5, exp: 9 },
        { qr: 'neg', iat: 10, exp: 10 },
        null,
      ],
    });
    expect(p?.tokens.map((t) => t.qr)).toEqual(['A', 'B']);
    expect(parseRotatingBatch({ kid: 'k', generated_at: 'x', tokens: [] })).toBeNull();
    expect(parseRotatingBatch({ tokens: [{ qr: 'A', iat: 1, exp: 2 }] })).toBeNull();
    expect(parseRotatingBatch(null)).toBeNull();
  });
});

describe('downloadKioskBatch + monotonic clock', () => {
  let db: OfflineDB;
  beforeEach(async () => {
    freshIndexedDb();
    db = await openTestDb();
  });

  const body = (start = T0) => ({ kid: 'k1', generated_at: new Date(ms(start)).toISOString(), tokens: tokens(12 * 60, start) });
  const ok = (b: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(b), { status: 200 }));

  it('stores the batch per (user DB, branch) and calls the capped same-origin proxy', async () => {
    const fetchImpl = ok(body());
    const res = await downloadKioskBatch(db, { id: BRANCH, name: 'Main' }, { fetchImpl, hours: 99, now: () => ms(T0), monoNow: () => 0 });
    expect(res.ok).toBe(true);
    expect(String(fetchImpl.mock.calls[0][0])).toBe(`/api/branches/${BRANCH}/qr/rotating-batch?hours=24`);
    const stored = await getKioskBatch(db, BRANCH);
    expect(stored).toMatchObject({ branch_id: BRANCH, branch_name: 'Main', kid: 'k1', stored_at: ms(T0) });
    expect(stored?.tokens).toHaveLength(720);
    expect(await getMeta(db, 'server_clock_offset_ms')).toBe(0);
  });

  it('clock changed AFTER the download: the kiosk still shows the right code (monotonic anchor)', async () => {
    let wall = ms(T0);
    let mono = 5_000;
    const time: TimeSource = { wallNow: () => wall, monoNow: () => mono };
    await downloadKioskBatch(db, { id: BRANCH, name: 'Main' }, { fetchImpl: ok(body()), now: () => wall, monoNow: () => mono });
    const batch = (await getKioskBatch(db, BRANCH))!;

    // 90 s pass; someone moves the device clock +1 h
    mono += 90_000;
    wall += 90_000 + 3_600_000;
    const est = await estimateServerNow(db, time);
    expect(est.source).toBe('anchor');
    expect(kioskStatus(batch, est.serverNowMs!).token?.qr).toBe('QR-1');
    // naive wall-clock selection would be an hour off
    expect(kioskStatus(batch, wall).token?.qr).toBe('QR-61');

    // …and −2 days
    wall = ms(T0) - 2 * 86_400_000;
    expect(kioskStatus(batch, (await estimateServerNow(db, time)).serverNowMs!).token?.qr).toBe('QR-1');
  });

  it('after a reload (no anchor) it falls back to the persisted offset', async () => {
    // device 10 min fast at download time
    await downloadKioskBatch(db, { id: BRANCH, name: 'Main' }, { fetchImpl: ok(body()), now: () => ms(T0) + 600_000, monoNow: () => 0 });
    clearServerClockAnchor(db);
    const time: TimeSource = { wallNow: () => ms(T0) + 600_000 + 120_000, monoNow: () => 0 };
    const est = await estimateServerNow(db, time);
    expect(est.source).toBe('persisted_offset');
    expect(kioskStatus((await getKioskBatch(db, BRANCH))!, est.serverNowMs!).token?.qr).toBe('QR-2');
  });

  it('401 / 403 / redirect / invalid body never replace the stored batch', async () => {
    const good: KioskBatch = { branch_id: BRANCH, branch_name: 'Main', kid: 'k0', generated_at: 'x', stored_at: 1, tokens: tokens(3) };
    await putKioskBatch(db, good);
    const r401 = await downloadKioskBatch(db, { id: BRANCH, name: 'Main' }, { fetchImpl: ok({}).mockResolvedValue(new Response('{}', { status: 401 })) });
    expect(r401).toMatchObject({ ok: false, reason: 'auth_required' });
    const r403 = await downloadKioskBatch(db, { id: BRANCH, name: 'Main' }, { fetchImpl: ok({}).mockResolvedValue(new Response('{}', { status: 403 })) });
    expect(r403).toMatchObject({ ok: false, reason: 'forbidden' });
    const r307 = await downloadKioskBatch(db, { id: BRANCH, name: 'Main' }, { fetchImpl: ok({}).mockResolvedValue(new Response(null, { status: 307, headers: { location: '/login' } })) });
    expect(r307).toMatchObject({ ok: false, reason: 'auth_required' });
    const bad = await downloadKioskBatch(db, { id: BRANCH, name: 'Main' }, { fetchImpl: ok({ tokens: 'nope' }) });
    expect(bad).toMatchObject({ ok: false, reason: 'invalid_response' });
    const net = await downloadKioskBatch(db, { id: BRANCH, name: 'Main' }, { fetchImpl: vi.fn().mockRejectedValue(new TypeError('offline')) });
    expect(net).toMatchObject({ ok: false, reason: 'network' });
    expect(await getKioskBatch(db, BRANCH)).toEqual(good);
  });

  it('a bootstrap snapshot replace keeps kiosk batches; logout wipe removes them', async () => {
    await putKioskBatch(db, { branch_id: BRANCH, branch_name: 'Main', kid: 'k', generated_at: 'x', stored_at: 1, tokens: tokens(1) });
    await replaceSnapshot(db, { members: [], memberships: [], branches: [], class_sessions: [], recent_attendance: [], meta: {} });
    expect(await getKioskBatch(db, BRANCH)).toBeDefined();
    await wipeCache(db);
    expect(await getKioskBatch(db, BRANCH)).toBeUndefined();
  });
});

describe('offline DB v1 → v2 upgrade', () => {
  beforeEach(() => freshIndexedDb());

  it('adds kiosk_batches and keeps existing outbox rows', async () => {
    const name = dbNameFor(GYM, USER);
    // a v1 database as Phase 1/2 created it (relevant stores only)
    const v1 = await openDB(name, 1, {
      upgrade(d) {
        d.createObjectStore('meta');
        const o = d.createObjectStore('outbox', { keyPath: 'event_id' });
        o.createIndex('sync_status', 'sync_status');
      },
    });
    await v1.put('outbox', row({ event_id: 'kept' }));
    v1.close();

    const db = await openOfflineDb(GYM, USER);
    expect(DB_VERSION).toBe(2);
    expect(db.version).toBe(2);
    expect([...db.objectStoreNames]).toContain('kiosk_batches');
    expect((await listOutbox(db)).map((r) => r.event_id)).toEqual(['kept']);
    db.close();
  });

  it('pending events survive alongside kiosk data', async () => {
    const db = await openTestDb();
    await putRows(db, [row({ event_id: 'p1' })]);
    await putKioskBatch(db, { branch_id: BRANCH, branch_name: null, kid: 'k', generated_at: 'x', stored_at: 1, tokens: tokens(1) });
    expect(await db.count('outbox')).toBe(1);
  });
});
