/**
 * Phone helpers — strict E.164 normalization shared by client forms,
 * the message log resend flow and the Telnyx status page.
 */

export interface PhoneParseResult {
  /** Normalized, de-duplicated E.164 numbers found in the input. */
  valid: string[];
  /** Raw segments that could not be normalized. */
  invalid: string[];
}

/** Splits a contact field that may hold several numbers. */
export function splitPhoneField(raw: string): string[] {
  return String(raw ?? '')
    .split(/[,;/\n]+|\s+(?:and|or|&)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Normalizes a single number to E.164, or returns null when it is not valid. */
export function normalizeToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const hadPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  // Default to North America when no country code is present.
  if (!hadPlus && digits.length === 10) digits = '1' + digits;
  if (!hadPlus && digits.length === 11 && digits.startsWith('1')) {
    // already has US country code
  }
  if (digits.length < 11 || digits.length > 15) return null;
  if (digits.startsWith('1') && digits.length === 11) {
    const area = digits[1];
    const exch = digits[4];
    // NANP: area code and exchange must start with 2-9.
    if (area < '2' || area > '9' || exch < '2' || exch > '9') return null;
  }
  return '+' + digits;
}

/** Parses a whole contact field into valid/invalid parts. */
export function parsePhoneField(raw: string | null | undefined): PhoneParseResult {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of splitPhoneField(raw ?? '')) {
    const normalized = normalizeToE164(part);
    if (!normalized) invalid.push(part);
    else if (!valid.includes(normalized)) valid.push(normalized);
  }
  return { valid, invalid };
}

/** Rewrites a contact field so every valid number is stored in E.164. */
export function normalizePhoneField(raw: string | null | undefined): string {
  const { valid } = parsePhoneField(raw);
  return valid.join(', ');
}

/**
 * Validation message for a contact phone field, or null when it's acceptable.
 * Empty input is allowed (phone is optional) — callers enforce requiredness.
 */
export function phoneFieldError(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const { valid, invalid } = parsePhoneField(value);
  if (invalid.length) {
    return `Not a valid phone number: ${invalid.join(', ')}. Use a 10-digit US number or +country format.`;
  }
  if (!valid.length) return 'Enter a valid phone number (e.g. (601) 555-0123).';
  return null;
}

/** Pretty display for a stored E.164 number. */
export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
