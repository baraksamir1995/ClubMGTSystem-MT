// @vitest-environment node
/**
 * LIVE: dashboard member-pass verification against a real clby-api.
 * Skipped unless OFFLINE_LIVE_API is set:
 *
 *   OFFLINE_LIVE_API=http://localhost:8082/api OFFLINE_LIVE_TOKEN='<admin bearer>' \
 *   npx vitest run tests/integration/member-pass-live.test.ts
 *
 * Fetches a server-signed pass for a real member and the gym's pass_keys from
 * bootstrap, then runs the dashboard verifier (both Ed25519 back-ends).
 */
import { describe, expect, it } from 'vitest';
import { defaultVerifier, nobleVerify, verifyMemberPass, parseMemberPass } from '@/lib/offline/member-pass';
import type { AdminBootstrapPage, CachedMember } from '@/lib/offline/types';

const API = process.env.OFFLINE_LIVE_API;
const TOKEN = process.env.OFFLINE_LIVE_TOKEN ?? '';

async function get<T>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' } });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

describe.skipIf(!API)('LIVE member pass → dashboard verifier', () => {
  it('server-signed pass verifies with the bootstrap pass_keys; tampering and wrong gym fail', async () => {
    const boot = await get<AdminBootstrapPage>('/attendance/offline/bootstrap?limit=50');
    expect(boot.status).toBe(200);
    const page = boot.body;
    expect(Array.isArray(page.pass_keys)).toBe(true);
    expect(page.pass_keys!.length).toBeGreaterThan(0);
    const m = page.members[0];
    const pass = await get<{ qr: string; expires_at: string; kid: string }>(`/members/${m.gym_member_id}/member-pass`);
    expect(pass.status).toBe(200);
    const parsed = parseMemberPass(pass.body.qr);
    expect(parsed).not.toBeNull();
    console.log('live pass', { kid: parsed?.kid, g: parsed?.g === page.gym.id, exp: pass.body.expires_at, keys: page.pass_keys });

    const member: CachedMember = { ...m, name_lc: (m.full_name ?? '').toLowerCase() };
    for (const verifier of [defaultVerifier, nobleVerify]) {
      const ctx = {
        gymId: page.gym.id,
        passKeys: page.pass_keys!,
        serverNowMs: Date.parse(page.server_time),
        futureSkewSeconds: page.policy.future_skew_seconds,
        findMember: async (id: string) => (id === m.gym_member_id ? member : undefined),
        verifier,
      };
      const ok = await verifyMemberPass(pass.body.qr, ctx);
      expect(ok.ok).toBe(true);
      const tampered = pass.body.qr.replace(`"exp":${parsed!.exp}`, `"exp":${parsed!.exp + 86_400}`);
      expect(await verifyMemberPass(tampered, ctx)).toMatchObject({ ok: false, code: 'qr_invalid' });
      expect(await verifyMemberPass(pass.body.qr, { ...ctx, gymId: 'another-gym' })).toMatchObject({ ok: false, code: 'qr_wrong_gym' });
      expect(await verifyMemberPass(pass.body.qr, { ...ctx, passKeys: [] })).toMatchObject({ ok: false, code: 'qr_unknown_key' });
    }
  }, 60_000);
});
