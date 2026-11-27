import { describe, it, expect, beforeAll } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  canonicalPassString,
  defaultVerifier,
  looksLikeMemberPass,
  nobleVerify,
  parseMemberPass,
  verifyMemberPass,
  type Ed25519Verifier,
  type VerifyPassContext,
} from '@/lib/offline/member-pass';
import type { CachedMember } from '@/lib/offline/types';
import { makeKey, passKey, signPass, type TestKey } from './pass-helpers';

const GYM = 'f59a895f-430e-46d7-ae1c-01602f4ec4fd';
const GYM2 = '0b0b0b0b-1111-4222-8333-444444444444';
const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const M404 = '40404040-4040-4040-8040-404040404040';
const NOW = Date.parse('2026-11-26T10:00:00Z');
const nowS = NOW / 1000;
const DAY = 86_400;

const member: CachedMember = {
  gym_member_id: M1, member_number: 7, full_name: 'Sara Ali', phone_last4: '1234', photo_url: null, status: 'active', name_lc: 'sara ali',
};

let active: TestKey;
let retired: TestKey;
let stranger: TestKey;

beforeAll(async () => {
  active = await makeKey('k-active');
  retired = await makeKey('k-old');
  stranger = await makeKey('k-active'); // same kid, different key → forged
});

function ctx(over: Partial<VerifyPassContext> = {}): VerifyPassContext {
  return {
    gymId: GYM,
    passKeys: [passKey(active), passKey(retired, 'retired', '2026-12-01T00:00:00Z')],
    serverNowMs: NOW,
    futureSkewSeconds: 300,
    findMember: async (id) => (id === M1 ? member : undefined),
    ...over,
  };
}

const fresh = { g: GYM, m: M1, n: 7, iat: nowS - 60, exp: nowS + 30 * DAY };

describe.each([
  ['default (WebCrypto Ed25519 → noble fallback)', defaultVerifier],
  ['@noble/ed25519', nobleVerify],
] as [string, Ed25519Verifier][])('member pass verification — %s', (_name, verifier) => {
  it('valid pass → ok with the cached member', async () => {
    const raw = await signPass(active, fresh);
    const res = await verifyMemberPass(raw, ctx({ verifier }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.member).toEqual(member);
      expect(res.pass).toMatchObject({ kid: 'k-active', g: GYM, m: M1, n: 7 });
    }
  });

  it('tampered member id → qr_invalid (signature)', async () => {
    const raw = (await signPass(active, fresh)).replace(`"m":"${M1}"`, `"m":"${M2}"`);
    expect(await verifyMemberPass(raw, ctx({ verifier }))).toMatchObject({ ok: false, code: 'qr_invalid' });
  });

  it('tampered expiry → qr_invalid', async () => {
    const raw = (await signPass(active, { ...fresh, exp: nowS + 10 })).replace(`"exp":${nowS + 10}`, `"exp":${nowS + 999 * DAY}`);
    expect(await verifyMemberPass(raw, ctx({ verifier }))).toMatchObject({ ok: false, code: 'qr_invalid' });
  });

  it('forged with another key under a known kid → qr_invalid', async () => {
    const raw = await signPass(stranger, fresh);
    expect(await verifyMemberPass(raw, ctx({ verifier }))).toMatchObject({ ok: false, code: 'qr_invalid' });
  });

  it('pass for another gym (validly signed) → qr_wrong_gym', async () => {
    const raw = await signPass(active, { ...fresh, g: GYM2 });
    expect(await verifyMemberPass(raw, ctx({ verifier }))).toMatchObject({ ok: false, code: 'qr_wrong_gym' });
  });

  it('expired → pass_expired (judged against estimated server now)', async () => {
    const raw = await signPass(active, { ...fresh, iat: nowS - 31 * DAY, exp: nowS - 1 });
    expect(await verifyMemberPass(raw, ctx({ verifier }))).toMatchObject({ ok: false, code: 'pass_expired' });
    // same pass is fine when the (estimated) server clock says it hasn't expired yet
    expect((await verifyMemberPass(raw, ctx({ verifier, serverNowMs: NOW - 10_000 }))).ok).toBe(true);
  });

  it('issued in the future beyond the skew → qr_invalid', async () => {
    const raw = await signPass(active, { ...fresh, iat: nowS + 600, exp: nowS + 30 * DAY });
    expect(await verifyMemberPass(raw, ctx({ verifier }))).toMatchObject({ ok: false, code: 'qr_invalid' });
  });

  it('unknown kid → qr_unknown_key', async () => {
    const other = await makeKey('k-new');
    const raw = await signPass(other, fresh);
    expect(await verifyMemberPass(raw, ctx({ verifier }))).toMatchObject({ ok: false, code: 'qr_unknown_key' });
  });

  it('retired key still in its grace window → ok; after valid_until → qr_unknown_key', async () => {
    const raw = await signPass(retired, fresh);
    expect((await verifyMemberPass(raw, ctx({ verifier }))).ok).toBe(true);
    const after = Date.parse('2026-12-01T00:00:01Z');
    expect(await verifyMemberPass(raw, ctx({ verifier, serverNowMs: after }))).toMatchObject({ ok: false, code: 'qr_unknown_key' });
  });

  it('retired key without valid_until is not accepted', async () => {
    const raw = await signPass(retired, fresh);
    const keys = [passKey(active), passKey(retired, 'retired', null)];
    expect(await verifyMemberPass(raw, ctx({ verifier, passKeys: keys }))).toMatchObject({ ok: false, code: 'qr_unknown_key' });
  });

  it('member not in the cache → member_not_found', async () => {
    const raw = await signPass(active, { ...fresh, m: M404 });
    expect(await verifyMemberPass(raw, ctx({ verifier }))).toMatchObject({ ok: false, code: 'member_not_found' });
  });
});

describe('member pass parsing', () => {
  it.each([
    ['not json', 'hello'],
    ['gym QR', JSON.stringify({ type: 'gym_access', gym_id: 'g', branch_id: 'b', token: 't' })],
    ['wrong version', JSON.stringify({ t: 'clby_mp', v: 2, kid: 'k', g: 'g', m: 'm', n: null, iat: 1, exp: 2, sig: 'x' })],
    ['missing sig', JSON.stringify({ t: 'clby_mp', v: 1, kid: 'k', g: 'g', m: 'm', n: null, iat: 1, exp: 2 })],
    ['string iat', JSON.stringify({ t: 'clby_mp', v: 1, kid: 'k', g: 'g', m: 'm', n: null, iat: '1', exp: 2, sig: 'x' })],
    ['float n', JSON.stringify({ t: 'clby_mp', v: 1, kid: 'k', g: 'g', m: 'm', n: 1.5, iat: 1, exp: 2, sig: 'x' })],
    ['array', '[]'],
  ])('%s → not a pass (qr_invalid)', async (_l, raw) => {
    expect(parseMemberPass(raw)).toBeNull();
    expect(await verifyMemberPass(raw, ctx())).toEqual({ ok: false, code: 'qr_invalid' });
  });

  it('canonical string uses an empty field for a null member number', () => {
    expect(canonicalPassString({ kid: 'k', g: 'g', m: 'm', n: null, iat: 1, exp: 2 })).toBe('clby_mp|1|k|g|m||1|2');
    expect(canonicalPassString({ kid: 'k', g: 'g', m: 'm', n: 42, iat: 1, exp: 2 })).toBe('clby_mp|1|k|g|m|42|1|2');
  });

  it('null member number pass verifies', async () => {
    const raw = await signPass(active, { ...fresh, n: null });
    expect((await verifyMemberPass(raw, ctx())).ok).toBe(true);
  });

  it('base64url round trip; rejects non-url alphabet', () => {
    const bytes = new Uint8Array([0, 251, 255, 62, 63]);
    expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
    expect(base64UrlEncode(bytes)).not.toMatch(/[+/=]/);
    expect(base64UrlDecode('ab+/')).toBeNull();
  });

  it('a bad signature length never throws', async () => {
    const raw = JSON.stringify({ ...JSON.parse(await signPass(active, fresh)), sig: 'AAAA' });
    expect(await verifyMemberPass(raw, ctx())).toMatchObject({ ok: false, code: 'qr_invalid' });
  });

  it('looksLikeMemberPass distinguishes passes from other QR codes', async () => {
    expect(looksLikeMemberPass(await signPass(active, fresh))).toBe(true);
    expect(looksLikeMemberPass('{"type":"gym_access"}')).toBe(false);
    expect(looksLikeMemberPass('https://example.com')).toBe(false);
  });
});

describe('PHASE2 amendments', () => {
  const v = () => ctx();
  const swap = (raw: string, from: string, to: string) => {
    expect(raw).toContain(from);
    return raw.replace(from, to);
  };

  it('§2 another gym\'s pass says wrong gym even when its key is unknown here', async () => {
    const foreign = await makeKey('k-foreign');
    const raw = await signPass(foreign, { ...fresh, g: GYM2 });
    expect(await verifyMemberPass(raw, v())).toMatchObject({ ok: false, code: 'qr_wrong_gym' });
  });

  it('g / m must be lowercase canonical UUIDs (server rule)', async () => {
    expect(await verifyMemberPass(await signPass(active, { ...fresh, g: GYM.toUpperCase() }), v())).toMatchObject({ code: 'qr_invalid' });
    const mHex = 'abcdef01-2345-4abc-8def-0123456789ab';
    expect(await verifyMemberPass(await signPass(active, { ...fresh, m: mHex.toUpperCase() }), v())).toMatchObject({ code: 'qr_invalid' });
  });

  it('staff gym id from the session is compared case-insensitively', async () => {
    expect((await verifyMemberPass(await signPass(active, fresh), ctx({ gymId: GYM.toUpperCase() }))).ok).toBe(true);
  });

  it('§1 iat > exp → qr_invalid (not pass_expired)', async () => {
    const raw = await signPass(active, { ...fresh, iat: nowS - 10, exp: nowS - 20 });
    expect(await verifyMemberPass(raw, v())).toMatchObject({ ok: false, code: 'qr_invalid' });
  });

  it('§1 iat after scan time + skew → qr_invalid; within skew → ok', async () => {
    expect(await verifyMemberPass(await signPass(active, { ...fresh, iat: nowS + 301 }), v())).toMatchObject({ code: 'qr_invalid' });
    expect((await verifyMemberPass(await signPass(active, { ...fresh, iat: nowS + 299 }), v())).ok).toBe(true);
  });

  it('§4 revoked key → qr_invalid, never accepted (no grace)', async () => {
    const raw = await signPass(retired, fresh);
    const keys = [passKey(active), passKey(retired, 'revoked', '2027-01-01T00:00:00Z')];
    expect(await verifyMemberPass(raw, ctx({ passKeys: keys }))).toMatchObject({ ok: false, code: 'qr_invalid' });
  });

  it('§3 integer fields must be canonical integer literals', async () => {
    const raw = await signPass(active, fresh);
    expect(await verifyMemberPass(swap(raw, '"v":1', '"v":1.0'), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, `"iat":${fresh.iat}`, `"iat":${fresh.iat}.0`), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, `"exp":${fresh.exp}`, `"exp":${fresh.exp / 10}e1`), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, '"n":7', '"n":7.0'), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, '"n":7', '"n":"7"'), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, '"n":7', '"n":07'), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, '"v":1', '"v":"1"'), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, '"n":7', '"n":true'), v())).toMatchObject({ code: 'qr_invalid' });
  });

  it('§3 exactly the 9 keys: extra or missing → qr_invalid', async () => {
    const raw = await signPass(active, fresh);
    expect(await verifyMemberPass(raw.replace(/}$/, ',"x":1}'), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, '"n":7,', ''), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(raw.replace(/}$/, ',"nested":{}}'), v())).toMatchObject({ code: 'qr_invalid' });
  });

  it('§3 signature must be canonical base64url of exactly 64 bytes', async () => {
    const raw = await signPass(active, fresh);
    const sig = JSON.parse(raw).sig as string;
    const withSig = (s: string) => swap(raw, `"sig":"${sig}"`, `"sig":"${s}"`);
    expect(await verifyMemberPass(withSig(sig + '=='), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(withSig(sig.replace(/-/g, '+').replace(/_/g, '/')), v())).toMatchObject({ code: 'qr_invalid' });
    // last char carries 2 unused bits: flip them → decodes to the same bytes but is non-canonical
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const last = alphabet.indexOf(sig[85]);
    const tweaked = sig.slice(0, 85) + alphabet[(last & ~0b11) | ((last & 0b11) ^ 0b01)];
    expect(tweaked).not.toBe(sig);
    expect(await verifyMemberPass(withSig(tweaked), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(withSig(sig.slice(0, 84)), v())).toMatchObject({ code: 'qr_invalid' });
  });

  it('§3 BOM and over-long text are rejected; whitespace/key order are plain JSON', async () => {
    const raw = await signPass(active, fresh);
    expect(await verifyMemberPass('\uFEFF' + raw, v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(raw + ' '.repeat(1025 - raw.length), v())).toMatchObject({ code: 'qr_invalid' });
    expect((await verifyMemberPass(raw + ' '.repeat(1024 - raw.length), v())).ok).toBe(true);
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(raw)).reverse()));
    expect((await verifyMemberPass(reordered, v())).ok).toBe(true);
    expect(await verifyMemberPass(raw + 'x', v())).toMatchObject({ code: 'qr_invalid' });
  });

  it('§3 kid / g / m formats mirror the server (kid charset, UUIDs)', async () => {
    const raw = await signPass(active, fresh);
    expect(await verifyMemberPass(swap(raw, '"kid":"k-active"', '"kid":"k|x"'), v())).toMatchObject({ code: 'qr_invalid' });
    expect(await verifyMemberPass(swap(raw, `"m":"${M1}"`, '"m":"not-a-uuid"'), v())).toMatchObject({ code: 'qr_invalid' });
  });

  it('member number must be a safe integer (|n| ≤ 2^53−1, server rule)', async () => {
    const ok = await signPass(active, { ...fresh, n: Number.MAX_SAFE_INTEGER });
    expect((await verifyMemberPass(ok, v())).ok).toBe(true);
    const raw = await signPass(active, { ...fresh, n: 0 });
    expect(await verifyMemberPass(raw.replace('"n":0', '"n":9007199254740992'), v())).toMatchObject({ code: 'qr_invalid' });
  });
});
