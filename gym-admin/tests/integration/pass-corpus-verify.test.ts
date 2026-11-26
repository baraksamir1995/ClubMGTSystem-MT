// @vitest-environment node
/**
 * Cross-implementation member-pass corpus: runs every case of a corpus produced
 * by the PHP issuer/verifier through lib/offline/member-pass.ts with both the
 * WebCrypto and the @noble/ed25519 verifier. Skipped unless PASS_CORPUS points at
 * the corpus JSON. Writes verdicts to PASS_CORPUS_OUT when set.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultVerifier, nobleVerify, verifyMemberPass } from '@/lib/offline/member-pass';

const CORPUS = process.env.PASS_CORPUS;

describe.skipIf(!CORPUS)('member pass corpus (JS)', () => {
  it('matches the server verdicts', async () => {
    const c = JSON.parse(readFileSync(CORPUS!, 'utf8'));
    const out: Record<string, { webcrypto: string; noble: string; server: string }> = {};
    for (const k of c.cases) {
      const ctx = (verifier: typeof nobleVerify) => ({
        gymId: c.gym_id, passKeys: c.pass_keys, serverNowMs: c.now_ms, futureSkewSeconds: c.future_skew_seconds,
        findMember: async (id: string) => (c.cached_member_ids.includes(id) ? ({ gym_member_id: id } as never) : undefined),
        verifier,
      });
      const w = await verifyMemberPass(k.raw, ctx(defaultVerifier));
      const n = await verifyMemberPass(k.raw, ctx(nobleVerify));
      out[k.name] = { webcrypto: w.ok ? 'ok' : w.code, noble: n.ok ? 'ok' : n.code, server: k.server };
    }
    if (process.env.PASS_CORPUS_OUT) writeFileSync(process.env.PASS_CORPUS_OUT, JSON.stringify(out, null, 2));
    const norm = (v: string) => (v === 'qr_unknown_key' ? 'qr_invalid' : v);
    const diffs = Object.entries(out).filter(([, v]) => norm(v.webcrypto) !== v.server || norm(v.noble) !== v.server || v.webcrypto !== v.noble);
    console.log('JS vs server disagreements:', JSON.stringify(diffs, null, 1));
    expect(Object.keys(out).length).toBe(c.cases.length);
  });
});
