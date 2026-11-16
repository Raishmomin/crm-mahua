/**
 * Pure helpers for the buyer screens (no 'use client': used by server pages and BuyerForm).
 */
import { normalisePhone } from '@/lib/phone';

const APP_ORIGIN = 'https://app.invalid';

/**
 * SEC2-04: returns an in-app path (pathname + search + hash) or null. The value is parsed the way
 * the browser and router.push will parse it, so `/\evil.example`, `/<tab>/evil.example` and
 * `/.//evil.example` can never send the user to another site.
 */
export function safeInternalPath(p: string | null | undefined): string | null {
  if (!p || !p.startsWith('/')) return null;
  let url: URL;
  try {
    url = new URL(p, APP_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== APP_ORIGIN || url.pathname.startsWith('//')) return null;
  return url.pathname + url.search + url.hash;
}

/** Calling codes of the markets the plant ships to; longest code wins. Country names are stored data. */
const DIAL_COUNTRIES: Array<[string, string]> = [
  ['971', 'United Arab Emirates'],
  ['966', 'Saudi Arabia'],
  ['968', 'Oman'],
  ['974', 'Qatar'],
  ['973', 'Bahrain'],
  ['965', 'Kuwait'],
  ['880', 'Bangladesh'],
  ['977', 'Nepal'],
  ['94', 'Sri Lanka'],
  ['91', 'India'],
  ['60', 'Malaysia'],
  ['62', 'Indonesia'],
  ['49', 'Germany'],
  ['44', 'United Kingdom'],
  ['31', 'Netherlands'],
  ['1', 'United States'],
];

/**
 * G2-04: India / Export and the country implied by a phone number, for prefilling the buyer form
 * from an inquiry. An unknown calling code gives Export with an empty country (the form then asks).
 */
export function whereFromPhone(phone: string | null | undefined): { isExport: boolean; country: string } {
  const n = normalisePhone(phone);
  if (!n || n.digits.startsWith('91')) return { isExport: false, country: 'India' };
  const hit = DIAL_COUNTRIES.find(([code]) => n.digits.startsWith(code));
  return { isExport: true, country: hit ? hit[1] : '' };
}
