/**
 * WhatsApp number check for the lead form (client + /api/lead).
 *
 * Accepts an Egyptian mobile in local form (01X XXXX XXXX, the common
 * case) or any international number written with its country code
 * (+962 7X XXX XXXX, 00962…). Spaces, dashes, dots and brackets are
 * ignored. Returns the cleaned number, or null if it isn't valid.
 */
const EG_LOCAL = /^01[0125]\d{8}$/;
const INTL = /^\+[1-9]\d{7,14}$/; // E.164: country code + up to 15 digits

export function cleanPhone(raw: string): string | null {
  let p = raw.replace(/[\s\-.()]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (EG_LOCAL.test(p)) return p;
  if (INTL.test(p)) return p;
  return null;
}

export const PHONE_ERROR =
  "Enter a valid number. Outside Egypt, start with your country code (e.g. +962 7X XXX XXXX).";
