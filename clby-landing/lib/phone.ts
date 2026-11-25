/**
 * WhatsApp number handling for the lead form (client + /api/lead).
 *
 * The form sends a country dial code (from the selector) and the local
 * number separately; joinPhone() turns them into one E.164 number.
 * cleanPhone() validates whatever reaches the server, so older clients
 * sending a single Egyptian "01X…" number still work.
 */

export const COUNTRY_CODES: { iso: string; name: string; dial: string }[] = [
  { iso: "EG", name: "Egypt", dial: "20" },
  { iso: "SA", name: "Saudi Arabia", dial: "966" },
  { iso: "AE", name: "UAE", dial: "971" },
  { iso: "KW", name: "Kuwait", dial: "965" },
  { iso: "QA", name: "Qatar", dial: "974" },
  { iso: "BH", name: "Bahrain", dial: "973" },
  { iso: "OM", name: "Oman", dial: "968" },
  { iso: "JO", name: "Jordan", dial: "962" },
  { iso: "LB", name: "Lebanon", dial: "961" },
  { iso: "IQ", name: "Iraq", dial: "964" },
  { iso: "LY", name: "Libya", dial: "218" },
  { iso: "SD", name: "Sudan", dial: "249" },
  { iso: "MA", name: "Morocco", dial: "212" },
  { iso: "TN", name: "Tunisia", dial: "216" },
  { iso: "DZ", name: "Algeria", dial: "213" },
  { iso: "TR", name: "Turkey", dial: "90" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "US", name: "United States / Canada", dial: "1" },
];

export const DEFAULT_DIAL = "20";

const EG_LOCAL = /^01[0125]\d{8}$/;
const EG_INTL = /^\+201[0125]\d{8}$/;
const INTL = /^\+[1-9]\d{7,14}$/; // E.164: country code + up to 15 digits

/**
 * Combine the selected dial code with the typed number. If the person
 * typed a full international number anyway (+…/00…), that wins. A local
 * trunk "0" (Egypt's 010…, UK's 07…) is dropped after the country code.
 */
export function joinPhone(dial: string, local: string): string {
  const raw = local.replace(/[\s\-.()]/g, "");
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return `+${raw.slice(2)}`;
  return `+${dial}${raw.replace(/^0+/, "")}`;
}

/** Validated, cleaned number, or null. */
export function cleanPhone(raw: string): string | null {
  let p = raw.replace(/[\s\-.()]/g, "");
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (EG_LOCAL.test(p)) return `+2${p}`;
  if (p.startsWith("+20")) return EG_INTL.test(p) ? p : null;
  if (INTL.test(p)) return p;
  return null;
}

export const PHONE_ERROR = "Enter a valid phone number for the selected country.";
