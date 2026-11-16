/**
 * Pure helpers shared by the quote pages, forms and print (no server imports).
 * Rules: contracts.md 3.4 (expired display rule), 6.3 (currency / price basis defaults),
 * flows.md 4 and 10 (WhatsApp T2), screens.md 12-14.
 */
import { t, type Lang } from '@/lib/i18n';
import { formatDate, formatMoney, formatQty, formatRate } from '@/lib/utils';
import { isExportType } from '@/types/buyers';
import type { Incoterm, QuoteStatus, RateUnit } from '@/types/quotes';
import { PAYMENT_TERM_PRESETS } from './labels';

export interface PriceRow {
  product_id: string;
  currency: string;
  unit: RateUnit | string;
  rate: number | string;
  floor_price: number | string;
  is_active: boolean;
  effective_from: string;
}

export interface BuyerLite {
  id: string;
  company_name: string;
  buyer_type?: string | null;
  country: string;
  city?: string | null;
  preferred_currency: string;
  incoterm: 'EXW' | 'FOB' | 'CIF' | string;
  payment_terms: string;
}

/** Local YYYY-MM-DD for "today"; `plusDays` shifts it. */
export function isoDate(date: Date = new Date(), plusDays = 0): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + plusDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Whole days from today to an ISO date (negative when past). */
export function daysUntil(iso: string | null | undefined, today: string = isoDate()): number {
  if (!iso) return 0;
  const a = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const b = new Date(`${today}T00:00:00`);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** sent AND valid_till < today shows as expired; nothing else changes (contracts 3.4). */
export function quoteDisplayStatus(status: QuoteStatus, validTill: string, today: string = isoDate()): QuoteStatus {
  if (status === 'sent' && validTill.slice(0, 10) < today) return 'expired';
  return status;
}

/**
 * Export or India, the same rule as orders/helpers.ts isExportBuyer (G2-04): the buyer type
 * decides (export_importer / export_agent); without a type, contracts 6.3 `country <> 'India'`
 * (an empty country is export, a missing one India).
 */
export function isExportBuyer(b: { buyer_type?: string | null; country?: string | null }): boolean {
  if (b.buyer_type) return isExportType(b.buyer_type);
  return (b.country ?? 'India').trim().toLowerCase() !== 'india';
}

/** Active price-list row for product + currency, preferring the given unit, latest effective_from first. */
export function findPrice(prices: PriceRow[], productId: string, currency: string, unit?: RateUnit, today: string = isoDate()): PriceRow | null {
  const rows = prices.filter(
    (p) => p.product_id === productId && p.currency === currency && p.is_active && p.effective_from.slice(0, 10) <= today
  );
  rows.sort((a, b) => {
    const ua = unit && a.unit === unit ? 0 : 1;
    const ub = unit && b.unit === unit ? 0 : 1;
    if (ua !== ub) return ua - ub;
    return b.effective_from.localeCompare(a.effective_from);
  });
  return rows[0] ?? null;
}

/** Floor in the item's unit (converted when the list prices the other unit), like fn_quote_item_guard. */
export function floorFor(prices: PriceRow[], productId: string, currency: string, unit: RateUnit): number | null {
  const row = findPrice(prices, productId, currency, unit);
  if (!row) return null;
  const floor = Number(row.floor_price);
  if (row.unit === unit) return floor;
  return unit === 'MT' ? floor * 1000 : floor / 1000;
}

/**
 * Currencies the price list prices every picked product in (all priced currencies while no
 * product is picked), INR and USD first. A quote in any other currency has no floor, so the
 * form offers only these (G2-01 / SEC2-01; the item guard refuses the rest for non-owners).
 */
export function pricedCurrencies(prices: PriceRow[], productIds: string[], today: string = isoDate()): string[] {
  const ids = productIds.filter(Boolean);
  const all = Array.from(new Set(prices.filter((p) => p.is_active && p.effective_from.slice(0, 10) <= today).map((p) => p.currency)));
  const ok = all.filter((cur) => ids.every((id) => findPrice(prices, id, cur, undefined, today) !== null));
  const rank = (c: string) => (c === 'INR' ? 0 : c === 'USD' ? 1 : 2);
  return ok.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Text for a failed quote action. below_floor_price carries the floor in `detail`, or
 * 'no_price' when the price list has no rate for the product in the quote currency.
 */
export function quoteErrorText(
  tt: (key: string, vars?: Record<string, string | number>) => string,
  messageKey: string,
  detail: string | undefined,
  currency: string
): string {
  if (detail === 'no_price') return tt('quotes.no_price', { currency });
  if (!detail) return tt(messageKey);
  const floor = Number(detail);
  return tt(messageKey, { floor: Number.isFinite(floor) ? formatMoney(floor, currency, { decimals: 0 }) : detail });
}

/**
 * Quote currency (contracts 6.3): the buyer's preferred currency when the price list has an
 * active row for the product in it, else USD for export buyers and INR for India.
 */
export function defaultCurrency(buyer: BuyerLite | null, prices: PriceRow[], productId?: string | null): string {
  if (!buyer) return 'INR';
  const preferred = (buyer.preferred_currency || '').toUpperCase();
  if (preferred) {
    const has = productId ? findPrice(prices, productId, preferred) !== null : prices.some((p) => p.currency === preferred && p.is_active);
    if (has) return preferred;
  }
  return isExportBuyer(buyer) ? 'USD' : 'INR';
}

/** Price basis chip from the buyer's incoterm; FOB follows app_settings.default_incoterm. */
export function defaultIncoterm(buyer: BuyerLite | null, settingsDefault: string | null | undefined): Incoterm {
  const code = (buyer?.incoterm || 'EXW').toUpperCase();
  if (code === 'CIF') return 'CIF';
  if (code === 'FOB') {
    const d = (settingsDefault || '').trim();
    return d === 'FOB Pipavav' ? 'FOB Pipavav' : 'FOB Mundra';
  }
  return 'EXW';
}

/** Buyer payment terms matched to a chip (by leading number / LC); otherwise the text itself. */
export function matchPaymentTerms(text: string | null | undefined): string {
  const s = (text ?? '').trim();
  if (!s) return PAYMENT_TERM_PRESETS[0];
  const lower = s.toLowerCase();
  if (lower.includes('lc') || lower.includes('letter of credit')) return 'LC at sight';
  if (/^100\s*%/.test(lower)) return '100% advance';
  if (/^50\s*%/.test(lower)) return '50% advance, 50% before dispatch';
  if (/^30\s*%/.test(lower)) return '30% advance, 70% against BL copy';
  if (/^\d+\s*days?/.test(lower) || lower.includes('credit') || lower.includes('net')) return '30 days credit';
  return s;
}

/** Advance percentage from the payment-terms words: 30 / 50 / 100, 0 for credit and LC. */
export function advancePctFromTerms(terms: string | null | undefined): 0 | 30 | 50 | 100 {
  const lower = (terms ?? '').toLowerCase();
  if (lower.includes('lc') || lower.includes('credit')) return 0;
  const m = lower.match(/(\d{2,3})\s*%/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (n >= 100) return 100;
  if (n >= 50) return 50;
  if (n >= 30) return 30;
  return 0;
}

/** qty_kg x rate (per kg) or qty_kg / 1000 x rate (per MT), 2 decimals. */
export function itemAmount(qtyKg: number, rate: number, unit: RateUnit): number {
  const raw = unit === 'MT' ? (qtyKg / 1000) * rate : qtyKg * rate;
  return Math.round(raw * 100) / 100;
}

export function bagsFor(qtyKg: number, bagKg: number | null | undefined): number {
  const kg = Number(bagKg) > 0 ? Number(bagKg) : 25;
  return Math.ceil(qtyKg / kg);
}

export function currencySymbol(currency: string): string {
  const map: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return map[currency.toUpperCase()] ?? currency.toUpperCase();
}

/** "about ₹41,70,375 (at ₹84.25 per $)" or '' for INR / no rate. */
export function aboutInrLine(lang: Lang, total: number, currency: string, fxRate: number | null | undefined, local: Parameters<typeof t>[3]): string {
  if (currency === 'INR' || !fxRate || fxRate <= 0) return '';
  return t(lang, 'quotes.about_inr_rate', { amount: formatMoney(total * fxRate, 'INR').replace('₹', ''), rate: String(fxRate), symbol: currencySymbol(currency) }, local);
}

export interface QuoteShareInput {
  buyerName: string;
  contactName?: string | null;
  isExport: boolean;
  quoteNo: string;
  productName: string;
  qtyKg: number;
  rate: number;
  unit: RateUnit;
  currency: string;
  incoterm: string;
  paymentTerms: string;
  validTill: string;
  total: number;
  senderName: string;
  company: string;
}

/** WhatsApp text T2 (wa.quote_share); export buyers always get the English template. */
export function quoteWhatsappText(lang: Lang, q: QuoteShareInput): string {
  const l: Lang = q.isExport ? 'en' : lang;
  return t(l, 'wa.quote_share', {
    buyer: q.contactName || q.buyerName,
    quote_no: q.quoteNo,
    product: q.productName,
    qty: formatQty(q.qtyKg, l),
    rate: formatRate(q.rate, q.currency, q.unit),
    unit: q.unit === 'MT' ? t(l, 'unit.mt') : t(l, 'unit.kg'),
    basis: q.incoterm,
    terms: q.paymentTerms,
    valid_till: formatDate(q.validTill),
    amount: formatMoney(q.total, q.currency),
    sender: q.senderName,
    company: q.company,
  });
}
