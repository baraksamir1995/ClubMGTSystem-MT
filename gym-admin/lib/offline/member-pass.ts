/**
 * Offline attendance — member pass verification (PHASE2-CONTRACT "Verification").
 *
 * QR text (compact JSON, keys in this order):
 *   {"t":"clby_mp","v":1,"kid":"…","g":"<gym_id>","m":"<gym_member_id>","n":<number|null>,
 *    "iat":<unix s>,"exp":<unix s>,"sig":"<base64url, no padding>"}
 * Signature: Ed25519 over UTF-8 `clby_mp|1|<kid>|<g>|<m>|<n or empty>|<iat>|<exp>`.
 *
 * Steps (identical on dashboard, coach app and server):
 *  1. parse + shape                → qr_invalid
 *  2. kid known (active, or retired within valid_until) → qr_unknown_key (client: refresh data)
 *  3. signature                    → qr_invalid
 *  4. g == staff gym               → qr_wrong_gym
 *  5. exp > server now, iat ≤ now + future skew → pass_expired / qr_invalid
 *  6. member in the local cache    → member_not_found
 *
 * Ed25519: WebCrypto `Ed25519` where the browser supports it (Chrome 137+,
 * Safari 17+, Firefox 129+, Node 20+), else `@noble/ed25519` (audited, zero
 * dependencies, ~5 KB; its async verify hashes with WebCrypto SHA-512).
 * Verification only — no private keys ever reach the client.
 */
import * as ed from '@noble/ed25519';
import type { CachedMember, PassKey } from './types';

export interface MemberPass {
  t: 'clby_mp';
  v: 1;
  kid: string;
  g: string;
  m: string;
  n: number | null;
  iat: number;
  exp: number;
  sig: string;
}

export type PassFailure = 'qr_invalid' | 'qr_unknown_key' | 'qr_wrong_gym' | 'pass_expired' | 'member_not_found';

export type PassVerification =
  | { ok: true; pass: MemberPass; member: CachedMember }
  | { ok: false; code: PassFailure; pass?: MemberPass };

export type Ed25519Verifier = (publicKey: Uint8Array, signature: Uint8Array, message: Uint8Array) => Promise<boolean>;

export interface VerifyPassContext {
  gymId: string;
  passKeys: PassKey[];
  /** estimated server now (CONTRACT §6.6), epoch ms */
  serverNowMs: number;
  futureSkewSeconds: number;
  findMember: (gymMemberId: string) => Promise<CachedMember | undefined>;
  verifier?: Ed25519Verifier;
}

// ── encoding ────────────────────────────────────────────────────────────────

export function base64UrlDecode(input: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function canonicalPassString(p: Omit<MemberPass, 'sig' | 't' | 'v'>): string {
  return `clby_mp|1|${p.kid}|${p.g}|${p.m}|${p.n == null ? '' : p.n}|${p.iat}|${p.exp}`;
}

// ── step 1: parse ───────────────────────────────────────────────────────────

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

/** Parse a scanned string as a member pass; null when it is not a well-formed v1 pass. */
export function parseMemberPass(raw: string): MemberPass | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const p = o as Record<string, unknown>;
  if (p.t !== 'clby_mp' || p.v !== 1) return null;
  if (!isStr(p.kid) || !isStr(p.g) || !isStr(p.m) || !isStr(p.sig)) return null;
  if (!(p.n === null || isInt(p.n))) return null;
  if (!isInt(p.iat) || !isInt(p.exp)) return null;
  return { t: 'clby_mp', v: 1, kid: p.kid, g: p.g, m: p.m, n: p.n as number | null, iat: p.iat, exp: p.exp, sig: p.sig };
}

/** Quick check used by the scanner to tell a member pass from other QR codes. */
export function looksLikeMemberPass(raw: string): boolean {
  return raw.trimStart().startsWith('{') && raw.includes('"clby_mp"');
}

// ── Ed25519 ─────────────────────────────────────────────────────────────────

let webCryptoEd25519: boolean | null = null;

async function webCryptoVerify(pub: Uint8Array, sig: Uint8Array, msg: Uint8Array): Promise<boolean> {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey('raw', pub as BufferSource, { name: 'Ed25519' }, false, ['verify']);
  return subtle.verify({ name: 'Ed25519' }, key, sig as BufferSource, msg as BufferSource);
}

/** Noble fallback (also the reference implementation in tests). */
export const nobleVerify: Ed25519Verifier = async (pub, sig, msg) => {
  try {
    return await ed.verifyAsync(sig, msg, pub);
  } catch {
    return false;
  }
};

/** WebCrypto Ed25519 when available, else @noble/ed25519. Never throws. */
export const defaultVerifier: Ed25519Verifier = async (pub, sig, msg) => {
  if (pub.length !== 32 || sig.length !== 64) return false;
  if (webCryptoEd25519 !== false && globalThis.crypto?.subtle) {
    try {
      const ok = await webCryptoVerify(pub, sig, msg);
      webCryptoEd25519 = true;
      return ok;
    } catch {
      // NotSupportedError (no Ed25519 in this browser) → fall back for good
      if (webCryptoEd25519 === null) webCryptoEd25519 = false;
      else return false;
    }
  }
  return nobleVerify(pub, sig, msg);
};

// ── steps 2–6 ───────────────────────────────────────────────────────────────

export function usableKey(keys: PassKey[], kid: string, nowMs: number): PassKey | null {
  const k = keys.find((x) => x.kid === kid);
  if (!k) return null;
  if (k.status === 'active') return k;
  if (k.status === 'retired' && k.valid_until) {
    const until = Date.parse(k.valid_until);
    if (!Number.isNaN(until) && until > nowMs) return k;
  }
  return null;
}

export async function verifyMemberPass(raw: string, ctx: VerifyPassContext): Promise<PassVerification> {
  // 1
  const pass = parseMemberPass(raw);
  if (!pass) return { ok: false, code: 'qr_invalid' };
  // 2
  const key = usableKey(ctx.passKeys, pass.kid, ctx.serverNowMs);
  if (!key) return { ok: false, code: 'qr_unknown_key', pass };
  // 3
  const pub = base64UrlDecode(key.public_key);
  const sig = base64UrlDecode(pass.sig);
  if (!pub || !sig) return { ok: false, code: 'qr_invalid', pass };
  const msg = new TextEncoder().encode(canonicalPassString(pass));
  const valid = await (ctx.verifier ?? defaultVerifier)(pub, sig, msg);
  if (!valid) return { ok: false, code: 'qr_invalid', pass };
  // 4
  if (pass.g !== ctx.gymId) return { ok: false, code: 'qr_wrong_gym', pass };
  // 5
  const nowS = Math.floor(ctx.serverNowMs / 1000);
  if (pass.exp <= nowS) return { ok: false, code: 'pass_expired', pass };
  if (pass.iat > nowS + ctx.futureSkewSeconds) return { ok: false, code: 'qr_invalid', pass };
  // 6
  const member = await ctx.findMember(pass.m);
  if (!member) return { ok: false, code: 'member_not_found', pass };
  return { ok: true, pass, member };
}
