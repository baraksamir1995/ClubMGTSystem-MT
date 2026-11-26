import * as ed from '@noble/ed25519';
import { base64UrlEncode, canonicalPassString, type MemberPass } from '@/lib/offline/member-pass';
import type { PassKey } from '@/lib/offline/types';

export interface TestKey {
  kid: string;
  secret: Uint8Array;
  publicKey: Uint8Array;
}

export async function makeKey(kid: string): Promise<TestKey> {
  const secret = ed.utils.randomSecretKey();
  return { kid, secret, publicKey: await ed.getPublicKeyAsync(secret) };
}

export function passKey(k: TestKey, status: PassKey['status'] = 'active', validUntil: string | null = null): PassKey {
  return { kid: k.kid, public_key: base64UrlEncode(k.publicKey), status, valid_until: validUntil };
}

/** Build the exact QR text the server issues (keys in contract order). */
export async function signPass(
  k: TestKey,
  fields: { g: string; m: string; n?: number | null; iat: number; exp: number },
): Promise<string> {
  const body = { kid: k.kid, g: fields.g, m: fields.m, n: fields.n ?? null, iat: fields.iat, exp: fields.exp };
  const sig = await ed.signAsync(new TextEncoder().encode(canonicalPassString(body)), k.secret);
  const pass: MemberPass = { t: 'clby_mp', v: 1, ...body, sig: base64UrlEncode(sig) };
  return JSON.stringify(pass);
}
