import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingObjectError } from '@/lib/db-errors';
import type { QuoteDetail, QuoteListRow, Quotation, QuotationItem, QuotationItemRow } from '@/types/quotes';
import type { BuyerLite, PriceRow } from './helpers';
import { daysUntil, isoDate, quoteDisplayStatus } from './helpers';
import { loadBuyerPhones } from '../samples/data';

type Supabase = SupabaseClient;

interface RawQuoteRow extends Quotation {
  buyers: { company_name: string } | null;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function numericHeader(q: Quotation): Quotation {
  return { ...q, subtotal: num(q.subtotal), gst_amount: num(q.gst_amount), total: num(q.total), fx_rate: q.fx_rate === null ? null : num(q.fx_rate) };
}

/** Every quote of the org with buyer name and the derived status. */
export async function loadQuoteList(supabase: Supabase): Promise<{ rows: QuoteListRow[]; error: boolean }> {
  const { data, error } = await supabase.from('quotations').select('*, buyers(company_name)').order('created_at', { ascending: false }).limit(300);
  if (error) {
    console.error('[quotes] list failed:', error.code, error.message);
    return { rows: [], error: true };
  }
  const today = isoDate();
  const rows = ((data ?? []) as RawQuoteRow[]).map((r) => {
    const { buyers, ...q } = r;
    return {
      ...numericHeader(q),
      buyer_name: buyers?.company_name ?? '',
      display_status: quoteDisplayStatus(q.status, q.valid_till, today),
      days_left: daysUntil(q.valid_till, today),
    };
  });
  return { rows, error: false };
}

/** Sort (screens.md 11): Sent expiring soonest first, then Draft, then the rest newest first. */
export function sortQuotes(rows: QuoteListRow[]): QuoteListRow[] {
  const rank = (r: QuoteListRow) => (r.display_status === 'sent' ? 0 : r.display_status === 'draft' ? 1 : 2);
  return [...rows].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return a.valid_till.localeCompare(b.valid_till);
    return b.created_at.localeCompare(a.created_at);
  });
}

interface RawItemRow extends QuotationItem {
  products: { name: string; hsn_code: string | null } | null;
  packaging_types: { name: string } | null;
}

interface RawBuyer {
  id: string;
  company_name: string;
  buyer_type: string | null;
  country: string;
  city: string | null;
  state: string | null;
  address: string | null;
  gstin: string | null;
}

/** One quote with buyer, contact, items (names) and the sender's first name. */
export async function loadQuoteDetail(supabase: Supabase, id: string): Promise<QuoteDetail | null> {
  const { data, error } = await supabase.from('quotations').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[quotes] load failed:', error.code, error.message);
    return null;
  }
  if (!data) return null;
  const q = numericHeader(data as Quotation);

  const [buyerRes, contactRes, itemsRes, senderRes, inquiryRes] = await Promise.all([
    supabase.from('buyers').select('id, company_name, buyer_type, country, city, state, address, gstin').eq('id', q.buyer_id).maybeSingle(),
    supabase.from('buyer_contacts').select('name, phone, is_primary').eq('buyer_id', q.buyer_id).order('is_primary', { ascending: false }).limit(1),
    supabase.from('quotation_items').select('*, products(name, hsn_code), packaging_types(name)').eq('quotation_id', q.id).order('sort_order'),
    q.created_by ? supabase.from('profiles').select('full_name').eq('id', q.created_by).maybeSingle() : Promise.resolve({ data: null }),
    q.inquiry_id ? supabase.from('inquiries').select('code').eq('id', q.inquiry_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const buyer = (buyerRes.data as RawBuyer | null) ?? null;
  const contact = ((contactRes.data ?? []) as { name: string; phone: string }[])[0] ?? null;
  const items: QuotationItemRow[] = ((itemsRes.data ?? []) as RawItemRow[]).map((r) => {
    const { products, packaging_types, ...it } = r;
    return {
      ...it,
      qty_kg: num(it.qty_kg),
      rate: num(it.rate),
      amount: num(it.amount),
      gst_rate: num(it.gst_rate),
      floor_price_at_time: it.floor_price_at_time === null ? null : num(it.floor_price_at_time),
      product_name: products?.name ?? '',
      product_hsn: products?.hsn_code ?? null,
      packaging_name: packaging_types?.name ?? null,
    };
  });

  const today = isoDate();
  return {
    ...q,
    display_status: quoteDisplayStatus(q.status, q.valid_till, today),
    days_left: daysUntil(q.valid_till, today),
    buyer: {
      id: buyer?.id ?? q.buyer_id,
      company_name: buyer?.company_name ?? '',
      buyer_type: buyer?.buyer_type ?? null,
      country: buyer?.country ?? 'India',
      city: buyer?.city ?? null,
      state: buyer?.state ?? null,
      address: buyer?.address ?? null,
      gstin: buyer?.gstin ?? null,
      contact_name: contact?.name ?? null,
      phone: contact?.phone ?? null,
    },
    items,
    sent_by_name: (senderRes.data as { full_name: string } | null)?.full_name ?? null,
    inquiry_code: (inquiryRes.data as { code: string } | null)?.code ?? null,
  };
}

/** The order made from an accepted quote (0006 may not exist yet: null, never an error). */
export async function loadOrderForQuote(supabase: Supabase, quoteId: string): Promise<{ id: string; order_code: string } | null> {
  try {
    const { data, error } = await supabase.from('orders').select('id, order_code').eq('quotation_id', quoteId).order('created_at', { ascending: false }).limit(1);
    if (error) {
      if (!isMissingObjectError(error)) console.error('[quotes] orders lookup failed:', error.code, error.message);
      return null;
    }
    return ((data ?? []) as { id: string; order_code: string }[])[0] ?? null;
  } catch {
    return null;
  }
}

export interface QuoteFollowup {
  id: string;
  note: string;
  due_on: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
}

/** Notes and reminders on the quote (0004 follow_ups); empty when the table is missing. */
export async function loadQuoteFollowups(supabase: Supabase, quoteId: string): Promise<QuoteFollowup[]> {
  try {
    const { data, error } = await supabase
      .from('follow_ups')
      .select('id, note, due_on, done, done_at, created_at')
      .eq('entity_type', 'quote')
      .eq('entity_id', quoteId)
      .order('done', { ascending: true })
      .order('due_on', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      if (!isMissingObjectError(error)) console.error('[quotes] follow_ups failed:', error.code, error.message);
      return [];
    }
    return (data ?? []) as QuoteFollowup[];
  } catch {
    return [];
  }
}

export interface ProductLite {
  id: string;
  name: string;
  color: string | null;
  form: string | null;
  mesh: string | null;
  moisture_max_pct: number | string | null;
  gst_rate: number | string;
}

export interface PackagingLite {
  id: string;
  name: string;
  capacity_kg: number | string;
}

export interface QuoteFormData {
  buyers: BuyerLite[];
  products: ProductLite[];
  packaging: PackagingLite[];
  prices: PriceRow[];
  currencyRates: Record<string, number>;
  defaultIncoterm: string | null;
}

/** Catalog, buyers, price list and settings for the quote form. */
export async function loadQuoteFormData(supabase: Supabase, orgId: string): Promise<QuoteFormData> {
  const [buyersRes, productsRes, packagingRes, pricesRes, settingsRes] = await Promise.all([
    supabase.from('buyers').select('id, company_name, buyer_type, country, city, preferred_currency, incoterm, payment_terms').eq('status', 'active').order('company_name'),
    supabase.from('products').select('id, name, color, form, mesh, moisture_max_pct, gst_rate').eq('is_active', true).order('name'),
    supabase.from('packaging_types').select('id, name, capacity_kg').eq('is_active', true).order('name'),
    supabase.from('price_list_items').select('product_id, currency, unit, rate, floor_price, is_active, effective_from').eq('is_active', true),
    supabase.from('app_settings').select('settings').eq('org_id', orgId).maybeSingle(),
  ]);
  const settings = ((settingsRes.data as { settings?: Record<string, unknown> } | null)?.settings ?? {}) as Record<string, unknown>;
  const ratesRaw = (settings.currency_rates ?? {}) as Record<string, unknown>;
  const currencyRates: Record<string, number> = {};
  for (const [k, v] of Object.entries(ratesRaw)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) currencyRates[k.toUpperCase()] = n;
  }
  return {
    buyers: (buyersRes.data ?? []) as BuyerLite[],
    products: (productsRes.data ?? []) as ProductLite[],
    packaging: (packagingRes.data ?? []) as PackagingLite[],
    prices: ((pricesRes.data ?? []) as PriceRow[]).map((p) => ({ ...p, rate: num(p.rate), floor_price: num(p.floor_price) })),
    currencyRates,
    defaultIncoterm: typeof settings.default_incoterm === 'string' ? settings.default_incoterm : null,
  };
}

export interface InquiryLite {
  id: string;
  code: string;
  buyer_id: string | null;
  buyer_name: string;
  product_id: string | null;
  qty_kg: number | null;
}

export async function loadInquiryLite(supabase: Supabase, id: string): Promise<InquiryLite | null> {
  const { data, error } = await supabase.from('inquiries').select('id, code, buyer_id, buyer_name, product_id, qty_kg').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const d = data as InquiryLite;
  return { ...d, qty_kg: d.qty_kg === null ? null : num(d.qty_kg) };
}

export { loadBuyerPhones };
