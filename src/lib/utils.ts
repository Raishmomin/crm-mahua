import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { t, type Lang } from './i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** 06 Nov 2026 (en-IN); empty string for null / invalid. */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** 06 Nov (en-IN) for tight places such as the order stepper; empty string for null / invalid. */
export function formatShortDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d);
}

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

/**
 * ₹1,25,000 (lakh grouping) / $23,400 / AED 12,000.
 * Lists and KPIs use 0 decimals; forms and print use 2. Negatives are shown as 0.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = 'INR',
  opts?: { decimals?: 0 | 2 }
): string {
  const n = Math.max(0, Number(amount ?? 0) || 0);
  const decimals = opts?.decimals ?? 0;
  const cur = (currency || 'INR').toUpperCase();
  const locale = cur === 'INR' ? 'en-IN' : 'en-US';
  const num = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
  const symbol = SYMBOLS[cur];
  return symbol ? `${symbol}${num}` : `${cur} ${num}`;
}

/** 12,000 kg or 12 MT (MT only for whole thousands). */
export function formatQty(kg: number | string | null | undefined, lang: Lang = 'en'): string {
  const n = Number(kg ?? 0) || 0;
  if (n >= 1000 && n % 1000 === 0) {
    return `${new Intl.NumberFormat('en-IN').format(n / 1000)} ${t(lang, 'unit.mt')}`;
  }
  return `${new Intl.NumberFormat('en-IN').format(n)} ${t(lang, 'unit.kg')}`;
}

/** ₹185/kg, $2,250/MT (no decimals unless the rate is not an integer). */
export function formatRate(rate: number | string | null | undefined, currency: string, unit: 'kg' | 'MT' | string): string {
  const n = Number(rate ?? 0) || 0;
  const cur = (currency || 'INR').toUpperCase();
  const locale = cur === 'INR' ? 'en-IN' : 'en-US';
  const decimals = Number.isInteger(n) ? 0 : 2;
  const num = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  const symbol = SYMBOLS[cur];
  return `${symbol ? symbol + num : cur + ' ' + num}/${unit}`;
}

/** 480 bags x 25 kg (Gujarati: 480 બેગ x 25 કિલો). */
export function formatBags(bags: number | string | null | undefined, bagKg: number | string | null | undefined, lang: Lang = 'en'): string {
  const b = Number(bags ?? 0) || 0;
  const kg = Number(bagKg ?? 25) || 25;
  return `${new Intl.NumberFormat('en-IN').format(b)} ${t(lang, 'unit.bags')} x ${kg} ${t(lang, 'unit.kg')}`;
}

/** "3 days left" / "12 days late" / "5 days old" via common.days_*. */
export function formatDays(n: number, lang: Lang, kind: 'left' | 'late' | 'old'): string {
  return t(lang, `common.days_${kind}`, { n });
}

/** Today / Tomorrow / Yesterday when close, else 06 Nov 2026. */
export function formatRelativeDate(dateStr: string | null | undefined, lang: Lang): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86400000);
  if (diff === 0) return t(lang, 'common.today');
  if (diff === 1) return t(lang, 'common.tomorrow');
  if (diff === -1) return t(lang, 'common.yesterday');
  return formatDate(d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** First word of a full name ("Hareshbhai Mehta" -> "Hareshbhai"). */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Up to two initials for an avatar circle. */
export function initials(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? '') + (parts[1][0] ?? '');
}

/** YYYY-MM-DD for today in local time (date inputs). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
