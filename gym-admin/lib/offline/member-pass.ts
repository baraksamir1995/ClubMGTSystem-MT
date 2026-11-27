/**
 * Offline attendance — member pass verification (PHASE2-CONTRACT "Verification"
 * + "Amendments after Phase 2 verification").
 *
 * QR text (compact JSON): {"t":"clby_mp","v":1,"kid":"…","g":"<gym uuid>","m":"<member uuid>",
 *   "n":<int|null>,"iat":<unix s>,"exp":<unix s>,"sig":"<base64url, no padding>"}
 * Signature: Ed25519 over UTF-8 `clby_mp|1|<kid>|<g>|<m>|<n or empty>|<iat>|<exp>`.
 *
 * Order (amendment §2):
 *  1. strict canonical parse (§3)  → qr_invalid
 *  4. g == staff gym               → qr_wrong_gym   (before key lookup)
 *  2. kid usable: active, or retired within valid_until; revoked never (§4)
 *     → unknown kid / out of grace: qr_unknown_key (client: refresh data); revoked: qr_invalid
 *  3. signature                    → qr_invalid
 *  5. iat ≤ exp, iat ≤ scan time + skew (§1) → qr_invalid; exp > scan time → else pass_expired
 *  6. member in the local cache    → member_not_found
 * "Scan time" is the estimated server now (CONTRACT §6.6 clock).
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
  /** display value; may lose precision beyond 2^53 — the signature uses `literals` */
  n: number | null;
  iat: number;
  exp: number;
  sig: string;
  /** exact integer literals as scanned (canonical decimal form) */
  literals?: { n: string | null; iat: string; exp: string };
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
  const n = p.literals ? p.literals.n : p.n == null ? null : String(p.n);
  const iat = p.literals ? p.literals.iat : String(p.iat);
  const exp = p.literals ? p.literals.exp : String(p.exp);
  return `clby_mp|1|${p.kid}|${p.g}|${p.m}|${n ?? ''}|${iat}|${exp}`;
}

// ── step 1: strict canonical parse (amendment §3) ───────────────────────────

export const MAX_PASS_LENGTH = 1024;
const PASS_KEYS = ['t', 'v', 'kid', 'g', 'm', 'n', 'iat', 'exp', 'sig'] as const;
const KID_RE = /^[A-Za-z0-9_-]{1,32}$/;
/** lowercase canonical UUID only (server rule: anything else → qr_invalid) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** canonical JSON integer: no fraction, no exponent, no leading zeros, no -0 */
const INT_RE = /^(?:0|-?[1-9][0-9]*)$/;
const SIG_RE = /^[A-Za-z0-9_-]{86}$/;

type Lit = { kind: 'string'; value: string } | { kind: 'number'; text: string } | { kind: 'null' } | { kind: 'other' };

/**
 * Minimal tokenizer for a FLAT JSON object that keeps number literals as text
 * (JSON.parse would turn `1.0` into `1`). Returns null on any syntax error or
 * nested value. Duplicate keys: last wins (same as JSON.parse / PHP json_decode).
 */
export function parseFlatJsonObject(raw: string): Map<string, Lit> | null {
  const ws = /[ \t\n\r]*/y;
  const str = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;
  const num = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  let i = 0;
  const skip = () => {
    ws.lastIndex = i;
    ws.exec(raw);
    i = ws.lastIndex;
  };
  const take = (re: RegExp): string | null => {
    re.lastIndex = i;
    const m = re.exec(raw);
    if (!m) return null;
    i = re.lastIndex;
    return m[0];
  };
  const out = new Map<string, Lit>();
  skip();
  if (raw[i] !== '{') return null;
  i++;
  skip();
  if (raw[i] === '}') {
    i++;
  } else {
    for (;;) {
      skip();
      const keyTok = take(str);
      if (keyTok == null) return null;
      skip();
      if (raw[i] !== ':') return null;
      i++;
      skip();
      let lit: Lit;
      const sTok = take(str);
      if (sTok != null) {
        lit = { kind: 'string', value: JSON.parse(sTok) as string };
      } else {
        const nTok = take(num);
        if (nTok != null) lit = { kind: 'number', text: nTok };
        else if (raw.startsWith('null', i)) {
          i += 4;
          lit = { kind: 'null' };
        } else if (raw.startsWith('true', i) || raw.startsWith('false', i)) {
          i += raw.startsWith('true', i) ? 4 : 5;
          lit = { kind: 'other' };
        } else return null; // nested object/array or garbage
      }
      out.set(JSON.parse(keyTok) as string, lit);
      skip();
      if (raw[i] === ',') {
        i++;
        continue;
      }
      if (raw[i] === '}') {
        i++;
        break;
      }
      return null;
    }
  }
  skip();
  return i === raw.length ? out : null;
}

/** base64url without padding whose decoding is exactly 64 bytes and re-encodes identically. */
export function isCanonicalSig(sig: string): boolean {
  if (!SIG_RE.test(sig)) return false;
  const bytes = base64UrlDecode(sig);
  return !!bytes && bytes.length === 64 && base64UrlEncode(bytes) === sig;
}

/** Parse a scanned string as a member pass; null unless it is the canonical v1 form. */
export function parseMemberPass(raw: string): MemberPass | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_PASS_LENGTH) return null;
  if (raw.charCodeAt(0) === 0xfeff) return null; // BOM
  const obj = parseFlatJsonObject(raw);
  if (!obj || obj.size !== PASS_KEYS.length) return null;
  for (const k of PASS_KEYS) if (!obj.has(k)) return null;
  const get = (k: (typeof PASS_KEYS)[number]) => obj.get(k)!;

  const t = get('t');
  const v = get('v');
  const kid = get('kid');
  const g = get('g');
  const m = get('m');
  const n = get('n');
  const iat = get('iat');
  const exp = get('exp');
  const sig = get('sig');

  if (t.kind !== 'string' || t.value !== 'clby_mp') return null;
  if (v.kind !== 'number' || v.text !== '1') return null;
  if (kid.kind !== 'string' || !KID_RE.test(kid.value)) return null;
  if (g.kind !== 'string' || !UUID_RE.test(g.value)) return null;
  if (m.kind !== 'string' || !UUID_RE.test(m.value)) return null;
  // server rule: |n| ≤ 2^53−1 (safe integer)
  if (!(n.kind === 'null' || (n.kind === 'number' && INT_RE.test(n.text) && Number.isSafeInteger(Number(n.text))))) return null;
  if (iat.kind !== 'number' || !INT_RE.test(iat.text)) return null;
  if (exp.kind !== 'number' || !INT_RE.test(exp.text)) return null;
  if (sig.kind !== 'string' || !isCanonicalSig(sig.value)) return null;

  return {
    t: 'clby_mp',
    v: 1,
    kid: kid.value,
    g: g.value,
    m: m.value,
    n: n.kind === 'number' ? Number(n.text) : null,
    iat: Number(iat.text),
    exp: Number(exp.text),
    sig: sig.value,
    literals: { n: n.kind === 'number' ? n.text : null, iat: iat.text, exp: exp.text },
  };
}

/** Quick check used by the scanner to tell a member pass from other QR codes. */
export function looksLikeMemberPass(raw: string): boolean {
  return raw.replace(/^\uFEFF/, '').trimStart().startsWith('{') && raw.includes('"clby_mp"');
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

export type KeyLookup = { ok: true; key: PassKey } | { ok: false; code: 'qr_unknown_key' | 'qr_invalid' };

/** Active, or retired within valid_until (judged at scan time); revoked → never. */
export function lookupKey(keys: PassKey[], kid: string, nowMs: number): KeyLookup {
  const k = keys.find((x) => x.kid === kid);
  if (!k) return { ok: false, code: 'qr_unknown_key' };
  if (k.status === 'revoked') return { ok: false, code: 'qr_invalid' };
  if (k.status === 'active') return { ok: true, key: k };
  if (k.status === 'retired' && k.valid_until) {
    const until = Date.parse(k.valid_until);
    if (!Number.isNaN(until) && until > nowMs) return { ok: true, key: k };
  }
  return { ok: false, code: 'qr_unknown_key' };
}

/** @deprecated kept for callers: the usable key or null. */
export function usableKey(keys: PassKey[], kid: string, nowMs: number): PassKey | null {
  const r = lookupKey(keys, kid, nowMs);
  return r.ok ? r.key : null;
}

export async function verifyMemberPass(raw: string, ctx: VerifyPassContext): Promise<PassVerification> {
  // 1. strict parse
  const pass = parseMemberPass(raw);
  if (!pass) return { ok: false, code: 'qr_invalid' };
  // 4 (before key lookup, amendment §2). `g` is lowercase (parser); the staff gym id is normalised.
  if (pass.g !== ctx.gymId.toLowerCase()) return { ok: false, code: 'qr_wrong_gym', pass };
  // 2. key
  const key = lookupKey(ctx.passKeys, pass.kid, ctx.serverNowMs);
  if (!key.ok) return { ok: false, code: key.code, pass };
  // 3. signature
  const pub = base64UrlDecode(key.key.public_key);
  const sig = base64UrlDecode(pass.sig);
  if (!pub || !sig) return { ok: false, code: 'qr_invalid', pass };
  const msg = new TextEncoder().encode(canonicalPassString(pass));
  const valid = await (ctx.verifier ?? defaultVerifier)(pub, sig, msg);
  if (!valid) return { ok: false, code: 'qr_invalid', pass };
  // 5. time (amendment §1): iat ≤ exp, iat ≤ scan time + skew, exp > scan time
  const scanS = Math.floor(ctx.serverNowMs / 1000);
  if (pass.iat > pass.exp) return { ok: false, code: 'qr_invalid', pass };
  if (pass.iat > scanS + ctx.futureSkewSeconds) return { ok: false, code: 'qr_invalid', pass };
  if (pass.exp <= scanS) return { ok: false, code: 'pass_expired', pass };
  // 6. member (lowercase UUID, as the cache stores them)
  const member = await ctx.findMember(pass.m);
  if (!member) return { ok: false, code: 'member_not_found', pass };
  return { ok: true, pass, member };
}
