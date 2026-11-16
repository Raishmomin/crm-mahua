/**
 * Phone normalisation and tel: / wa.me builders (docs/design/components.md section 8).
 * The stored value is always the raw text as typed; normalisation happens at render time.
 */

export interface NormalisedPhone {
  /** Digits only, with country code, no plus: 919825012345 */
  digits: string;
  /** Human form: +91 98250 12345 */
  display: string;
}

export function normalisePhone(raw: string | null | undefined): NormalisedPhone | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const startsPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (startsPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
    if (digits.length < 8 || digits.length > 15) return null;
  } else if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && /^0[6-9]/.test(digits)) {
    digits = `91${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith('91') && /^91[6-9]/.test(digits)) {
    // as is
  } else {
    return null;
  }

  return { digits, display: displayFor(digits, trimmed) };
}

function displayFor(digits: string, raw: string): string {
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  // Keep the spacing the user typed when it was international and spaced.
  const typed = raw.replace(/^\+|^00/, '').trim();
  if (/\s/.test(typed) && typed.replace(/\D/g, '') === digits) {
    return `+${typed.replace(/[^\d\s]/g, '').replace(/\s+/g, ' ').trim()}`;
  }
  return `+${digits}`;
}

export function formatPhoneDisplay(raw: string | null | undefined): string {
  return normalisePhone(raw)?.display ?? (raw ?? '');
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return normalisePhone(raw) !== null;
}

/** tel:+919825012345 or null when the number is unusable. */
export function telHref(raw: string | null | undefined): string | null {
  const n = normalisePhone(raw);
  return n ? `tel:+${n.digits}` : null;
}

/** https://wa.me/919825012345?text=... (text omitted when empty) or null. */
export function whatsappHref(raw: string | null | undefined, message?: string | null): string | null {
  const n = normalisePhone(raw);
  if (!n) return null;
  const base = `https://wa.me/${n.digits}`;
  const text = (message ?? '').trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Digits of a search term for phone matching (ilike on digits). */
export function phoneSearchDigits(term: string): string {
  return term.replace(/\D/g, '');
}
