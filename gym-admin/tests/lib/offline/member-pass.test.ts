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

const GYM = 'gym-1';
const NOW = Date.parse('2026-11-26T10:00:00Z');
const nowS = NOW / 1000;
const DAY = 86_400;

const member: CachedMember = {
  gym_member_id: 'm1', member_number: 7, full_name: 'Sara Ali', phone_last4: '1234', photo_url: null, status: 'active', name_lc: 'sara ali',
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
    findMember: async (id) => (id === 'm1' ? member : undefined),
    ...over,
  };
}

const fresh = { g: GYM, m: 'm1', n: 7, iat: nowS - 60, exp: nowS + 30 * DAY };

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
      expect(res.pass).toMatchObject({ kid: 'k-active', g: GYM, m: 'm1', n: 7 });
    }
  });

  it('tampered member id → qr_invalid (signature)', async () => {
    const raw = (await signPass(active, fresh)).replace('"m":"m1"', '"m":"m2"');
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
    const raw = await signPass(active, { ...fresh, g: 'gym-2' });
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
    const raw = await signPass(active, { ...fresh, m: 'm404' });
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
